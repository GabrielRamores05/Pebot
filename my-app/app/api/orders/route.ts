import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { emitEvent } from '@/lib/socket';
import { calculateOrderWaitTime } from '@/lib/waitTime';
import { normalizeMemberName } from '@/lib/loyalty-utils';
import { logAction } from '@/lib/audit-log';
import { getSellableQuantity, recomputeProducts } from '@/lib/availability';
import {
  awardLoyaltyForPaidOrder,
  awardLoyaltyToSpecificCards,
} from '@/lib/loyalty-award';
function generateOrderNumber(): string {
  const now = new Date();
  const datePart = now.toISOString().slice(0, 10).replace(/-/g, '');
  const timePart = now.getTime().toString().slice(-6);
  return `ORD-${datePart}-${timePart}`;
}

class InsufficientStockError extends Error {
  items: { productId: number; name: string; requested: number; available: number }[];
  constructor(items: { productId: number; name: string; requested: number; available: number }[]) {
    super('One or more items are out of stock');
    this.name = 'InsufficientStockError';
    this.items = items;
  }
}

// GET /api/orders – list orders (for admin/kitchen)
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const status = searchParams.get('status');
    const date = searchParams.get('date');
    const search = searchParams.get('search');
    const all = searchParams.get('all') === 'true';

    const where: Record<string, unknown> = {};

    if (status && status !== 'ALL') {
      where.status = status;
    }

    // Don't filter by date on server when all=true (Order History view)
    if (!all) {
      const threeDaysAgo = new Date();
      threeDaysAgo.setDate(threeDaysAgo.getDate() - 3);
      where.createdAt = { gte: threeDaysAgo };
    }

    if (search) {
      where.OR = [
        { orderNumber: { contains: search } },
        { customerName: { contains: search } },
      ];
    }

    const orders = await prisma.order.findMany({
      where,
      include: {
        items: { include: { product: true } },
        table: true,
        payment: true,
        messages: { orderBy: { createdAt: 'asc' } },
      },
      orderBy: { createdAt: 'desc' },
      take: all ? 10000 : 200,
    });

    return NextResponse.json(orders);
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: 'Failed to fetch orders' }, { status: 500 });
  }
}

