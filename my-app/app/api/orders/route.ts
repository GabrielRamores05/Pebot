import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { emitEvent } from '@/lib/socket';
import { calculateOrderWaitTime } from '@/lib/waitTime';
import { normalizeMemberName } from '@/lib/loyalty-utils';
import { logAction } from '@/lib/audit-log';
import { runRecoverableStep } from '@/lib/recoverable';
import { getSellableQuantity, recomputeProducts } from '@/lib/availability';
import {
  awardLoyaltyForPaidOrder,
  awardLoyaltyToSpecificCards,
} from '@/lib/loyalty-award';
import {
  resolveSelections,
  selectionsPriceAdder,
  selectionsIngredientDeltas,
  selectionsLabel,
  type ResolvedSelection,
} from '@/lib/product-options';
import {
  fullOrderNumber,
  nextSequenceForDay,
  sequenceValue,
  ticketDatePart,
} from '@/lib/ticket';
import { badRequest, serverError } from '@/lib/api-response';
import { guardStaff } from '@/lib/api-guards';
import { loyaltyDiscountFor } from '@/lib/loyalty-redemption';
import type { CartLineItem } from '@/lib/pos-utils';

class LoyaltyVoucherError extends Error {
  reasons: string[];
  constructor(reasons: string[]) {
    super(reasons.join(' '));
    this.name = 'LoyaltyVoucherError';
    this.reasons = reasons;
  }
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
  const { error } = await guardStaff(req);
  if (error) return error;

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
    return serverError(e, 'Failed to fetch orders');
  }
}

