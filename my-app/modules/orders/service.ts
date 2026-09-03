import { z } from 'zod';
import { fromZodError } from 'zod-validation-error';
import {
  ListOrdersInputSchema,
  CreateOrderInputSchema,
  UpdateOrderInputSchema,
  OrderMessageInputSchema,
} from '@/modules/orders/schema';
import * as repo from '@/modules/orders/repository';
import { emitEvent } from '@/lib/socket';
import { logAction } from '@/lib/audit-log';
import { calculateOrderWaitTime, calculateStationWaitTime } from '@/lib/waitTime';
import { runRecoverableStep } from '@/lib/recoverable';
import { awardLoyaltyForPaidOrder, awardLoyaltyToSpecificCards, refundLoyaltyForCancelledOrder } from '@/lib/loyalty-award';
import { resolveSelections, selectionsPriceAdder, selectionsLabel } from '@/lib/product-options';
import { loyaltyDiscountFor } from '@/lib/loyalty-redemption';
import { getSellableQuantity } from '@/lib/availability';
import { normalizeMemberName } from '@/lib/loyalty-utils';
import { getAuthUser, requireRole } from '@/lib/auth';
import type { ResolvedSelection } from '@/lib/product-options';

function parseInput<T>(schema: z.ZodSchema<T>, input: unknown): T {
  const result = schema.safeParse(input);
  if (!result.success) {
    throw fromZodError(result.error);
  }
  return result.data;
}

function setErrorStatus(e: Error, status: number): Error {
  (e as unknown as { status: number }).status = status;
  return e;
}

const LOCATION_ID = 1;

// ---------------------------------------------------------------------------
// List orders
// ---------------------------------------------------------------------------

export async function listOrders(input: unknown) {
  const data = parseInput(ListOrdersInputSchema, input);
  const where: Record<string, unknown> = {};

  if (data.status && data.status !== 'ALL') {
    where.status = data.status;
  }

  if (!data.all) {
    const threeDaysAgo = new Date();
    threeDaysAgo.setDate(threeDaysAgo.getDate() - 3);
    where.createdAt = { gte: threeDaysAgo };
  }

  if (data.search) {
    where.OR = [
      { orderNumber: { contains: data.search } },
      { customerName: { contains: data.search } },
    ];
  }

  return repo.findOrders(where, LOCATION_ID, {
    include: {
      items: { include: { product: true } },
      table: true,
      payment: true,
      messages: { orderBy: { createdAt: 'asc' } },
    },
    orderBy: { createdAt: 'desc' },
    take: data.all ? 10000 : 200,
  });
}

// ---------------------------------------------------------------------------
// Tablet ingest (spec 013 Phase 2) — a paired tablet posts an order; the PC
// resolves products/options/tables by NAME (device id spaces differ), then runs
// the exact same createOrder path so totals, vouchers, loyalty, stock and the
// receipt sequence are all derived server-side. Never trust client pesos: the
// payload carries only identities (product/option names, discount reason).
// ---------------------------------------------------------------------------

