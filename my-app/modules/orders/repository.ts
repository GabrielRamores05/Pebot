 
import { prisma } from '@/lib/prisma';

// ---------------------------------------------------------------------------
// Orders – location-scoped helpers
// Every finder/creator that touches a location-owned table merges locationId.
// PaymentTransaction and OrderMessage have no locationId column (they are
// children of Order), so location scoping is via the parent Order where needed.
// ---------------------------------------------------------------------------

export async function findOrders(
  where: Record<string, unknown> = {},
  locationId: number = 1,
  options: {
    include?: Record<string, unknown>;
    orderBy?: Record<string, unknown>;
    take?: number;
  } = {},
): Promise<any> {
  return (prisma.order.findMany as any)({
    where: { locationId, ...where },
    ...(options.include ? { include: options.include } : {}),
    ...(options.orderBy ? { orderBy: options.orderBy } : {}),
    ...(options.take ? { take: options.take } : {}),
  });
}

export async function findOrdersWithDetails(
  where: Record<string, unknown>,
  locationId: number = 1,
) {
  return prisma.order.findMany({
    where: { locationId, ...where },
    include: {
      items: { include: { product: true } },
      table: true,
      payment: true,
      messages: { orderBy: { createdAt: 'asc' } },
    },
    orderBy: { createdAt: 'desc' },
  });
}

// Convenience used by analytics (date range + status)
export async function findOrdersInDateRange(
  where: Record<string, unknown>,
  locationId: number = 1,
  include: Record<string, unknown> = {},
) {
  return prisma.order.findMany({
    where: { locationId, ...where },
    ...(Object.keys(include).length ? { include } : {}),
    orderBy: { createdAt: 'desc' },
  });
}

export async function findOrderById(id: number, locationId: number = 1) {
  return prisma.order.findFirst({
    where: { id, locationId },
    include: {
      items: { include: { product: { include: { category: true } } } },
      table: true,
      payment: true,
    },
  });
}

export async function findOrderByIdSimple(id: number, locationId: number = 1) {
  return prisma.order.findFirst({ where: { id, locationId } });
}

// ----- Tablet ingest lookups (spec 013 Phase 2): resolve by name because id
// ----- spaces differ between devices -----
export async function findProductsByNames(names: string[], locationId: number = 1) {
  if (names.length === 0) return [];
  return prisma.product.findMany({ where: { name: { in: names }, locationId } as any });
}

export async function findProductOptionByName(productId: number, groupName: string, optionName: string) {
  const group = await prisma.optionGroup.findFirst({ where: { name: groupName } as any });
  if (!group) return null;
  return prisma.productOption.findFirst({
    where: { productId, groupId: group.id, name: optionName },
  } as any);
}

export async function findRestaurantTableByName(name: string) {
  return prisma.restaurantTable.findFirst({ where: { name } } as any);
}

export async function findOrderByOrderNumber(orderNumber: string, locationId: number = 1) {
  return prisma.order.findFirst({ where: { orderNumber, locationId } });
}

export async function findOrderWithItems(id: number, locationId: number = 1) {
  return prisma.order.findFirst({
    where: { id, locationId },
    include: { table: true, items: true },
  });
}

export async function findOrderForPayment(id: number, locationId: number = 1) {
  return prisma.order.findFirst({ where: { id, locationId } });
}

export async function findOrderWithPaymentDetails(id: number, locationId: number = 1) {
  return prisma.order.findFirst({
    where: { id, locationId },
    include: { items: { include: { product: true } }, table: true, payment: true },
  });
}

// ---------------------------------------------------------------------------
// Products / Inventory (support order creation)
// ---------------------------------------------------------------------------

export async function findProductsByIds(productIds: number[], locationId: number = 1) {
  return prisma.product.findMany({
    where: { id: { in: productIds }, locationId },
    include: { inventory: true },
  });
}

export async function findInventoriesByProductIds(productIds: number[], _locationId: number = 1) {
  // Inventory has no locationId; scoping is via product.locationId, but for
  // repository uniformity we accept locationId and still filter by productIds.
  // Callers that need strict location filtering should use findProductsByIds.
  return prisma.inventory.findMany({
    where: { productId: { in: productIds } },
    include: { product: true },
  });
}

// ---------------------------------------------------------------------------
// PaymentTransaction – no locationId column; scoped via Order if needed
// ---------------------------------------------------------------------------

export async function findPaymentTransactions(
  _locationId: number = 1,
  take: number = 100,
) {
  return prisma.paymentTransaction.findMany({
    include: { order: true },
    orderBy: { createdAt: 'desc' },
    take,
  });
}