// POST /api/orders – place a new order
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { customerName, loyaltyCustomerName, tableId, sessionId, items, notes, loyaltyVoucherCodes, loyaltySelection, paymentMethod, paymentScreenshot, paymentConfirmed, overrideStock, orderType, deliveryAddress,       loyaltyAssignments, discountRate, discountReason } = body as {
      customerName: string;
      loyaltyCustomerName?: string | null;
      tableId?: number;
      sessionId?: number | null;
      items: { productId: number; quantity: number; notes?: string }[];
      notes?: string;
      loyaltyVoucherCodes?: string[];
      loyaltySelection?: Record<string, number>;
      paymentMethod?: string;
      paymentScreenshot?: string;
      paymentConfirmed?: boolean;
      overrideStock?: boolean;
      orderType?: string;
      deliveryAddress?: string | null;
      loyaltyAssignments?: { productId: number; quantity: number; loyaltyCardIds: number[]; quantitiesPerCard: number[] }[];
      discountRate?: number;
      discountReason?: string;
    };

    if (!customerName || !items || items.length === 0) {
      return badRequest('Missing required fields');
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

    let itemsSubtotal = 0;
    const resolvedByItem: ResolvedSelection[][] = [];
    // Priced from the database, for the loyalty calculation below.
    const discountLineItems: CartLineItem[] = [];
    const orderItemsData: {
      productId: number;
      quantity: number;
      unitPrice: number;
      subtotal: number;
      notes?: string;
      selections?: string;
    }[] = [];
    for (const item of items) {
      const product = productMap.get(item.productId);
      if (!product) throw new Error(`Product ${item.productId} not found`);

      // Server-side resolution of size/temp/add-on selections: official names,
      // prices and recipe multipliers come from the database, never the client.
      const resolved = await resolveSelections(item.productId, (item as any).optionIds);
      resolvedByItem.push(resolved);

      const unitPrice = product.price + selectionsPriceAdder(resolved);
      const subtotal = unitPrice * item.quantity;
      itemsSubtotal += subtotal;
      discountLineItems.push({
        productId: item.productId,
        price: unitPrice,
        quantity: item.quantity,
        categoryId: product.categoryId,
      });
      orderItemsData.push({
        productId: item.productId,
        quantity: item.quantity,
        unitPrice,
        subtotal,
        notes: item.notes,
        ...(resolved.length > 0 && {
          selections: JSON.stringify(
            resolved.map((r) => ({
              optionId: r.optionId,
              groupName: r.groupName,
              name: r.name,
              priceDelta: r.priceDelta,
              ingredientDeltas: r.ingredientDeltas,
            }))
          ),
        }),
      });
    }

    // Apply a percentage discount (e.g., Student / PWD statutory discount)
    // configured in BIR Business Settings. The rate comes from the client but
    // the monetary amount is recomputed server-side from the order total.
    const appliedDiscountRate = discountRate && discountRate > 0 ? discountRate : 0;
    const appliedDiscountReason = appliedDiscountRate > 0 && discountReason ? discountReason : null;

    const voucherCodes = [...new Set((loyaltyVoucherCodes ?? []).filter((c) => typeof c === 'string' && c.trim()))];

    // Create order, redeem rewards & deduct inventory in a transaction
    const order = await prisma.$transaction(async (tx) => {
      // The loyalty discount is derived here — from the vouchers as stored and
      // from prices resolved above — and never from a client-supplied amount.
      // Read inside the transaction so a voucher cannot be spent twice by two
      // terminals scanning the same card at once.
      let loyaltyDiscount = 0;
      const vouchers = voucherCodes.length > 0
        ? await tx.loyaltyVoucher.findMany({ where: { code: { in: voucherCodes } } })
        : [];

      if (voucherCodes.length > 0) {
        const missing = voucherCodes.filter((code) => !vouchers.some((v) => v.code === code));
        if (missing.length > 0) {
          throw new LoyaltyVoucherError(missing.map((code) => `Reward ${code} was not found.`));
        }

        const result = loyaltyDiscountFor(vouchers, {
          items: discountLineItems,
          selection: loyaltySelection,
          now: new Date(),
        });
        if (result.rejections.length > 0) {
          throw new LoyaltyVoucherError(result.rejections);
        }
        loyaltyDiscount = result.discount;
      }

      const isLoyaltyOrder = loyaltyDiscount > 0;
      let totalAmount = Math.max(0, itemsSubtotal - loyaltyDiscount);
      let appliedDiscountAmount = 0;
      if (appliedDiscountRate > 0) {
        appliedDiscountAmount = Math.round(totalAmount * appliedDiscountRate / 100 * 100) / 100;
        totalAmount = Math.max(0, totalAmount - appliedDiscountAmount);
      }

      // Daily sequential ticket: ORD-MMDDYY-A001 → A999 → B001…, restarting
      // at A001 each calendar day. Computed inside the transaction so two
      // terminals placing orders at the same moment can't draw one code.
      const datePart = ticketDatePart(new Date());
      const todaysOrders = await tx.order.findMany({
        where: { orderNumber: { startsWith: `ORD-${datePart}-` } },
        select: { orderNumber: true },
      });
      const seq = nextSequenceForDay(todaysOrders.map((o) => o.orderNumber));
      const orderNumber = fullOrderNumber(datePart, seq.letter, seq.num);
      const barcodeValue = `CAFE-${orderNumber}`;
      // Position within today's sequence; keeps any legacy internal sorting
      // by queueNumber aligned with the ticket codes staff actually see.
      const queueNumber = sequenceValue(seq);

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
          discountAmount: appliedDiscountAmount,
          discountReason: appliedDiscountReason,
          discountRate: appliedDiscountRate > 0 ? appliedDiscountRate : null,
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

      // Spend the rewards that paid for the discount above, in this same
      // transaction: a voucher can never stay reusable while its discount has
      // already been given away. The status/usedCount guard makes the write
      // lose the race rather than double-spend, and losing rolls the order back.
      for (const voucher of vouchers) {
        const usedCount = voucher.usedCount + 1;
        const fullyUsed = usedCount >= voucher.maxRedemptions;
        const spent = await tx.loyaltyVoucher.updateMany({
          where: { code: voucher.code, status: 'ACTIVE', usedCount: voucher.usedCount },
          data: {
            usedCount,
            status: fullyUsed ? 'REDEEMED' : 'ACTIVE',
            redeemedDate: fullyUsed ? new Date() : null,
            redeemedOrderId: newOrder.id,
          },
        });
        if (spent.count !== 1) {
          throw new LoyaltyVoucherError([
            `Reward ${voucher.code} was just used somewhere else. Nothing has been charged — please try again.`,
          ]);
        }
      }

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
      // negative (spec section 3).
      for (const [itemIdx, item] of items.entries()) {
        // Per-ingredient deltas from selected options (e.g. Large adds +8g beans).
        const optionDeltas = selectionsIngredientDeltas(resolvedByItem[itemIdx] ?? []);
        const productIngredients = await tx.productIngredient.findMany({
          where: { productId: item.productId },
          include: { ingredient: true },
        });
        for (const pi of productIngredients) {
          const delta = optionDeltas.get(pi.ingredientId) ?? 0;
          const totalNeeded = item.quantity * (pi.quantity + delta);
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
                notes: `Order ${newOrder.orderNumber}${selectionsLabel(resolvedByItem[itemIdx] ?? [])}`,
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
                  notes: `Order ${newOrder.orderNumber}${selectionsLabel(resolvedByItem[itemIdx] ?? [])} (optional, partial)`,
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
        where: { customerName: normalizedName, categoryId: 1 },
      });
      if (!existingCard) {
        await tx.loyaltyCard.create({
          data: {
            customerName: normalizedName,
            categoryId: 1,
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
      details: { orderNumber: order.orderNumber, customerName, totalAmount: order.totalAmount, itemCount: items.length },
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

    // Loyalty award. If the order carries per-item loyalty assignments, credit
    // those specific cards. Otherwise, for paid (terminal) orders, auto-award
    // one point per eligible coffee to the named customer. The two paths are
    // mutually exclusive so an order is never awarded twice.
    const loyaltyFailure = await runRecoverableStep(
      'LOYALTY_AWARD',
      { orderId: order.id, orderNumber: order.orderNumber, customerName: order.customerName },
      async () => {
        if (loyaltyAssignments && loyaltyAssignments.length > 0) {
          await awardLoyaltyToSpecificCards({
            loyaltyAssignments,
            customerName,
            orderId: order.id,
          });
        } else if (paymentConfirmed === true) {
          await awardLoyaltyForPaidOrder({
            id: order.id,
            loyaltyPromo: order.loyaltyPromo,
            loyaltyCustomerName: order.loyaltyCustomerName,
            customerName: order.customerName,
            orderNumber: order.orderNumber,
            totalAmount: Number(order.totalAmount),
            items: order.items,
          });
        }
      },
    );

    return NextResponse.json(
      {
        ...order,
        estimatedTimes: perStation,
        estimatedWait: maxWait,
        ...(loyaltyFailure
          ? { warnings: ['The order was placed, but loyalty points were not added. Add them by hand from the Loyalty page.'] }
          : {}),
      },
      { status: 201 },
    );
  } catch (e) {
    if (e instanceof LoyaltyVoucherError) {
      return NextResponse.json(
        { error: `${e.reasons.join(' ')} Your order was not placed — nothing has been charged.` },
        { status: 409 },
      );
    }
    if (e instanceof InsufficientStockError) {
      const names = e.items.map((i) => i.name).join(', ');
      return NextResponse.json(
        { error: `Sorry, these items are no longer available: ${names}. Your order was not placed — nothing has been charged.` },
        { status: 409 },
      );
    }
    return serverError(e, 'Failed to create order');
  }
}
