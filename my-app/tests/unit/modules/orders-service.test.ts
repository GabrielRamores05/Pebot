import { describe, it, expect, vi, beforeEach } from 'vitest';

const mocks = vi.hoisted(() => ({
  findOrders: vi.fn(),
  findProductsByIds: vi.fn(),
  createOrder: vi.fn(),
  findCheckoutSettings: vi.fn(),
  findOrderByNumberOrId: vi.fn(),
  findOrderForMessage: vi.fn(),
  findOrderForFollowUp: vi.fn(),
  findOrderForWaitTime: vi.fn(),
  findOrderMessages: vi.fn(),
  createOrderMessage: vi.fn(),
  findStaffStationControl: vi.fn(),
  countActiveOrdersCreatedBefore: vi.fn(),
  findLowStockItems: vi.fn(),
  findOrderByIdSimple: vi.fn(),
  findOrderWithPaymentDetails: vi.fn(),
  findQueuedOrderItemsByStationType: vi.fn(),
  updateOrderInTransaction: vi.fn(),
  logAction: vi.fn(),
  emitEvent: vi.fn(),
  resolveSelections: vi.fn(),
  selectionsPriceAdder: vi.fn(),
  selectionsLabel: vi.fn(),
  calculateOrderWaitTime: vi.fn(),
  calculateStationWaitTime: vi.fn(),
  runRecoverableStep: vi.fn(),
  awardLoyaltyForPaidOrder: vi.fn(),
  awardLoyaltyToSpecificCards: vi.fn(),
  refundLoyaltyForCancelledOrder: vi.fn(),
  loyaltyDiscountFor: vi.fn(),
  normalizeMemberName: (v: string) => v.trim().replace(/\s+/g, ' ').toUpperCase(),
  getAuthUser: vi.fn(),
  requireRole: vi.fn(),
  badRequest: (msg: string) => ({ error: msg, status: 400 }),
  notFound: (msg: string) => ({ error: msg, status: 404 }),
  serverError: (e: unknown, msg: string) => ({ error: msg, status: 500 }),
}));

vi.mock('../../../modules/orders/repository', () => ({
  findOrders: mocks.findOrders,
  findProductsByIds: mocks.findProductsByIds,
  createOrder: mocks.createOrder,
  findCheckoutSettings: mocks.findCheckoutSettings,
  findOrderByNumberOrId: mocks.findOrderByNumberOrId,
  findOrderForMessage: mocks.findOrderForMessage,
  findOrderForFollowUp: mocks.findOrderForFollowUp,
  findOrderForWaitTime: mocks.findOrderForWaitTime,
  findOrderMessages: mocks.findOrderMessages,
  createOrderMessage: mocks.createOrderMessage,
  findStaffStationControl: mocks.findStaffStationControl,
  countActiveOrdersCreatedBefore: mocks.countActiveOrdersCreatedBefore,
  findLowStockItems: mocks.findLowStockItems,
  findOrderByIdSimple: mocks.findOrderByIdSimple,
  findOrderWithPaymentDetails: mocks.findOrderWithPaymentDetails,
  findQueuedOrderItemsByStationType: mocks.findQueuedOrderItemsByStationType,
  updateOrderInTransaction: mocks.updateOrderInTransaction,
  CreateOrderTxItem: class {},
  CreateOrderParams: class {},
  UpdateOrderParams: class {},
  UpdateOrderInTransactionParams: class {},
  LoyaltyVoucherError: class extends Error { reasons: string[]; constructor(reasons: string[]) { super(reasons.join(' ')); this.name = 'LoyaltyVoucherError'; this.reasons = reasons; } },
  InsufficientStockError: class extends Error { items: any[]; constructor(items: any[]) { super('One or more items are out of stock'); this.name = 'InsufficientStockError'; this.items = items; } },
}));
vi.mock('@/lib/socket', () => ({ emitEvent: mocks.emitEvent }));
vi.mock('@/lib/audit-log', () => ({ logAction: mocks.logAction }));
vi.mock('@/lib/waitTime', () => ({
  calculateOrderWaitTime: mocks.calculateOrderWaitTime,
  calculateStationWaitTime: mocks.calculateStationWaitTime,
}));
vi.mock('@/lib/recoverable', () => ({ runRecoverableStep: mocks.runRecoverableStep }));
vi.mock('@/lib/loyalty-award', () => ({
  awardLoyaltyForPaidOrder: mocks.awardLoyaltyForPaidOrder,
  awardLoyaltyToSpecificCards: mocks.awardLoyaltyToSpecificCards,
  refundLoyaltyForCancelledOrder: mocks.refundLoyaltyForCancelledOrder,
}));
vi.mock('@/lib/product-options', () => ({
  resolveSelections: mocks.resolveSelections,
  selectionsPriceAdder: mocks.selectionsPriceAdder,
  selectionsLabel: mocks.selectionsLabel,
}));
vi.mock('@/lib/loyalty-redemption', () => ({ loyaltyDiscountFor: mocks.loyaltyDiscountFor }));
vi.mock('@/lib/availability', () => ({
  getSellableQuantity: vi.fn(),
  recomputeProducts: vi.fn(),
  productsUsingIngredient: vi.fn(),
}));
vi.mock('@/lib/loyalty-utils', () => ({
  normalizeMemberName: mocks.normalizeMemberName,
  rewardLabel: (t: string | null | undefined, v: number) => {
    if (t === 'FREE') return 'Free Item';
    if (t === 'PERCENTAGE') return `${v}% Off`;
    return `₱${v} Off`;
  },
  voucherCode: vi.fn(() => 'TEST-CODE'),
  findOrCreateCardData: (cn: string) => ({ customerName: cn, categoryId: null }),
}));
vi.mock('@/lib/auth', () => ({
  getAuthUser: mocks.getAuthUser,
  requireRole: mocks.requireRole,
}));
vi.mock('@/lib/api-response', () => ({
  badRequest: mocks.badRequest,
  notFound: mocks.notFound,
  serverError: mocks.serverError,
}));