export async function createPaymentAndCompleteOrder(
  orderId: number,
  paymentData: { method: string; referenceNo?: string; terminalId?: string; amount?: number },
  locationId: number = 1,
) {
  // Fetch order to derive amount if not supplied, ensuring location scope
  const order = await prisma.order.findFirst({ where: { id: orderId, locationId } });
  if (!order) throw new Error('Order not found');
  const amount = paymentData.amount ?? order.totalAmount;
  return prisma.$transaction(async (tx) => {
    const p = await tx.paymentTransaction.create({
      data: {
        orderId,
        amount,
        method: paymentData.method,
        status: 'COMPLETED',
        referenceNo: paymentData.referenceNo,
        terminalId: paymentData.terminalId,
        processedAt: new Date(),
      },
    });
    await tx.order.update({
      where: { id: orderId },
      data: { status: 'COMPLETED' },
    });
    return p;
  });
}

export async function findOrderAfterPayment(orderId: number, locationId: number = 1) {
  return prisma.order.findFirst({
    where: { id: orderId, locationId },
    include: { items: { include: { product: true } }, table: true, payment: true },
  });
}

export async function findQueuedOrderItemsByStationType(stationType: string, asOf: Date) {
  return prisma.orderItem.findMany({
    where: {
      order: {
        status: { in: ['PENDING', 'PREPARING'] },
        createdAt: { lt: asOf },
      },
      product: {
        stationType: stationType,
      },
    },
    include: { product: { select: { prepTimeMinutes: true } } },
  });
}

// ---------------------------------------------------------------------------
// Generic transaction passthrough (kept for order creation flow that needs tx)
// ---------------------------------------------------------------------------

export async function withTransaction<T>(
  fn: (tx: Parameters<Parameters<typeof prisma.$transaction>[0]>[0]) => Promise<T>,
): Promise<T> {
  return prisma.$transaction(fn as never) as Promise<T>;
}

// ---------------------------------------------------------------------------
// Order lookup helpers (by id or orderNumber)
// ---------------------------------------------------------------------------

export async function findOrderByNumberOrId(idOrNumber: string, locationId: number = 1) {
  const num = Number(idOrNumber);
  return isNaN(num)
    ? prisma.order.findFirst({
        where: { orderNumber: idOrNumber, locationId },
        include: {
          items: { include: { product: { include: { category: true } } } },
          table: true,
          payment: true,
        },
      })
    : prisma.order.findFirst({
        where: { id: num, locationId },
        include: {
          items: { include: { product: { include: { category: true } } } },
          table: true,
          payment: true,
        },
      });
}

export async function findOrderForFollowUp(idOrNumber: string) {
  const num = Number(idOrNumber);
  return isNaN(num)
    ? prisma.order.findFirst({
        where: { orderNumber: idOrNumber },
        include: { table: true },
      })
    : prisma.order.findFirst({
        where: { id: num },
        include: { table: true },
      });
}

export async function findOrderForWaitTime(idOrNumber: string) {
  const num = Number(idOrNumber);
  return isNaN(num)
    ? prisma.order.findFirst({
        where: { orderNumber: idOrNumber },
        include: { items: { include: { product: { select: { stationType: true, prepTimeMinutes: true } } } } },
      })
    : prisma.order.findFirst({
        where: { id: num },
        include: { items: { include: { product: { select: { stationType: true, prepTimeMinutes: true } } } } },
      });
}

export async function findOrderForMessage(idOrNumber: string) {
  const num = Number(idOrNumber);
  return isNaN(num)
    ? prisma.order.findFirst({
        where: { orderNumber: idOrNumber },
        include: { table: true, items: true },
      })
    : prisma.order.findUnique({
        where: { id: num },
        include: { table: true, items: true },
      });
}

// ---------------------------------------------------------------------------
// Order messages
// ---------------------------------------------------------------------------

export async function findOrderMessages(orderId: number) {
  return prisma.orderMessage.findMany({
    where: { orderId },
    orderBy: { createdAt: 'asc' },
  });
}

export interface CreateOrderMessageData {
  orderId: number;
  type: 'text' | 'voice';
  content: string;
  sender: string;
}

export async function createOrderMessage(data: CreateOrderMessageData) {
  return prisma.orderMessage.create({ data });
}

// ---------------------------------------------------------------------------
// Wait-time helpers
// ---------------------------------------------------------------------------

export async function findStaffStationControl(stationType: string) {
  return prisma.staffStationControl.findUnique({ where: { stationType } });
}

export async function countActiveOrdersCreatedBefore(asOf: Date, locationId: number = 1) {
  return prisma.order.count({
    where: {
      status: { in: ['PENDING', 'PREPARING'] },
      createdAt: { lt: asOf },
      locationId,
    },
  });
}

export async function findLowStockItems(productIds: number[], locationId: number = 1) {
  return prisma.inventory.findMany({
    where: { productId: { in: productIds }, product: { locationId } },
    include: { product: true },
  });
}

