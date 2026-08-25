import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { emitEvent } from '@/lib/socket';
import { normalizeMemberName } from '@/lib/loyalty-utils';
import { logAction } from '@/lib/audit-log';
import { awardLoyaltyForPaidOrder, refundLoyaltyForCancelledOrder } from '@/lib/loyalty-award';
import { productsUsingIngredient, recomputeProducts } from '@/lib/availability';

// GET /api/orders/[id] – fetch single order by orderNumber or id
export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const order = await prisma.order.findFirst({
      where: isNaN(Number(id)) ? { orderNumber: id } : { id: Number(id) },
      include: {
        items: { include: { product: { include: { category: true } } } },
        table: true,
        payment: true,
      },
    });

    if (!order) return NextResponse.json({ error: 'Order not found' }, { status: 404 });
    return NextResponse.json(order);
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
}

// PATCH /api/orders/[id] – update order status
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const body = await req.json();
    const { status, tableId, paymentConfirmed } = body as {
      status?: string;
      tableId?: number;
      paymentConfirmed?: boolean;
    };

    const orderId = Number(id);
    if (isNaN(orderId)) return NextResponse.json({ error: 'Invalid id' }, { status: 400 });

    const existing = await prisma.order.findUnique({
      where: { id: orderId },
      include: { table: true, items: true },
    });
    if (!existing) return NextResponse.json({ error: 'Order not found' }, { status: 404 });

    // Payment confirmation is what awards loyalty points — not the status change
    // itself. The cashier sends this marker when they take the money; the kitchen
    // never does, so "Mark Ready" can never award points.
    const isPaymentConfirmation = paymentConfirmed === true;

    const addItems = (body as { addItems?: { productId: number; quantity: number }[] }).addItems;

    const updateData: Record<string, unknown> = {};
    if (status) updateData.status = status;
    if (tableId !== undefined) updateData.tableId = tableId;

    // IMPORTANT: If adding items to existing order, keep the table status as OCCUPIED
    // Only change table status if explicitly changing status to COMPLETED or CANCELLED
    const isAddingItems = addItems && addItems.length > 0;

    // Cancel guard: only PENDING orders can be cancelled
    if (status === 'CANCELLED' && existing.status !== 'PENDING') {
      return NextResponse.json({ error: 'Only pending orders can be cancelled' }, { status: 400 });
    }

    const order = await prisma.$transaction(async (tx) => {
      // Add new items to existing order
      if (addItems && addItems.length > 0) {
        let extraTotal = 0;
        for (const item of addItems) {
          const product = await tx.product.findUnique({ where: { id: item.productId } });
          if (!product) continue;
          const subtotal = Number(product.price) * item.quantity;
          extraTotal += subtotal;
          await tx.orderItem.create({
            data: {
              orderId,
              productId: item.productId,
              quantity: item.quantity,
              unitPrice: product.price,
              subtotal,
            },
          });
        }
        updateData.totalAmount = { increment: extraTotal };
      }

      const updated = await tx.order.update({
        where: { id: orderId },
        data: updateData,
        include: { items: { include: { product: true } }, table: true, payment: true },
      });

        // Handle inventory restore on cancel.
        // The per-product Inventory table is now a *derived cache* of sellable
        // quantity, so it is NOT incremented here — it is recomputed from the
        // live ingredient stock after restoration (spec: inventory is the shared
        // pool; recipes determine consumption). We restore exactly what was
        // consumed, by replaying this order's USAGE transaction records, which
        // correctly handles both required and (partially-consumed) optional
        // ingredients.
        // NOTE: Tables remain AVAILABLE at all times - do not change status
        if (status === 'CANCELLED' && existing.status !== 'CANCELLED') {
          const usageTxns = await tx.ingredientTransaction.findMany({
            where: { referenceId: orderId, referenceType: 'order', type: 'USAGE' },
            select: { ingredientId: true, quantity: true },
          });
          const restoredIngredients = new Set<number>();
          for (const t of usageTxns) {
            const restored = Math.abs(t.quantity);
            if (restored > 0) {
              await tx.ingredient.updateMany({
                where: { id: t.ingredientId },
                data: { currentStock: { increment: restored } },
              });
              await tx.ingredientTransaction.create({
                data: {
                  ingredientId: t.ingredientId,
                  type: 'USAGE',
                  quantity: restored, // positive = stock restored
                  purchaseCost: null,
                  unitCost: null,
                  purchaseUnit: null,
                  referenceId: orderId,
                  referenceType: 'order',
                  notes: `Order cancelled: stock restored (was ${existing.orderNumber || orderId})`,
                },
              });
              restoredIngredients.add(t.ingredientId);
            }
          }

          // Refresh derived sellable quantities for every product that shares a
          // restored ingredient.
          const affectedProductIds = new Set<number>();
          for (const ingId of restoredIngredients) {
            const pids = await productsUsingIngredient(tx, ingId);
            pids.forEach((p: number) => affectedProductIds.add(p));
          }
          if (affectedProductIds.size > 0) {
            await recomputeProducts(tx, Array.from(affectedProductIds));
          }

          // Reverse loyalty points awarded for this order
          await refundLoyaltyForCancelledOrder(orderId);
        }

       // Re-sequence queue numbers when a order leaves the active queue
       if ((status === 'COMPLETED' || status === 'CANCELLED') && existing.status !== status) {
         const remainingActive = await tx.order.findMany({
           where: {
             status: { in: ['PENDING', 'PREPARING'] },
             id: { not: orderId },
           },
           orderBy: { createdAt: 'asc' },
           select: { id: true },
         });
         for (let i = 0; i < remainingActive.length; i++) {
           await tx.order.update({
             where: { id: remainingActive[i].id },
             data: { queueNumber: i + 1 },
           });
         }
       }

      return updated;
    });

    // Award loyalty points only when the cashier confirms payment
    if (isPaymentConfirmation) {
      try {
        await awardLoyaltyForPaidOrder({
          id: order.id,
          loyaltyPromo: order.loyaltyPromo,
          loyaltyCustomerName: order.loyaltyCustomerName,
          customerName: order.customerName,
          orderNumber: order.orderNumber,
          totalAmount: Number(order.totalAmount),
          items: order.items,
        });
      } catch (err) {
        console.error('[LOYALTY] Failed to update cards on payment:', err);
      }
    }

    // Broadcast events
    emitEvent('order-status-update', order);
    emitEvent('order-status-update', order, `order-${order.orderNumber}`);
    // Notify all clients about queue re-sequencing
    if ((status === 'COMPLETED' || status === 'CANCELLED') && existing.status !== status) {
      emitEvent('queue-update', { type: 'resequenced' });
    }
    if (status === 'COMPLETED') {
      emitEvent('analytics-update', { type: 'order-completed', order });
      // Emit order-completion notification for the customer
      emitEvent('order-completed-notification', {
        customerName: order.customerName,
        orderNumber: order.orderNumber,
        orderId: order.id,
        totalAmount: order.totalAmount,
      }, `customer-${order.customerName}`);
    }
    if (status === 'CANCELLED' && existing.status !== 'CANCELLED') {
      const productIds = existing.items.map((i) => i.productId);
      emitEvent('inventory-update', { productIds });
      emitEvent('ingredients-update', []);
      await logAction({
        action: 'ORDER_CANCEL',
        resource: 'order',
        resourceId: orderId,
        details: { orderNumber: order.orderNumber, previousStatus: existing.status },
        req,
      });
    }
    if (existing.tableId) {
      emitEvent('table-update', { tableId: existing.tableId });
    }

    return NextResponse.json(order);
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
}