export async function ingestTabletOrder(payload: Record<string, unknown>) {
  const rawItems = (payload.items as Array<Record<string, unknown>> | undefined) ?? [];
  if (rawItems.length === 0) throw setErrorStatus(new Error('At least one item is required'), 400);

  const names = rawItems.map((i) => String(i.productName ?? '')).filter((n) => n.length > 0);
  const found = await repo.findProductsByNames(names);
  const productByName = new Map(found.map((p: any) => [p.name, p]));

  const items: { productId: number; quantity: number; notes?: string; optionIds?: number[] }[] = [];
  for (const raw of rawItems) {
    const product = productByName.get(String(raw.productName ?? ''));
    if (!product) {
      throw setErrorStatus(new Error(`Product "${String(raw.productName ?? '')}" is not on the café menu`), 409);
    }
    const quantity = Number(raw.quantity);
    if (!Number.isInteger(quantity) || quantity <= 0) {
      throw setErrorStatus(new Error('Each product must have a valid quantity'), 400);
    }
    const optionIds: number[] = [];
    for (const opt of (raw.options as Array<Record<string, unknown>> | undefined) ?? []) {
      const record = await repo.findProductOptionByName(product.id, String(opt.name ?? ''), String(opt.value ?? ''));
      if (record) optionIds.push(record.id);
    }
    items.push({
      productId: product.id,
      quantity,
      notes: typeof raw.notes === 'string' && raw.notes ? raw.notes : undefined,
      ...(optionIds.length > 0 ? { optionIds } : {}),
    });
  }

  // Table mapping: resolve by the tablet-sent table name when possible.
  const tableName = payload.tableName;
  let tableId: number | undefined;
  if (typeof tableName === 'string' && tableName.trim()) {
    const table = await repo.findRestaurantTableByName(tableName.trim());
    if (table) tableId = table.id;
  }

  // Discount identities only. Student/PWD (settings-driven on both devices) and
  // reward vouchers are re-derived by createOrder server-side.
  const reason = typeof payload.discountReason === 'string' ? payload.discountReason : null;
  const voucherLike = reason && !reason.startsWith('PWD') && !reason.startsWith('STUDENT');
  const input: Record<string, unknown> = {
    customerName: typeof payload.customerName === 'string' && payload.customerName.trim()
      ? payload.customerName.trim()
      : 'Walk-in Customer',
    items,
    orderType: payload.orderType ?? 'DINE_IN',
    deliveryAddress: typeof payload.deliveryAddress === 'string' ? payload.deliveryAddress : null,
    notes: typeof payload.notes === 'string' && payload.notes ? payload.notes : undefined,
    paymentMethod: String(payload.paymentMethod ?? 'CASH').toUpperCase() === 'PAYMAYA' ? 'MAYA' : String(payload.paymentMethod ?? 'CASH').toUpperCase(),
    paymentConfirmed: true,
    ...(tableId ? { tableId } : {}),
    ...(payload.loyaltyCustomerName ? { loyaltyCustomerName: payload.loyaltyCustomerName } : {}),
  };
  if (reason && (reason === 'PWD_DISCOUNT' || reason === 'STUDENT_DISCOUNT' || reason === 'STUDENT_PWD')) {
    input.discountReason = 'STUDENT_PWD';
    input.discountRate = Number(payload.discountRate ?? 0.2);
  } else if (voucherLike && reason) {
    input.loyaltyVoucherCodes = [reason];
  }

  const order = await createOrder(input as any);
  return { ok: true, orderId: order.id, orderNumber: order.orderNumber, totalAmount: Number(order.totalAmount) };
}

// ---------------------------------------------------------------------------
// Create order
// ---------------------------------------------------------------------------