import { listOrders, createOrder, getOrder, updateOrder, followUp, listMessages, createMessage, getWaitTime } from '../../../modules/orders/service';
import { LoyaltyVoucherError, InsufficientStockError } from '../../../modules/orders/repository';

describe('orders service', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.resolveSelections.mockResolvedValue([]);
    mocks.selectionsPriceAdder.mockReturnValue(0);
    mocks.loyaltyDiscountFor.mockReturnValue({ discount: 0, rejections: [] });
    mocks.calculateOrderWaitTime.mockResolvedValue({ perStation: {}, maxWait: 5 });
    mocks.calculateStationWaitTime.mockResolvedValue(2);
    mocks.runRecoverableStep.mockResolvedValue(null);
    mocks.findCheckoutSettings.mockResolvedValue({
      vatRegistered: true, vatRate: 12, studentPwdDiscountRate: 20, serviceChargeRate: 0, serviceChargeOrderTypes: 'DINE_IN',
    });
  });

  describe('listOrders', () => {
    it('calls repository with status filter', async () => {
      mocks.findOrders.mockResolvedValue([]);
      await listOrders({ status: 'PENDING' });
      expect(mocks.findOrders).toHaveBeenCalledWith(
        expect.objectContaining({ status: 'PENDING' }), 1, expect.any(Object),
      );
    });

    it('calls repository with search filter', async () => {
      mocks.findOrders.mockResolvedValue([]);
      await listOrders({ search: 'ORD', all: true });
      expect(mocks.findOrders).toHaveBeenCalledWith(
        expect.objectContaining({ OR: [{ orderNumber: { contains: 'ORD' } }, { customerName: { contains: 'ORD' } }] }),
        1,
        expect.any(Object),
      );
    });

    it('does not filter by date when all=true', async () => {
      mocks.findOrders.mockResolvedValue([]);
      await listOrders({ all: true });
      const callArg = mocks.findOrders.mock.calls[0][0];
      expect(callArg.createdAt).toBeUndefined();
    });

    it('filters by date when all is not true', async () => {
      mocks.findOrders.mockResolvedValue([]);
      await listOrders({});
      const callArg = mocks.findOrders.mock.calls[0][0];
      expect(callArg.createdAt).toBeDefined();
    });

    it('passes ALL status without filtering', async () => {
      mocks.findOrders.mockResolvedValue([]);
      await listOrders({ status: 'ALL' });
      const callArg = mocks.findOrders.mock.calls[0][0];
      expect(callArg.status).toBeUndefined();
    });
  });

  describe('createOrder', () => {
    it('throws 400 when delivery address missing', async () => {
      await expect(createOrder({
        customerName: 'John',
        items: [{ productId: 1, quantity: 1 }],
        orderType: 'DELIVERY',
      })).rejects.toMatchObject({ status: 400 });
    });

    it('creates order successfully', async () => {
      mocks.findProductsByIds.mockResolvedValue([
        { id: 1, price: 100, categoryId: 1 },
      ]);
      mocks.createOrder.mockResolvedValue({
        id: 1, orderNumber: 'ORD-082926-A001', customerName: 'John',
        totalAmount: 100, queueNumber: 1, createdAt: new Date(), loyaltyPromo: false,
        loyaltyCustomerName: null, items: [],
      });
      mocks.findLowStockItems.mockResolvedValue([]);

      const result = await createOrder({
        customerName: 'John',
        items: [{ productId: 1, quantity: 2 }],
        paymentMethod: 'CASH',
        orderType: 'DINE_IN',
      });

      expect(mocks.findProductsByIds).toHaveBeenCalled();
      expect(mocks.createOrder).toHaveBeenCalledWith(
        expect.objectContaining({
          customerName: 'John',
          paymentMethod: 'CASH',
          orderType: 'DINE_IN',
        }),
      );
      expect(result.orderNumber).toBe('ORD-082926-A001');
    });

    it('computes total from product price + selections', async () => {
      mocks.findProductsByIds.mockResolvedValue([
        { id: 1, price: 50, categoryId: 1 },
      ]);
      mocks.resolveSelections.mockResolvedValue([{ optionId: 5, groupName: 'size', name: 'Large', priceDelta: 20, ingredientDeltas: [] }]);
      mocks.selectionsPriceAdder.mockReturnValue(20);
      mocks.createOrder.mockResolvedValue({ id: 1, orderNumber: 'TEST', totalAmount: 140, queueNumber: 1, createdAt: new Date(), customerName: 'John', loyaltyPromo: false, loyaltyCustomerName: null, items: [] });
      mocks.findLowStockItems.mockResolvedValue([]);

      await createOrder({
        customerName: 'John',
        items: [{ productId: 1, quantity: 2 }],
        orderType: 'DINE_IN',
      });

      expect(mocks.createOrder).toHaveBeenCalledWith(
        expect.objectContaining({
          totalAmount: 140,
        }),
      );
    });

    it('passes voucher codes through', async () => {
      mocks.findProductsByIds.mockResolvedValue([{ id: 1, price: 100, categoryId: 1 }]);
      mocks.createOrder.mockResolvedValue({ id: 1, orderNumber: 'TEST', totalAmount: 100, queueNumber: 1, createdAt: new Date(), customerName: 'John', loyaltyPromo: false, loyaltyCustomerName: null, items: [] });
      mocks.findLowStockItems.mockResolvedValue([]);

      await createOrder({
        customerName: 'John',
        items: [{ productId: 1, quantity: 1 }],
        orderType: 'DINE_IN',
        loyaltyVoucherCodes: ['VOUCHER1', 'VOUCHER2'],
      });

      expect(mocks.createOrder).toHaveBeenCalledWith(
        expect.objectContaining({
          loyaltyVoucherCodes: ['VOUCHER1', 'VOUCHER2'],
        }),
      );
    });

    it('emits events after order creation', async () => {
      mocks.findProductsByIds.mockResolvedValue([{ id: 1, price: 100, categoryId: 1 }]);
      mocks.createOrder.mockResolvedValue({ id: 1, orderNumber: 'TEST', totalAmount: 100, queueNumber: 1, createdAt: new Date(), customerName: 'John', loyaltyPromo: false, loyaltyCustomerName: null, items: [] });
      mocks.findLowStockItems.mockResolvedValue([]);

      await createOrder({
        customerName: 'John',
        items: [{ productId: 1, quantity: 1 }],
        orderType: 'DINE_IN',
      });

      expect(mocks.emitEvent).toHaveBeenCalledWith('new-order', expect.any(Object));
      expect(mocks.emitEvent).toHaveBeenCalledWith('queue-update', expect.any(Object));
      expect(mocks.logAction).toHaveBeenCalledWith(
        expect.objectContaining({ action: 'ORDER_CREATE', resource: 'order' }),
      );
    });

    it('awards loyalty via recoverable step', async () => {
      mocks.findProductsByIds.mockResolvedValue([{ id: 1, price: 100, categoryId: 1 }]);
      mocks.createOrder.mockResolvedValue({ id: 1, orderNumber: 'TEST', totalAmount: 100, queueNumber: 1, createdAt: new Date(), customerName: 'John', loyaltyPromo: false, loyaltyCustomerName: null, items: [] });
      mocks.findLowStockItems.mockResolvedValue([]);

      await createOrder({
        customerName: 'John',
        items: [{ productId: 1, quantity: 1 }],
        orderType: 'DINE_IN',
        paymentConfirmed: true,
      }, { staff: true });

      expect(mocks.runRecoverableStep).toHaveBeenCalledWith(
        'LOYALTY_AWARD',
        expect.any(Object),
        expect.any(Function),
      );
    });

    it('passes low-stock alert when items are low', async () => {
      mocks.findProductsByIds.mockResolvedValue([{ id: 1, price: 100, categoryId: 1 }]);
      mocks.createOrder.mockResolvedValue({ id: 1, orderNumber: 'TEST', totalAmount: 100, queueNumber: 1, createdAt: new Date(), customerName: 'John', loyaltyPromo: false, loyaltyCustomerName: null, items: [] });
      mocks.findLowStockItems.mockResolvedValue([
        { quantity: 0, product: { lowStockThreshold: 5 } },
      ]);

      await createOrder({
        customerName: 'John',
        items: [{ productId: 1, quantity: 1 }],
        orderType: 'DINE_IN',
      });

      expect(mocks.emitEvent).toHaveBeenCalledWith('low-stock-alert', expect.any(Array));
    });

    it('throws LoyaltyVoucherError from createOrder', async () => {
      mocks.findProductsByIds.mockResolvedValue([{ id: 1, price: 100, categoryId: 1 }]);
      const err = new LoyaltyVoucherError(['Reward not found']);
      mocks.createOrder.mockRejectedValue(err);

      await expect(createOrder({
        customerName: 'John',
        items: [{ productId: 1, quantity: 1 }],
        orderType: 'DINE_IN',
        loyaltyVoucherCodes: ['BADCODE'],
      })).rejects.toThrow('Reward not found');
    });

    it('throws InsufficientStockError from createOrder', async () => {
      mocks.findProductsByIds.mockResolvedValue([{ id: 1, price: 100, categoryId: 1 }]);
      const err = new InsufficientStockError([{ name: 'Coffee', productId: 1, requested: 5, available: 2 }]);
      mocks.createOrder.mockRejectedValue(err);

      await expect(createOrder({
        customerName: 'John',
        items: [{ productId: 1, quantity: 5 }],
        orderType: 'DINE_IN',
      })).rejects.toThrow('One or more items are out of stock');
    });
  });

  describe('createOrder — discounts, service charge and cash drawer (spec 017)', () => {
    const placed = { id: 1, orderNumber: 'TEST', totalAmount: 80, queueNumber: 1, createdAt: new Date(), customerName: 'Lola', loyaltyPromo: false, loyaltyCustomerName: null, items: [] };
    const senior = { kind: 'STATUTORY' as const, diners: 1, holders: [{ type: 'SENIOR' as const, name: 'Lola Remedios', idNumber: 'OSCA-123' }] };

    beforeEach(() => {
      mocks.findProductsByIds.mockResolvedValue([{ id: 1, price: 112, categoryId: 1, vatExempt: false }]);
      mocks.createOrder.mockResolvedValue(placed);
      mocks.findLowStockItems.mockResolvedValue([]);
    });

    it.each([
      ['discount', { discount: senior }],
      ['discountRate', { discountRate: 100, discountReason: 'STUDENT_PWD' }],
      ['paymentConfirmed', { paymentConfirmed: true }],
      ['overrideStock', { overrideStock: true }],
    ])('refuses %s from a customer who is not signed in', async (_field, extra) => {
      await expect(
        createOrder({ customerName: 'Guest', items: [{ productId: 1, quantity: 1 }], ...extra }),
      ).rejects.toMatchObject({ status: 403 });
      expect(mocks.createOrder).not.toHaveBeenCalled();
    });

    it('still accepts a plain QR order from a customer', async () => {
      await createOrder({ customerName: 'Guest', items: [{ productId: 1, quantity: 1 }] });
      expect(mocks.createOrder).toHaveBeenCalled();
    });

    it('passes a Senior Citizen discount with the holder recorded', async () => {
      await createOrder(
        { customerName: 'Lola', items: [{ productId: 1, quantity: 1 }], discount: senior, paymentMethod: 'CASH', paymentConfirmed: true },
        { staff: true },
      );
      const params = mocks.createOrder.mock.calls[0][0];
      expect(params.checkout).toEqual({
        lines: [{ amount: 112, vatExempt: false }],
        discount: { kind: 'SENIOR', holders: 1, diners: 1 },
        vatRegistered: true,
        vatRate: 12,
        serviceChargeRate: 0,
      });
      expect(params.discountReason).toBe('SENIOR');
      expect(params.discountRate).toBe(20);
      expect(JSON.parse(params.discountHolders)).toEqual([{ type: 'SENIOR', name: 'Lola Remedios', idNumber: 'OSCA-123' }]);
      expect(params.countInDrawer).toBe(true);
      expect(params.paid).toBe(true);
    });

    it('records a table with both a senior and a PWD as SENIOR_PWD', async () => {
      const both = { kind: 'STATUTORY' as const, diners: 4, holders: [senior.holders[0], { type: 'PWD' as const, name: 'Ben', idNumber: 'PWD-9' }] };
      await createOrder({ customerName: 'Table 3', items: [{ productId: 1, quantity: 1 }], discount: both }, { staff: true });
      const params = mocks.createOrder.mock.calls[0][0];
      expect(params.discountReason).toBe('SENIOR_PWD');
      expect(params.checkout.discount).toEqual({ kind: 'SENIOR', holders: 2, diners: 4 });
    });

    it('refuses a Senior/PWD discount together with a loyalty reward', async () => {
      await expect(
        createOrder(
          { customerName: 'Lola', items: [{ productId: 1, quantity: 1 }], discount: senior, loyaltyVoucherCodes: ['R1'] },
          { staff: true },
        ),
      ).rejects.toMatchObject({ status: 400 });
    });

    it('refuses more ID holders than diners', async () => {
      const crowd = { ...senior, diners: 1, holders: [senior.holders[0], senior.holders[0]] };
      await expect(
        createOrder({ customerName: 'Lola', items: [{ productId: 1, quantity: 1 }], discount: crowd }, { staff: true }),
      ).rejects.toMatchObject({ status: 400 });
    });

    it('uses the owner rate for a Student discount', async () => {
      mocks.findCheckoutSettings.mockResolvedValue({ vatRegistered: true, vatRate: 12, studentPwdDiscountRate: 10, serviceChargeRate: 0, serviceChargeOrderTypes: 'DINE_IN' });
      await createOrder({ customerName: 'Kim', items: [{ productId: 1, quantity: 1 }], discount: { kind: 'STUDENT' } }, { staff: true });
      const params = mocks.createOrder.mock.calls[0][0];
      expect(params.checkout.discount).toEqual({ kind: 'STUDENT', rate: 10 });
      expect(params.discountReason).toBe('STUDENT');
    });

    it('applies the service charge only to the configured order types', async () => {
      mocks.findCheckoutSettings.mockResolvedValue({ vatRegistered: true, vatRate: 12, studentPwdDiscountRate: 20, serviceChargeRate: 10, serviceChargeOrderTypes: 'DINE_IN' });
      await createOrder({ customerName: 'A', items: [{ productId: 1, quantity: 1 }], orderType: 'DINE_IN' });
      await createOrder({ customerName: 'B', items: [{ productId: 1, quantity: 1 }], orderType: 'TAKEOUT' });
      expect(mocks.createOrder.mock.calls[0][0].checkout.serviceChargeRate).toBe(10);
      expect(mocks.createOrder.mock.calls[1][0].checkout.serviceChargeRate).toBe(0);
    });

    it('does not count unpaid or non-cash orders in the drawer', async () => {
      await createOrder({ customerName: 'Guest', items: [{ productId: 1, quantity: 1 }], paymentMethod: 'CASH' });
      await createOrder({ customerName: 'G', items: [{ productId: 1, quantity: 1 }], paymentMethod: 'GCASH', paymentConfirmed: true }, { staff: true });
      expect(mocks.createOrder.mock.calls[0][0].countInDrawer).toBe(false);
      expect(mocks.createOrder.mock.calls[1][0].countInDrawer).toBe(false);
    });

    it('does not count tablet imports in this PC’s drawer', async () => {
      await createOrder(
        { customerName: 'T', items: [{ productId: 1, quantity: 1 }], paymentMethod: 'CASH', paymentConfirmed: true },
        { staff: true, source: 'tablet' },
      );
      expect(mocks.createOrder.mock.calls[0][0].countInDrawer).toBe(false);
    });
  });

  describe('getOrder', () => {
    it('returns order when found', async () => {
      mocks.findOrderByNumberOrId.mockResolvedValue({ id: 1, orderNumber: 'ORD-001' });
      const result = await getOrder('1');
      expect(result.id).toBe(1);
    });

    it('throws 404 when order not found', async () => {
      mocks.findOrderByNumberOrId.mockResolvedValue(null);
      await expect(getOrder('999')).rejects.toMatchObject({ status: 404 });
    });
  });

  describe('updateOrder', () => {
    it('throws 404 when order not found', async () => {
      mocks.findOrderForMessage.mockResolvedValue(null);
      await expect(updateOrder('999', { status: 'COMPLETED' })).rejects.toMatchObject({ status: 404 });
    });

    it('throws 400 when cancelling non-pending order', async () => {
      mocks.findOrderForMessage.mockResolvedValue({ id: 1, status: 'PREPARING' });
      await expect(updateOrder('1', { status: 'CANCELLED' })).rejects.toMatchObject({ status: 400 });
    });

    it('updates order status and emits events', async () => {
      mocks.findOrderForMessage.mockResolvedValue({ id: 1, status: 'PENDING', items: [], tableId: 3 });
      mocks.updateOrderInTransaction.mockResolvedValue({ id: 1, orderNumber: 'ORD-001', status: 'COMPLETED', totalAmount: 100, customerName: 'John', loyaltyPromo: false, loyaltyCustomerName: null, items: [] });

      const result = await updateOrder('1', { status: 'COMPLETED' });
      expect(mocks.emitEvent).toHaveBeenCalledWith('order-status-update', expect.any(Object));
      expect(result.status).toBe('COMPLETED');
    });

    it('resequences queue on status transition to COMPLETED', async () => {
      mocks.findOrderForMessage.mockResolvedValue({ id: 1, status: 'PENDING', items: [], tableId: 3 });
      mocks.updateOrderInTransaction.mockResolvedValue({ id: 1, orderNumber: 'ORD-001', status: 'COMPLETED', totalAmount: 100, customerName: 'John', loyaltyPromo: false, loyaltyCustomerName: null, items: [] });

      await updateOrder('1', { status: 'COMPLETED' });
      expect(mocks.emitEvent).toHaveBeenCalledWith('queue-update', { type: 'resequenced' });
    });

    it('awards loyalty on payment confirmation', async () => {
      mocks.findOrderForMessage.mockResolvedValue({ id: 1, status: 'PENDING', items: [], tableId: 3 });
      mocks.updateOrderInTransaction.mockResolvedValue({ id: 1, orderNumber: 'ORD-001', status: 'PENDING', totalAmount: 100, customerName: 'John', loyaltyPromo: false, loyaltyCustomerName: null, items: [] });

      await updateOrder('1', { paymentConfirmed: true });
      expect(mocks.runRecoverableStep).toHaveBeenCalledWith(
        'LOYALTY_AWARD',
        expect.any(Object),
        expect.any(Function),
      );
    });

    it('refunds loyalty on cancel', async () => {
      mocks.findOrderForMessage.mockResolvedValue({ id: 1, status: 'PENDING', items: [{ productId: 5 }], tableId: 3 });
      mocks.updateOrderInTransaction.mockResolvedValue({ id: 1, orderNumber: 'ORD-001', status: 'CANCELLED', totalAmount: 100, customerName: 'John', loyaltyPromo: false, loyaltyCustomerName: null, items: [] });

      await updateOrder('1', { status: 'CANCELLED' });
      expect(mocks.refundLoyaltyForCancelledOrder).toHaveBeenCalledWith(1);
    });
  });

  describe('followUp', () => {
    it('throws 404 when order not found', async () => {
      mocks.findOrderForFollowUp.mockResolvedValue(null);
      await expect(followUp('999')).rejects.toMatchObject({ status: 404 });
    });

    it('throws 400 when order completed', async () => {
      mocks.findOrderForFollowUp.mockResolvedValue({ status: 'COMPLETED' });
      await expect(followUp('1')).rejects.toMatchObject({ status: 400 });
    });

    it('emits follow-up event for active order', async () => {
      mocks.findOrderForFollowUp.mockResolvedValue({
        id: 1, status: 'PENDING', orderNumber: 'ORD-001', customerName: 'John', table: { name: 'Table 3' },
      });
      const result = await followUp('1');
      expect(mocks.emitEvent).toHaveBeenCalledWith('order-followup', expect.objectContaining({ orderId: 1, tableName: 'Table 3' }));
      expect(result).toEqual({ ok: true });
    });
  });

  describe('listMessages', () => {
    it('throws 404 when order not found', async () => {
      mocks.findOrderForMessage.mockResolvedValue(null);
      await expect(listMessages('999')).rejects.toMatchObject({ status: 404 });
    });

    it('returns messages for found order', async () => {
      mocks.findOrderForMessage.mockResolvedValue({ id: 1 });
      mocks.findOrderMessages.mockResolvedValue([{ id: 1, content: 'Hello' }]);
      const result = await listMessages('1');
      expect(mocks.findOrderMessages).toHaveBeenCalledWith(1);
      expect(result).toHaveLength(1);
    });
  });

  describe('createMessage', () => {
    it('throws 404 when order not found', async () => {
      mocks.findOrderForMessage.mockResolvedValue(null);
      await expect(createMessage('999', { content: 'Hi' }, {})).rejects.toMatchObject({ status: 404 });
    });

    it('throws 400 when order completed', async () => {
      mocks.findOrderForMessage.mockResolvedValue({ status: 'COMPLETED' });
      await expect(createMessage('1', { content: 'Hi' }, {})).rejects.toMatchObject({ status: 400 });
    });

    it('creates message as customer when not staff', async () => {
      mocks.findOrderForMessage.mockResolvedValue({ id: 5, status: 'PENDING', customerName: 'John', orderNumber: 'ORD-001' });
      mocks.getAuthUser.mockResolvedValue(null);
      mocks.createOrderMessage.mockResolvedValue({ id: 1, content: 'Hi', sender: 'John', type: 'text' });

      const result = await createMessage('1', { content: 'Hi there' }, {});
      expect(mocks.createOrderMessage).toHaveBeenCalledWith(
        expect.objectContaining({ orderId: 5, content: 'Hi there', sender: 'John' }),
      );
      expect(result.content).toBe('Hi');
    });

    it('creates message as staff when authenticated', async () => {
      mocks.findOrderForMessage.mockResolvedValue({ id: 5, status: 'PENDING', customerName: 'John', orderNumber: 'ORD-001' });
      mocks.getAuthUser.mockResolvedValue({ name: 'Alice', roles: ['ADMIN'] });
      mocks.requireRole.mockReturnValue(true);
      mocks.createOrderMessage.mockResolvedValue({ id: 1, content: 'Hi', sender: 'Alice', type: 'text' });

      const result = await createMessage('1', { content: 'Hi there' }, {});
      expect(mocks.createOrderMessage).toHaveBeenCalledWith(
        expect.objectContaining({ sender: 'Alice' }),
      );
      expect(result.sender).toBe('Alice');
    });
  });

  describe('getWaitTime', () => {
    it('throws 404 when order not found', async () => {
      mocks.findOrderForWaitTime.mockResolvedValue(null);
      await expect(getWaitTime('999')).rejects.toMatchObject({ status: 404 });
    });

    it('returns estimated times and queue position', async () => {
      mocks.findOrderForWaitTime.mockResolvedValue({
        id: 1, status: 'PENDING', orderNumber: 'ORD-001', queueNumber: 2, createdAt: new Date('2025-08-29'),
        items: [
          { product: { stationType: 'coffee', prepTimeMinutes: 3 }, quantity: 2 },
          { product: { stationType: 'kitchen', prepTimeMinutes: 10 }, quantity: 1 },
        ],
      });
      mocks.findStaffStationControl.mockResolvedValue({ staffCount: 2 });
      mocks.countActiveOrdersCreatedBefore.mockResolvedValue(3);

      const result = await getWaitTime('1');
      expect(result.estimatedTimes).toHaveProperty('coffee');
      expect(result.estimatedTimes).toHaveProperty('kitchen');
      expect(result.queuePosition).toBe(4);
      expect(result.queueNumber).toBe(2);
    });
  });
});