// ---------------------------------------------------------------------------
// Order creation — full transaction
// ---------------------------------------------------------------------------

export interface CreateOrderTxItem {
  productId: number;
  quantity: number;
  unitPrice: number;
  subtotal: number;
  notes?: string;
  selections?: string;
}

export interface CreateOrderDiscountItem {
  productId: number;
  price: number;
  quantity: number;
  categoryId?: number;
}

export interface CreateOrderParams {
  customerName: string;
  loyaltyCustomerName: string | null;
  tableId: number | null;
  sessionId: number | null;
  totalAmount: number;
  paymentMethod: string;
  paymentScreenshot: string | null;
  orderType: string;
  deliveryAddress: string | null;
  notes?: string;
  loyaltyVoucherCodes: string[];
  loyaltySelection?: Record<string, number>;
  loyaltyAssignments?: {
    productId: number;
    quantity: number;
    loyaltyCardIds: number[];
    quantitiesPerCard: number[];
  }[];
  discountAmount: number;
  discountRate: number;
  discountReason: string | null;
  orderItemsData: CreateOrderTxItem[];
  discountLineItems: CreateOrderDiscountItem[];
  affectedProductIds: number[];
  resolvedByItem: any[];
  overrideStock: boolean;
  locationId: number;
}

export async function createOrder(params: CreateOrderParams): Promise<any> {
  return prisma.$transaction(async (tx) => {
    // Read vouchers inside the transaction so they can't be spent twice
    let loyaltyDiscount = 0;
    const vouchers =
      params.loyaltyVoucherCodes.length > 0
        ? await tx.loyaltyVoucher.findMany({ where: { code: { in: params.loyaltyVoucherCodes } } })
        : [];

    if (params.loyaltyVoucherCodes.length > 0) {
      const missing = params.loyaltyVoucherCodes.filter((code) => !vouchers.some((v) => v.code === code));
      if (missing.length > 0) {
        throw new LoyaltyVoucherError(missing.map((code) => `Reward ${code} was not found.`));
      }

      const { loyaltyDiscountFor } = await import('@/lib/loyalty-redemption');
      const result = loyaltyDiscountFor(vouchers, {
        items: params.discountLineItems as any,
        selection: params.loyaltySelection ?? {},
        now: new Date(),
      });
      if (result.rejections.length > 0) {
        throw new LoyaltyVoucherError(result.rejections);
      }
      loyaltyDiscount = result.discount;
    }

    const isLoyaltyOrder = loyaltyDiscount > 0;
    let amountAfterLoyalty = Math.max(0, params.totalAmount - loyaltyDiscount);
    let appliedDiscountAmount = 0;
    if (params.discountRate > 0) {
      appliedDiscountAmount = Math.round((amountAfterLoyalty * params.discountRate) / 100 * 100) / 100;
      amountAfterLoyalty = Math.max(0, amountAfterLoyalty - appliedDiscountAmount);
    }

    // Generate order number
    const { ticketDatePart, nextSequenceForDay, fullOrderNumber, sequenceValue } = await import('@/lib/ticket');
    const datePart = ticketDatePart(new Date());
    const todaysOrders = await tx.order.findMany({
      where: { orderNumber: { startsWith: `ORD-${datePart}-` } },
      select: { orderNumber: true },
    });
    const seq = nextSequenceForDay(todaysOrders.map((o) => o.orderNumber));
    const orderNumber = fullOrderNumber(datePart, seq.letter, seq.num);
    const barcodeValue = `CAFE-${orderNumber}`;
    const queueNumber = sequenceValue(seq);

    const newOrder = await tx.order.create({
      data: {
        orderNumber,
        customerName: params.customerName,
        loyaltyCustomerName: params.loyaltyCustomerName,
        tableId: params.tableId,
        sessionId: params.sessionId,
        totalAmount: amountAfterLoyalty,
        barcodeValue,
        notes: params.notes,
        discountAmount: appliedDiscountAmount,
        discountReason: params.discountReason,
        discountRate: params.discountRate > 0 ? params.discountRate : null,
        loyaltyPromo: isLoyaltyOrder,
        paymentMethod: params.paymentMethod,
        paymentScreenshot: params.paymentScreenshot,
        orderType: params.orderType,
        deliveryAddress: params.deliveryAddress,
        queueNumber,
        items: { create: params.orderItemsData },
        ...(params.loyaltyAssignments && { loyaltyAssignments: { create: params.loyaltyAssignments } }),
      },
      include: {
        items: { include: { product: true } },
        table: true,
      },
    });

    // Spend the rewards
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

    // Stock check and ingredient consumption
    const { getSellableQuantity } = await import('@/lib/availability');
    const { selectionsIngredientDeltas, selectionsLabel } = await import('@/lib/product-options');
    const unavailable: { productId: number; name: string; requested: number; available: number }[] = [];

    for (const [itemIdx, item] of params.orderItemsData.entries()) {
      const productId = item.productId;
      const available = await getSellableQuantity(tx, productId);
      if (!params.overrideStock && available < item.quantity) {
        const product = params.discountLineItems.find((p) => p.productId === productId);
        unavailable.push({
          productId,
          name: product?.categoryId ? `Item ${productId}` : `Item ${productId}`,
          requested: item.quantity,
          available,
        });
      }
    }
    if (unavailable.length > 0) {
      throw new InsufficientStockError(unavailable);
    }

    // Consume ingredients
    for (const [itemIdx, item] of params.orderItemsData.entries()) {
      const optionDeltas = selectionsIngredientDeltas(params.resolvedByItem[itemIdx] ?? []);
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
              notes: `Order ${newOrder.orderNumber}${selectionsLabel(params.resolvedByItem[itemIdx] ?? [])}`,
            },
          });
        } else {
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
                notes: `Order ${newOrder.orderNumber}${selectionsLabel(params.resolvedByItem[itemIdx] ?? [])} (optional, partial)`,
              },
            });
          }
        }
      }
    }

    // Recompute derived sellable quantities
    const { recomputeProducts } = await import('@/lib/availability');
    await recomputeProducts(tx, params.affectedProductIds);

    // Create loyalty card proactively
    const { normalizeMemberName } = await import('@/lib/loyalty-utils');
    const normalizedName = normalizeMemberName(params.customerName);
    const existingCard = await tx.loyaltyCard.findFirst({
      where: { customerName: normalizedName, categoryId: 1 },
    });
    if (!existingCard) {
      await tx.loyaltyCard.create({
        data: { customerName: normalizedName, categoryId: 1 },
      });
    }

    return newOrder;
  });
}

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