export async function createOrder(input: unknown) {
  const data = parseInput(CreateOrderInputSchema, input);

  const customerName = data.customerName;
  const loyaltyCustomerName = data.loyaltyCustomerName?.trim() ? data.loyaltyCustomerName.trim().toUpperCase() : null;
  const tableId = data.tableId ?? null;
  const sessionId = data.sessionId ?? null;
  const orderTypeValue = data.orderType ?? 'DINE_IN';
  const deliveryAddressValue = data.deliveryAddress?.trim() ? data.deliveryAddress.trim() : null;

  if (orderTypeValue === 'DELIVERY' && !deliveryAddressValue) {
    throw setErrorStatus(new Error('Please enter a delivery address for delivery orders.'), 400);
  }

  const productIds = data.items.map((i) => i.productId);
  const products = await repo.findProductsByIds(productIds, LOCATION_ID);
  const productMap = new Map(products.map((p) => [p.id, p]));

  let itemsSubtotal = 0;
  const resolvedByItem: ResolvedSelection[][] = [];
  const discountLineItems: { productId: number; price: number; quantity: number; categoryId?: number }[] = [];
  const orderItemsData: repo.CreateOrderTxItem[] = [];
  const affectedProductIds: number[] = [];

  for (const item of data.items) {
    const product = productMap.get(item.productId);
    if (!product) throw new Error(`Product ${item.productId} not found`);

    const resolved = await resolveSelections(item.productId, (item as any).optionIds);
    resolvedByItem.push(resolved);

    const unitPrice = Number(product.price) + selectionsPriceAdder(resolved);
    const subtotal = unitPrice * item.quantity;
    itemsSubtotal += subtotal;
    discountLineItems.push({
      productId: item.productId,
      price: unitPrice,
      quantity: item.quantity,
      categoryId: product.categoryId,
    });
    affectedProductIds.push(item.productId);
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
          })),
        ),
      }),
    });
  }

  const voucherCodes = [...new Set((data.loyaltyVoucherCodes ?? []).filter((c) => typeof c === 'string' && c.trim()))];

  const order = await repo.createOrder({
    customerName,
    loyaltyCustomerName,
    tableId,
    sessionId,
    totalAmount: itemsSubtotal,
    paymentMethod: data.paymentMethod ?? 'CASH',
    paymentScreenshot: data.paymentScreenshot ?? null,
    orderType: orderTypeValue,
    deliveryAddress: deliveryAddressValue,
    notes: data.notes,
    loyaltyVoucherCodes: voucherCodes,
    loyaltySelection: data.loyaltySelection,
    loyaltyAssignments: data.loyaltyAssignments ?? undefined,
    discountAmount: 0,
    discountRate: data.discountRate ?? 0,
    discountReason: data.discountRate && data.discountRate > 0 && data.discountReason ? data.discountReason : null,
    orderItemsData,
    discountLineItems,
    affectedProductIds: [...new Set(affectedProductIds)],
    resolvedByItem,
    overrideStock: data.overrideStock ?? false,
    locationId: LOCATION_ID,
  });

  // Compute wait times
  const orderItemStations = data.items.map((item) => {
    const product = productMap.get(item.productId)!;
    return {
      stationType: product.stationType,
      prepTimeMinutes: product.prepTimeMinutes,
      quantity: item.quantity,
    };
  });

  const { perStation, maxWait } = await calculateOrderWaitTime(orderItemStations, order.createdAt);

  emitEvent('new-order', { ...order, estimatedTimes: perStation, estimatedWait: maxWait });
  emitEvent('queue-update', { type: 'new_order', queueNumber: order.queueNumber });
  emitEvent('inventory-update', { productIds });
  emitEvent('ingredients-update', []);

  await logAction({
    action: 'ORDER_CREATE',
    resource: 'order',
    resourceId: order.id,
    details: { orderNumber: order.orderNumber, customerName, totalAmount: order.totalAmount, itemCount: data.items.length },
  });

  // Check low-stock
  const inventories = await repo.findLowStockItems(productIds, LOCATION_ID);
  const lowStock = inventories.filter((inv: any) => {
    const qty = inv.quantity ?? 0;
    const threshold = inv.product?.lowStockThreshold ?? 0;
    return qty <= threshold;
  });
  if (lowStock.length > 0) {
    emitEvent('low-stock-alert', lowStock);
  }

  // Award loyalty (recoverable — order placement is committed, loyalty is best-effort)
  const loyaltyFailure = await runRecoverableStep(
    'LOYALTY_AWARD',
    { orderId: order.id, orderNumber: order.orderNumber, customerName: order.customerName },
    async () => {
      if (data.loyaltyAssignments && data.loyaltyAssignments.length > 0) {
        await awardLoyaltyToSpecificCards({
          loyaltyAssignments: data.loyaltyAssignments,
          customerName,
          orderId: order.id,
        });
      } else if (data.paymentConfirmed === true) {
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

  return {
    ...order,
    estimatedTimes: perStation,
    estimatedWait: maxWait,
    ...(loyaltyFailure
      ? { warnings: ['The order was placed, but loyalty points were not added. Add them by hand from the Loyalty page.'] }
      : {}),
  };
}

// ---------------------------------------------------------------------------
// Get single order
// ---------------------------------------------------------------------------

export async function getOrder(idOrNumber: string) {
  const order = await repo.findOrderByNumberOrId(idOrNumber, LOCATION_ID);
  if (!order) {
    throw setErrorStatus(new Error('Order not found'), 404);
  }
  return order;
}

// ---------------------------------------------------------------------------
// Update order
// ---------------------------------------------------------------------------

export async function updateOrder(idOrNumber: string, input: unknown) {
  const data = parseInput(UpdateOrderInputSchema, input);

  const existing = await repo.findOrderForMessage(idOrNumber);
  if (!existing) {
    throw setErrorStatus(new Error('Order not found'), 404);
  }

  const bodyKeys = Object.keys(data);
  const isCustomerCancel =
    bodyKeys.length === 1 && bodyKeys[0] === 'status' && data.status === 'CANCELLED';

  const orderId = existing.id;
  const existingStatus = existing.status;

  if (data.status === 'CANCELLED' && existingStatus !== 'PENDING') {
    throw setErrorStatus(new Error('Only pending orders can be cancelled'), 400);
  }

  const updateData: Record<string, unknown> = {};
  if (data.status) updateData.status = data.status;
  if (data.tableId !== undefined) updateData.tableId = data.tableId;

  const addItems = data.addItems;
  const isPaymentConfirmation = data.paymentConfirmed === true ||
    (data.status === 'PREPARING' && existingStatus === 'PENDING');
  const isCancel = data.status === 'CANCELLED' && existingStatus !== 'CANCELLED';
  const isStatusTransitionActive =
    (data.status === 'COMPLETED' || data.status === 'CANCELLED') && existingStatus !== data.status;

  const order = await repo.updateOrderInTransaction({
    orderId,
    updateData,
    addItems,
    isPaymentConfirmation,
    isCancel,
    isStatusTransitionActive,
    locationId: LOCATION_ID,
  });

  let loyaltyFailure: string | null = null;
  if (isPaymentConfirmation) {
    loyaltyFailure = await runRecoverableStep(
      'LOYALTY_AWARD',
      { orderId: order.id, orderNumber: order.orderNumber, customerName: order.customerName },
      async () => {
        await awardLoyaltyForPaidOrder({
          id: order.id,
          loyaltyPromo: order.loyaltyPromo,
          loyaltyCustomerName: order.loyaltyCustomerName,
          customerName: order.customerName,
          orderNumber: order.orderNumber,
          totalAmount: Number(order.totalAmount),
          items: order.items,
        });
      },
    );
  }

  if (isCancel) {
    await refundLoyaltyForCancelledOrder(orderId);
  }

  // Broadcast events
  emitEvent('order-status-update', order);
  emitEvent('order-status-update', order, `order-${order.orderNumber}`);

  if (isStatusTransitionActive) {
    emitEvent('queue-update', { type: 'resequenced' });
  }

  if (data.status === 'COMPLETED') {
    emitEvent('analytics-update', { type: 'order-completed', order });
    emitEvent('order-completed-notification', {
      customerName: order.customerName,
      orderNumber: order.orderNumber,
      orderId: order.id,
      totalAmount: order.totalAmount,
    }, `customer-${order.customerName}`);
  }

  if (isCancel) {
    const productIds = existing.items?.map((i: { productId: number }) => i.productId) ?? [];
    emitEvent('inventory-update', { productIds });
    emitEvent('ingredients-update', []);
    await logAction({
      action: 'ORDER_CANCEL',
      resource: 'order',
      resourceId: orderId,
      details: { orderNumber: order.orderNumber, previousStatus: existingStatus },
    });
  }

  if (existing.tableId) {
    emitEvent('table-update', { tableId: existing.tableId });
  }

  return {
    ...order,
    ...(loyaltyFailure
      ? { warnings: ['Payment was recorded, but loyalty points were not added. Add them by hand from the Loyalty page.'] }
      : {}),
  };
}

// ---------------------------------------------------------------------------
// Follow-up
// ---------------------------------------------------------------------------

export async function followUp(idOrNumber: string) {
  const order = await repo.findOrderForFollowUp(idOrNumber);

  if (!order) {
    throw setErrorStatus(new Error('Order not found'), 404);
  }

  if (order.status === 'COMPLETED' || order.status === 'CANCELLED') {
    throw setErrorStatus(new Error(`Order is already ${order.status.toLowerCase()}`), 400);
  }

  const tableName = order.table?.name || 'No table';

  emitEvent('order-followup', {
    orderId: order.id,
    orderNumber: order.orderNumber,
    customerName: order.customerName,
    tableName,
  });

  return { ok: true };
}

// ---------------------------------------------------------------------------
// Messages
// ---------------------------------------------------------------------------

export async function listMessages(idOrNumber: string) {
  const order = await repo.findOrderForMessage(idOrNumber);
  if (!order) {
    throw setErrorStatus(new Error('Order not found'), 404);
  }
  return repo.findOrderMessages(order.id);
}

export async function createMessage(idOrNumber: string, input: unknown, req: unknown) {
  const data = parseInput(OrderMessageInputSchema, input);

  const order = await repo.findOrderForMessage(idOrNumber);
  if (!order) {
    throw setErrorStatus(new Error('Order not found'), 404);
  }

  if (order.status === 'COMPLETED' || order.status === 'CANCELLED') {
    throw setErrorStatus(new Error('Cannot send message for completed or cancelled order'), 400);
  }

  const staffUser = await getAuthUser(req as any);
  const messageSender =
    staffUser && requireRole(staffUser, ['ADMIN', 'STAFF', 'KITCHEN'])
      ? staffUser.name
      : order.customerName || 'customer';

  const message = await repo.createOrderMessage({
    orderId: order.id,
    type: data.type,
    content: data.content.trim(),
    sender: messageSender,
  });

  const payload = {
    ...message,
    orderNumber: order.orderNumber,
    customerName: order.customerName,
  };
  emitEvent('order-message', payload);
  emitEvent('order-message', payload, `order-${order.orderNumber}`);

  return message;
}

// ---------------------------------------------------------------------------
// Wait time
// ---------------------------------------------------------------------------

export async function getWaitTime(idOrNumber: string) {
  const order = await repo.findOrderForWaitTime(idOrNumber);
  if (!order) {
    throw setErrorStatus(new Error('Order not found'), 404);
  }

  const stationItems = new Map<string, number>();
  for (const item of order.items) {
    const st = item.product.stationType;
    const prep = item.product.prepTimeMinutes * item.quantity;
    stationItems.set(st, (stationItems.get(st) || 0) + prep);
  }

  const estimatedTimes: Record<string, number> = {};
  for (const [st, ownPrep] of stationItems) {
    const queueWait = await calculateStationWaitTime(st, order.createdAt);
    const station = await repo.findStaffStationControl(st);
    const staffCount = Math.max(station?.staffCount ?? 1, 1);
    estimatedTimes[st] = queueWait + Math.ceil(ownPrep / staffCount);
  }

  const maxWait = Math.max(...Object.values(estimatedTimes), 0);
  const queuePosition = await repo.countActiveOrdersCreatedBefore(order.createdAt, LOCATION_ID);

  return {
    estimatedTimes,
    estimatedWait: maxWait,
    queuePosition: queuePosition + 1,
    queueNumber: order.queueNumber,
  };
}
