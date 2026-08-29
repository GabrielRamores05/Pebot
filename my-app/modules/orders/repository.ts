 
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