export { LoyaltyVoucherError, InsufficientStockError };

// ---------------------------------------------------------------------------
// Order update — full transaction (status change, add items, cancel restore)
// ---------------------------------------------------------------------------

export interface UpdateOrderParams {
  orderId: number;
  updateData: { status?: string; tableId?: number | null };
  addItems?: { productId: number; quantity: number }[];
  isPaymentConfirmation: boolean;
  isCancel: boolean;
  isStatusTransitionActive: boolean;
  locationId: number;
}

export async function updateOrderInTransaction(params: UpdateOrderParams): Promise<any> {
  return prisma.$transaction(async (tx) => {
    // Add items to existing order (within transaction to keep totals consistent)
    if (params.addItems && params.addItems.length > 0) {
      let extraTotal = 0;
      for (const item of params.addItems) {
        const product = await tx.product.findUnique({ where: { id: item.productId } });
        if (!product) continue;
        const subtotal = Number(product.price) * item.quantity;
        extraTotal += subtotal;
        await tx.orderItem.create({
          data: {
            orderId: params.orderId,
            productId: item.productId,
            quantity: item.quantity,
            unitPrice: product.price,
            subtotal,
          },
        });
      }
      await tx.order.update({
        where: { id: params.orderId },
        data: { totalAmount: { increment: extraTotal } },
      });
    }

    const updated = await tx.order.update({
      where: { id: params.orderId },
      data: params.updateData,
      include: { items: { include: { product: true } }, table: true, payment: true },
    });

    if (params.isCancel) {
      // Restore ingredient stock from the order's usage transactions
      const { productsUsingIngredient, recomputeProducts } = await import('@/lib/availability');
      const usageTxns = await tx.ingredientTransaction.findMany({
        where: { referenceId: params.orderId, referenceType: 'order', type: 'USAGE' },
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
              quantity: restored,
              purchaseCost: null,
              unitCost: null,
              purchaseUnit: null,
              referenceId: params.orderId,
              referenceType: 'order',
              notes: `Order cancelled: stock restored`,
            },
          });
          restoredIngredients.add(t.ingredientId);
        }
      }

      // Recompute derived sellable quantities for affected products
      const affectedProductIds = new Set<number>();
      for (const ingId of restoredIngredients) {
        const pids = await productsUsingIngredient(tx, ingId);
        pids.forEach((p: number) => affectedProductIds.add(p));
      }
      if (affectedProductIds.size > 0) {
        await recomputeProducts(tx, Array.from(affectedProductIds));
      }
    }

    if (params.isStatusTransitionActive) {
      // Re-sequence queue numbers when an order leaves the active queue
      const remainingActive = await tx.order.findMany({
        where: {
          status: { in: ['PENDING', 'PREPARING'] },
          id: { not: params.orderId },
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
}