// POST /api/orders – place a new order
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { customerName, loyaltyCustomerName, tableId, sessionId, items, notes, loyaltyDiscount, loyaltyVoucherCodes, paymentMethod, paymentScreenshot, paymentConfirmed, overrideStock, orderType, deliveryAddress, loyaltyAssignments } = body as {
      customerName: string;
      loyaltyCustomerName?: string | null;
      tableId?: number;
      sessionId?: number | null;
      items: { productId: number; quantity: number; notes?: string }[];
      notes?: string;
      loyaltyDiscount?: number;
      loyaltyVoucherCodes?: string[];
      paymentMethod?: string;
      paymentScreenshot?: string;
      paymentConfirmed?: boolean;
      overrideStock?: boolean;
      orderType?: string;
      deliveryAddress?: string | null;
      loyaltyAssignments?: { productId: number; quantity: number; loyaltyCardIds: number[]; quantitiesPerCard: number[] }[];
    };

    if (!customerName || !items || items.length === 0) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    const orderTypeValue = orderType || 'DINE_IN';
    const deliveryAddressValue = deliveryAddress?.trim() ? deliveryAddress.trim() : null;

    // A delivery order must have somewhere to go — never place one with no address.
    if (orderTypeValue === 'DELIVERY' && !deliveryAddressValue) {
      return NextResponse.json(
        { error: 'Please enter a delivery address for delivery orders.' },
        { status: 400 },
      );
    }

    // Fetch products to calculate prices
    const productIds = items.map((i) => i.productId);
    const products = await prisma.product.findMany({
      where: { id: { in: productIds } },
      include: { inventory: true },
    });

    const productMap = new Map(products.map((p) => [p.id, p]));

    let totalAmount = 0;
    const orderItemsData = items.map((item) => {
      const product = productMap.get(item.productId);
      if (!product) throw new Error(`Product ${item.productId} not found`);
      const subtotal = product.price * item.quantity;
      totalAmount += subtotal;
      return {
        productId: item.productId,
        quantity: item.quantity,
        unitPrice: product.price,
        subtotal,
        notes: item.notes,
      };
    });

    // Apply loyalty discount if provided
    const isLoyaltyOrder = !!(loyaltyDiscount && loyaltyDiscount > 0);
    if (isLoyaltyOrder) {
      totalAmount = Math.max(0, totalAmount - loyaltyDiscount);
    }

    const orderNumber = generateOrderNumber();
    const barcodeValue = `CAFE-${orderNumber}`;

    // Create order & deduct inventory in a transaction
    const order = await prisma.$transaction(async (tx) => {
      // Assign queue number based on pending/preparing orders
      const pendingCount = await tx.order.count({
        where: { status: { in: ['PENDING', 'PREPARING'] } },
      });
      const queueNumber = pendingCount + 1;

      const newOrder = await tx.order.create({
        data: {
          orderNumber,
          customerName,
          loyaltyCustomerName: loyaltyCustomerName?.trim() ? loyaltyCustomerName.trim().toUpperCase() : null,
          tableId: tableId || null,
          sessionId: sessionId || null,
          totalAmount,
          barcodeValue,
          notes,
          loyaltyPromo: isLoyaltyOrder,
          paymentMethod: paymentMethod || 'CASH',
          paymentScreenshot: paymentScreenshot || null,
          orderType: orderTypeValue,
          deliveryAddress: orderTypeValue === 'DELIVERY' ? deliveryAddressValue : null,
          queueNumber,
          items: { create: orderItemsData },
          ...(loyaltyAssignments && { loyaltyAssignments }),
        },
        include: {
          items: { include: { product: true } },
          table: true,
        },
      });

      // Stock check — sellable quantity is derived from ingredient stock + the
      // product recipe (spec: ingredient stock is the shared pool; recipes
      // determine consumption; availability is calculated, never allocated).
      const unavailable: { productId: number; name: string; requested: number; available: number }[] = [];
      const affectedProductIds: number[] = [];
      for (const item of items) {
        affectedProductIds.push(item.productId);
        const available = await getSellableQuantity(tx, item.productId);
        if (!overrideStock && available < item.quantity) {
          unavailable.push({
            productId: item.productId,
            name: productMap.get(item.productId)?.name ?? `Item ${item.productId}`,
            requested: item.quantity,
            available,
          });
        }
      }
      if (unavailable.length > 0) {
        throw new InsufficientStockError(unavailable);
      }

      // Consume ingredients based on the recipe (NOT the per-product Inventory
      // table — that is now a derived cache of sellable quantity). Required
      // ingredients are decremented unconditionally (the check above guarantees
      // sufficiency in normal mode). Optional ingredients are only consumed
      // when enough stock exists — they never block a sale and never go
      // negative (spec §3).
      for (const item of items) {
        const productIngredients = await tx.productIngredient.findMany({
          where: { productId: item.productId },
          include: { ingredient: true },
        });
        for (const pi of productIngredients) {
          const totalNeeded = item.quantity * pi.quantity;
          if (totalNeeded <= 0) continue;

          if (pi.required ?? true) {
            await tx.ingredient.updateMany({
              where: { id: pi.ingredientId },
              data: { currentStock: { decrement: totalNeeded } },
            });
            await tx.ingredientTransaction.create({
              data: {
                ingredientId: pi.ingredientId,
                type: 'USAGE',
                quantity: -totalNeeded,
                purchaseCost: null,
                unitCost: null,
                purchaseUnit: null,
                referenceId: newOrder.id,
                referenceType: 'order',
                notes: `Order ${newOrder.orderNumber}`,
              },
            });
          } else {
            // Optional ingredient: consume only what is actually available.
            const ingredient = await tx.ingredient.findUnique({ where: { id: pi.ingredientId } });
            const consume = Math.min(totalNeeded, ingredient?.currentStock ?? 0);
            if (consume > 0) {
              await tx.ingredient.updateMany({
                where: { id: pi.ingredientId },
                data: { currentStock: { decrement: consume } },
              });
              await tx.ingredientTransaction.create({
                data: {
                  ingredientId: pi.ingredientId,
                  type: 'USAGE',
                  quantity: -consume,
                  purchaseCost: null,
                  unitCost: null,
                  purchaseUnit: null,
                  referenceId: newOrder.id,
                  referenceType: 'order',
                  notes: `Order ${newOrder.orderNumber} (optional, partial)`,
                },
              });
            }
          }
        }
      }

      // Refresh the derived sellable-quantity cache for every product in this
      // order (re-reads live ingredient stock, so shared-ingredient effects are
      // picked up automatically).
      await recomputeProducts(tx, affectedProductIds);

      // Proactively create a loyalty card for this customer so they are
      // registered in the loyalty system before the order is finalized
      const normalizedName = normalizeMemberName(customerName);
      const existingCard = await tx.loyaltyCard.findFirst({
        where: { customerName: normalizedName, categoryId: null },
      });
      if (!existingCard) {
        await tx.loyaltyCard.create({
          data: {
            customerName: normalizedName,
            categoryId: null,
          },
        });
      }

      // NOTE: Tables remain AVAILABLE at all times - do not change status
      // This allows multiple customers to select the same table for ordering
      // Table status is only used for cleaning tracking, not for order assignment

      return newOrder;
    });

    // Calculate estimated wait times per station
    const orderItemStations = items.map((item) => {
      const product = productMap.get(item.productId)!;
      return {
        stationType: product.stationType,
        prepTimeMinutes: product.prepTimeMinutes,
        quantity: item.quantity,
      };
    });
    const { perStation, maxWait } = await calculateOrderWaitTime(
      orderItemStations,
      order.createdAt,
    );

    // Emit WebSocket events
    console.log(`[ORDER CREATED] ${order.orderNumber} for ${order.customerName} (est. ${maxWait} min)`);
    emitEvent('new-order', { ...order, estimatedTimes: perStation, estimatedWait: maxWait });
    emitEvent('queue-update', { type: 'new_order', queueNumber: order.queueNumber });
    emitEvent('inventory-update', { productIds });
    emitEvent('ingredients-update', []);

    await logAction({
      action: 'ORDER_CREATE',
      resource: 'order',
      resourceId: order.id,
      details: { orderNumber: order.orderNumber, customerName, totalAmount, itemCount: items.length },
      req,
    });

    // Check low-stock after deduction
    const inventories = await prisma.inventory.findMany({
      where: { productId: { in: productIds } },
      include: { product: true },
    });
    const lowStock = inventories.filter((inv) => inv.quantity <= inv.lowStockThreshold);
    if (lowStock.length > 0) {
      emitEvent('low-stock-alert', lowStock);
    }

    // Award loyalty points to specific cards if loyaltyAssignments provided
    if (loyaltyAssignments && customerName) {
      try {
        await awardLoyaltyToSpecificCards({
          loyaltyAssignments,
          customerName,
          orderId: order.id,
        });
      } catch (err) {
        console.error('[LOYALTY] Failed to update specific cards:', err);
      }
    }

    // Terminal orders are paid at the counter at placement time, so they earn
    // loyalty points immediately. QR orders are created unpaid (paymentConfirmed
    // absent) and earn points later when the cashier confirms payment.
    if (paymentConfirmed === true) {
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
        console.error('[LOYALTY] Failed to update cards at order placement:', err);
      }
    }

    return NextResponse.json(
      { ...order, estimatedTimes: perStation, estimatedWait: maxWait },
      { status: 201 },
    );
  } catch (e) {
    if (e instanceof InsufficientStockError) {
      const names = e.items.map((i) => i.name).join(', ');
      return NextResponse.json(
        { error: `Sorry, these items are no longer available: ${names}. Your order was not placed — nothing has been charged.` },
        { status: 409 },
      );
    }
    console.error(e);
    return NextResponse.json({ error: 'Failed to create order' }, { status: 500 });
  }
}
