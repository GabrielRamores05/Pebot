import { describe, it, expect, vi, beforeEach } from 'vitest';

const mocks = vi.hoisted(() => ({
  findLoyaltyCardsForMemberCheck: vi.fn(),
  findLoyaltyCardsByMembershipCodePrefix: vi.fn(),
  createLoyaltyCard: vi.fn(),
  findFirstLoyaltySetting: vi.fn(),
  findEnabledLoyaltySetting: vi.fn(),
  findLoyaltySettingUniqueByCategoryId: vi.fn(),
  findLoyaltySettingFirstGlobal: vi.fn(),
  findLoyaltyCardByNameAndCategory: vi.fn(),
  createLoyaltyCardDetailed: vi.fn(),
  incrementLoyaltyCardLoyaltyPoints: vi.fn(),
  updateLoyaltyCardAwardState: vi.fn(),
  updateLoyaltyCardPaidCoffeesCount: vi.fn(),
  createLoyaltyVoucher: vi.fn(),
  createLoyaltyTransaction: vi.fn(),
  updateLoyaltyVoucherByCode: vi.fn(),
  findLoyaltyCardsAllNames: vi.fn(),
  findLoyaltyVouchersByCustomerNames: vi.fn(),
  findLoyaltyCardsAll: vi.fn(),
  findLoyaltyCardsWithVouchersAndCategory: vi.fn(),
  findLoyaltySettingsWithCategory: vi.fn(),
  findLoyaltySettingsAll: vi.fn(),
  findLoyaltySettingById: vi.fn(),
  updateLoyaltySetting: vi.fn(),
  createLoyaltySetting: vi.fn(),
  deleteLoyaltySetting: vi.fn(),
  findLoyaltyVoucherByCode: vi.fn(),
  findLoyaltyVoucherWithCardAndCategory: vi.fn(),
  updateOrderLoyaltyPromo: vi.fn(),
  findLoyaltyVouchersByCodesAndCustomer: vi.fn(),
  deleteLoyaltyVouchersByCodes: vi.fn(),
  findVouchersWithCard: vi.fn(),
  findOrdersForNumberMap: vi.fn(),
  findLoyaltyCategoriesWithOrders: vi.fn(),
  findOrdersForCustomerAnalytics: vi.fn(),
  deleteLoyaltyVouchersByCardIds: vi.fn(),
  deleteLoyaltyCard: vi.fn(),
  findLoyaltyVouchersLimited: vi.fn(),
  logAction: vi.fn(),
  emitEvent: vi.fn(),
  voucherCode: vi.fn(() => 'TEST-CODE-1234'),
}));

vi.mock('../../../modules/loyalty/repository', () => ({
  findLoyaltyCardsForMemberCheck: mocks.findLoyaltyCardsForMemberCheck,
  findLoyaltyCardsByMembershipCodePrefix: mocks.findLoyaltyCardsByMembershipCodePrefix,
  createLoyaltyCard: mocks.createLoyaltyCard,
  findFirstLoyaltySetting: mocks.findFirstLoyaltySetting,
  findEnabledLoyaltySetting: mocks.findEnabledLoyaltySetting,
  findLoyaltySettingUniqueByCategoryId: mocks.findLoyaltySettingUniqueByCategoryId,
  findLoyaltySettingFirstGlobal: mocks.findLoyaltySettingFirstGlobal,
  findLoyaltyCardByNameAndCategory: mocks.findLoyaltyCardByNameAndCategory,
  createLoyaltyCardDetailed: mocks.createLoyaltyCardDetailed,
  incrementLoyaltyCardLoyaltyPoints: mocks.incrementLoyaltyCardLoyaltyPoints,
  updateLoyaltyCardAwardState: mocks.updateLoyaltyCardAwardState,
  updateLoyaltyCardPaidCoffeesCount: mocks.updateLoyaltyCardPaidCoffeesCount,
  createLoyaltyVoucher: mocks.createLoyaltyVoucher,
  createLoyaltyTransaction: mocks.createLoyaltyTransaction,
  updateLoyaltyVoucherByCode: mocks.updateLoyaltyVoucherByCode,
  findLoyaltyCardsAllNames: mocks.findLoyaltyCardsAllNames,
  findLoyaltyVouchersByCustomerNames: mocks.findLoyaltyVouchersByCustomerNames,
  findLoyaltyCardsAll: mocks.findLoyaltyCardsAll,
  findLoyaltyCardsWithVouchersAndCategory: mocks.findLoyaltyCardsWithVouchersAndCategory,
  findLoyaltySettingsWithCategory: mocks.findLoyaltySettingsWithCategory,
  findLoyaltySettingsAll: mocks.findLoyaltySettingsAll,
  findLoyaltySettingById: mocks.findLoyaltySettingById,
  updateLoyaltySetting: mocks.updateLoyaltySetting,
  createLoyaltySetting: mocks.createLoyaltySetting,
  deleteLoyaltySetting: mocks.deleteLoyaltySetting,
  findLoyaltyVoucherByCode: mocks.findLoyaltyVoucherByCode,
  findLoyaltyVoucherWithCardAndCategory: mocks.findLoyaltyVoucherWithCardAndCategory,
  updateOrderLoyaltyPromo: mocks.updateOrderLoyaltyPromo,
  findLoyaltyVouchersByCodesAndCustomer: mocks.findLoyaltyVouchersByCodesAndCustomer,
  deleteLoyaltyVouchersByCodes: mocks.deleteLoyaltyVouchersByCodes,
  findVouchersWithCard: mocks.findVouchersWithCard,
  findOrdersForNumberMap: mocks.findOrdersForNumberMap,
  findLoyaltyCategoriesWithOrders: mocks.findLoyaltyCategoriesWithOrders,
  findOrdersForCustomerAnalytics: mocks.findOrdersForCustomerAnalytics,
  deleteLoyaltyVouchersByCardIds: mocks.deleteLoyaltyVouchersByCardIds,
  deleteLoyaltyCard: mocks.deleteLoyaltyCard,
  findLoyaltyVouchersLimited: mocks.findLoyaltyVouchersLimited,
}));
vi.mock('@/lib/socket', () => ({ emitEvent: mocks.emitEvent }));
vi.mock('@/lib/audit-log', () => ({ logAction: mocks.logAction }));
vi.mock('@/lib/loyalty-utils', () => ({
  normalizeMemberName: (v: string) => v.trim().replace(/\s+/g, ' ').toUpperCase(),
  rewardLabel: (rewardType: string | null | undefined, rewardValue: number) => {
    if (rewardType === 'FREE') return 'Free Item';
    if (rewardType === 'PERCENTAGE') return `${rewardValue}% Off`;
    return `₱${rewardValue} Off`;
  },
  voucherCode: mocks.voucherCode,
  findOrCreateCardData: (customerName: string, categoryId: number | null) => ({ customerName: customerName.trim().toUpperCase(), categoryId }),
}));
vi.mock('@/lib/philippine-payroll', () => ({
  computePhilippinePayroll: vi.fn(() => ({ grossPay: 50000, netPay: 45000, statutoryEmployeeTotal: 5000, withholdingTax: 0 })),
}));

import {
  registerCustomer,
  checkNameAvailability,
  listCards,
  getCardsByCustomer,
  addCoffees,
  renameCard,
  deleteCard,
  listSettings,
  upsertSetting,
  deleteSetting,
  getVoucher,
  markVoucherRedeemed,
  validateVoucher,
  applyVoucher,
  claimReward,
  createVoucher,
  listVouchers,
  generateRewards,
  getVoucherHistory,
  getCustomerAnalytics,
} from '../../../modules/loyalty/service';

describe('loyalty service', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('registerCustomer', () => {
    it('throws 409 when name is already registered', async () => {
      mocks.findLoyaltyCardsForMemberCheck.mockResolvedValue([
        { customerName: 'JOHN DOE' },
      ]);
      await expect(registerCustomer({ customerName: 'John Doe' })).rejects.toMatchObject({ status: 409 });
    });

    it('registers a new member with default settings', async () => {
      mocks.findLoyaltyCardsForMemberCheck.mockResolvedValue([]);
      mocks.findLoyaltyCardsByMembershipCodePrefix.mockResolvedValue(null);
      mocks.findEnabledLoyaltySetting.mockResolvedValue({ categoryId: null });
      mocks.createLoyaltyCard.mockResolvedValue({
        customerName: 'JOHN DOE',
        membershipCode: 'JOHNDOE-082926',
        memberSince: new Date(),
        paidCoffeesCount: 0,
      });
      mocks.findFirstLoyaltySetting.mockResolvedValue({
        coffeesRequiredForFree: 10,
        rewardType: 'FREE',
        rewardValue: 0,
        isMilestoneMode: false,
        milestones: '[]',
      });
      const result = await registerCustomer({ customerName: 'John Doe' });
      expect(mocks.createLoyaltyCard).toHaveBeenCalledWith(
        expect.objectContaining({
          customerName: 'JOHN DOE',
          paidCoffeesCount: 0,
          claimedMilestones: '[]',
        }),
      );
      expect(result.customerName).toBe('JOHN DOE');
      expect(result.coffeesUntilNextFree).toBe(10);
    });
  });

  describe('checkNameAvailability', () => {
    it('returns available when name is free', async () => {
      mocks.findLoyaltyCardsForMemberCheck.mockResolvedValue([]);
      const result = await checkNameAvailability({ name: 'Jane' });
      expect(result.available).toBe(true);
      expect(result.name).toBe('JANE');
    });

    it('returns taken when name exists', async () => {
      mocks.findLoyaltyCardsForMemberCheck.mockResolvedValue([
        { customerName: 'JANE' },
      ]);
      const result = await checkNameAvailability({ name: 'Jane' });
      expect(result.available).toBe(false);
    });
  });

  describe('listSettings', () => {
    it('returns all settings when no categoryId', async () => {
      mocks.findLoyaltySettingsWithCategory.mockResolvedValue([
        { id: 1, categoryId: null, coffeesRequiredForFree: 10, enabled: true, category: null, rewardType: 'FREE', rewardValue: 0, milestones: '[]', isMilestoneMode: false },
      ]);
      const result = await listSettings();
      expect(result).toHaveLength(1);
      expect(result[0].rewardDescription).toBe('Free Item');
    });

    it('returns single setting when categoryId provided', async () => {
      mocks.findLoyaltySettingUniqueByCategoryId.mockResolvedValue({
        id: 2, categoryId: 5, coffeesRequiredForFree: 7, enabled: true, category: { name: 'Coffee' }, rewardType: 'PERCENTAGE', rewardValue: 10, milestones: '[]', isMilestoneMode: false,
      });
      const result = await listSettings(5);
      expect(result.categoryName).toBe('Coffee');
    });

    it('throws 404 when setting not found for category', async () => {
      mocks.findLoyaltySettingUniqueByCategoryId.mockResolvedValue(null);
      await expect(listSettings(99)).rejects.toMatchObject({ status: 404 });
    });
  });

  describe('upsertSetting', () => {
    it('creates new settings when no id', async () => {
      mocks.findLoyaltySettingUniqueByCategoryId.mockResolvedValue(null);
      mocks.createLoyaltySetting.mockResolvedValue({
        id: 1, categoryId: 3, coffeesRequiredForFree: 10, enabled: true, cardColor: '#8B4513', cardTitle: 'Loyalty Card', cardDescription: 'Earn rewards', rewardType: 'FREE', rewardValue: 0, milestones: '[]', isMilestoneMode: false, maxHeldRewards: 3, category: null,
      });
      const result = await upsertSetting({ categoryId: 3 });
      expect(mocks.createLoyaltySetting).toHaveBeenCalledWith(
        expect.objectContaining({
          categoryId: 3, coffeesRequiredForFree: 10, enabled: true,
        }),
      );
      expect(result.id).toBe(1);
    });

    it('updates existing settings when id provided', async () => {
      mocks.findLoyaltySettingById.mockResolvedValue({ id: 5 });
      mocks.updateLoyaltySetting.mockResolvedValue({
        id: 5, categoryId: null, coffeesRequiredForFree: 7, enabled: false, cardColor: '#FFF', cardTitle: 'Updated', cardDescription: 'Desc', rewardType: 'FIXED_AMOUNT', rewardValue: 50, milestones: '[]', isMilestoneMode: false, maxHeldRewards: 5, category: null,
      });
      const result = await upsertSetting({ id: 5, coffeesRequiredForFree: 7, enabled: false });
      expect(mocks.updateLoyaltySetting).toHaveBeenCalledWith(5, expect.objectContaining({ coffeesRequiredForFree: 7, enabled: false }));
      expect(result.id).toBe(5);
    });

    it('throws 409 when creating duplicate category', async () => {
      mocks.findLoyaltySettingUniqueByCategoryId.mockResolvedValue({ id: 1 });
      await expect(upsertSetting({ categoryId: 3 })).rejects.toMatchObject({ status: 409 });
    });

    it('throws 409 on P2002 when updating', async () => {
      mocks.findLoyaltySettingById.mockResolvedValue({ id: 5 });
      const err = new Error('conflict');
      (err as any).code = 'P2002';
      mocks.updateLoyaltySetting.mockRejectedValue(err);
      await expect(upsertSetting({ id: 5 })).rejects.toMatchObject({ status: 409 });
    });
  });

  describe('deleteSetting', () => {
    it('deletes setting and returns success', async () => {
      mocks.findLoyaltySettingById.mockResolvedValue({ id: 1 });
      mocks.deleteLoyaltySetting.mockResolvedValue({ id: 1 });
      const result = await deleteSetting({ id: 1 });
      expect(mocks.deleteLoyaltySetting).toHaveBeenCalledWith(1);
      expect(result).toEqual({ success: true });
    });

    it('throws 404 when setting not found', async () => {
      mocks.findLoyaltySettingById.mockResolvedValue(null);
      await expect(deleteSetting({ id: 999 })).rejects.toMatchObject({ status: 404 });
    });
  });

  describe('getVoucher', () => {
    it('returns voucher details', async () => {
      mocks.findLoyaltyVoucherByCode.mockResolvedValue({
        code: 'ABC123', customerName: 'JOHN', issuedDate: new Date('2025-01-01'), status: 'ACTIVE',
      });
      const result = await getVoucher('ABC123');
      expect(result.code).toBe('ABC123');
      expect(result.isActive).toBe(true);
    });

    it('throws 404 when voucher not found', async () => {
      mocks.findLoyaltyVoucherByCode.mockResolvedValue(null);
      await expect(getVoucher('XYZ')).rejects.toMatchObject({ status: 404 });
    });
  });

  describe('markVoucherRedeemed', () => {
    it('returns 404 when voucher not found', async () => {
      mocks.findLoyaltyVoucherByCode.mockResolvedValue(null);
      const result = await markVoucherRedeemed({ code: 'XYZ' });
      expect(result.valid).toBe(false);
      expect(result.status).toBe(404);
    });

    it('redeems active voucher', async () => {
      mocks.findLoyaltyVoucherByCode.mockResolvedValue({
        code: 'ABC', status: 'ACTIVE', redeemedDate: null,
      });
       const result = await markVoucherRedeemed({ code: 'ABC', orderId: 5 });
      expect(result.code).toBe('ABC');
      expect(mocks.updateLoyaltyVoucherByCode).toHaveBeenCalledWith('ABC', expect.objectContaining({ status: 'REDEEMED', redeemedOrderId: 5 }));
    });

    it('returns 400 when voucher not active', async () => {
      mocks.findLoyaltyVoucherByCode.mockResolvedValue({
        code: 'ABC', status: 'REDEEMED', redeemedDate: new Date(),
      });
      const result = await markVoucherRedeemed({ code: 'ABC' });
      expect(result.valid).toBe(false);
      expect(result.status).toBe(400);
    });
  });

  describe('validateVoucher', () => {
    it('returns invalid when voucher not found', async () => {
      mocks.findLoyaltyVoucherWithCardAndCategory.mockResolvedValue(null);
      const result = await validateVoucher('XYZ');
      expect(result.valid).toBe(false);
    });

    it('flags already redeemed voucher', async () => {
      mocks.findLoyaltyVoucherWithCardAndCategory.mockResolvedValue({
        code: 'ABC', status: 'REDEEMED', maxRedemptions: 1, usedCount: 1, expiryDate: null, minPurchase: 0,
      });
      const result = await validateVoucher('ABC');
      expect(result.valid).toBe(false);
      expect(result.validationErrors).toContain('Already redeemed');
    });

    it('flags expired voucher', async () => {
      mocks.findLoyaltyVoucherWithCardAndCategory.mockResolvedValue({
        code: 'ABC', status: 'ACTIVE', maxRedemptions: 1, usedCount: 0, expiryDate: new Date('2020-01-01'), minPurchase: 0,
      });
      const result = await validateVoucher('ABC');
      expect(result.valid).toBe(false);
      expect(result.validationErrors).toContain('Expired');
    });

    it('flags when usage limit reached', async () => {
      mocks.findLoyaltyVoucherWithCardAndCategory.mockResolvedValue({
        code: 'ABC', status: 'ACTIVE', maxRedemptions: 1, usedCount: 1, expiryDate: null, minPurchase: 0,
      });
      const result = await validateVoucher('ABC');
      expect(result.valid).toBe(false);
      expect(result.validationErrors).toContain('Usage limit reached');
    });

    it('returns valid voucher with details', async () => {
      mocks.findLoyaltyVoucherWithCardAndCategory.mockResolvedValue({
        code: 'ABC', status: 'ACTIVE', maxRedemptions: 5, usedCount: 0, expiryDate: null, minPurchase: 0,
        rewardName: 'Free Coffee', discountType: 'FREE', discountValue: 0, validDays: null,
        targetType: 'ALL', targetCategoryId: null, loyaltyCard: { categoryId: null, category: null },
      });
      const result = await validateVoucher('ABC');
      expect(result.valid).toBe(true);
      expect(result.voucher?.code).toBe('ABC');
      expect(result.voucher?.discountType).toBe('FREE');
    });
  });

  describe('applyVoucher', () => {
    it('returns 404 when voucher not found', async () => {
      mocks.findLoyaltyVoucherByCode.mockResolvedValue(null);
      const result = await applyVoucher({ code: 'XYZ', orderTotal: 100 });
      expect(result.valid).toBe(false);
      expect(result.status).toBe(404);
    });

    it('returns 400 when already redeemed', async () => {
      mocks.findLoyaltyVoucherByCode.mockResolvedValue({ code: 'ABC', status: 'REDEEMED', redeemedDate: new Date(), maxRedemptions: 1, usedCount: 1, minPurchase: 0 });
      const result = await applyVoucher({ code: 'ABC', orderTotal: 100 });
      expect(result.valid).toBe(false);
      expect(result.status).toBe(400);
    });

    it('returns 400 when expired', async () => {
      mocks.findLoyaltyVoucherByCode.mockResolvedValue({ code: 'ABC', status: 'ACTIVE', expiryDate: new Date('2020-01-01'), maxRedemptions: 1, usedCount: 0, minPurchase: 0 });
      const result = await applyVoucher({ code: 'ABC', orderTotal: 100 });
      expect(result.valid).toBe(false);
      expect(result.status).toBe(400);
    });

    it('returns 400 when usage limit reached', async () => {
      mocks.findLoyaltyVoucherByCode.mockResolvedValue({ code: 'ABC', status: 'ACTIVE', expiryDate: null, maxRedemptions: 1, usedCount: 1, minPurchase: 0 });
      const result = await applyVoucher({ code: 'ABC', orderTotal: 100 });
      expect(result.valid).toBe(false);
      expect(result.status).toBe(400);
    });

    it('returns 400 when min purchase not met', async () => {
      mocks.findLoyaltyVoucherByCode.mockResolvedValue({ code: 'ABC', status: 'ACTIVE', expiryDate: null, maxRedemptions: 5, usedCount: 0, minPurchase: 200 });
      const result = await applyVoucher({ code: 'ABC', orderTotal: 100 });
      expect(result.valid).toBe(false);
      expect(result.status).toBe(400);
    });

    it('applies free item voucher successfully', async () => {
      mocks.findLoyaltyVoucherByCode.mockResolvedValue({
        code: 'ABC', status: 'ACTIVE', expiryDate: null, maxRedemptions: 5, usedCount: 0, minPurchase: 0,
        discountType: 'FREE', discountValue: 0, rewardName: 'Free Item', targetType: 'ALL', targetCategoryId: null, targetProductId: null,
      });
      const result = await applyVoucher({ code: 'ABC', orderTotal: 150, orderId: 3 });
      expect(result.valid).toBe(true);
      expect(result.discount).toBe(0);
      expect(mocks.updateLoyaltyVoucherByCode).toHaveBeenCalledWith('ABC', expect.objectContaining({ usedCount: 1 }));
    });

    it('applies percentage discount', async () => {
      mocks.findLoyaltyVoucherByCode.mockResolvedValue({
        code: 'ABC', status: 'ACTIVE', expiryDate: null, maxRedemptions: 5, usedCount: 0, minPurchase: 0,
        discountType: 'PERCENTAGE', discountValue: 20, rewardName: '20% Off', targetType: 'ALL', targetCategoryId: null, targetProductId: null,
      });
      const result = await applyVoucher({ code: 'ABC', orderTotal: 100 });
      expect(result.valid).toBe(true);
      expect(result.discount).toBe(20);
    });
  });

  describe('claimReward', () => {
    it('throws 404 when vouchers not all found', async () => {
      mocks.findLoyaltyVouchersByCodesAndCustomer.mockResolvedValue([]);
      await expect(claimReward({ customerName: 'John', voucherCodes: ['A'] })).rejects.toMatchObject({ status: 404 });
    });

    it('throws 400 when some vouchers not active', async () => {
      mocks.findLoyaltyVouchersByCodesAndCustomer.mockResolvedValue([
        { code: 'A', status: 'REDEEMED' },
      ]);
      await expect(claimReward({ customerName: 'John', voucherCodes: ['A'] })).rejects.toMatchObject({ status: 400 });
    });

    it('deletes vouchers and returns success', async () => {
      mocks.findLoyaltyVouchersByCodesAndCustomer.mockResolvedValue([
        { code: 'A', status: 'ACTIVE' },
        { code: 'B', status: 'ACTIVE' },
      ]);
      const result = await claimReward({ customerName: 'John', voucherCodes: ['A', 'B'], orderId: 5 });
      expect(mocks.deleteLoyaltyVouchersByCodes).toHaveBeenCalledWith(['A', 'B']);
      expect(mocks.updateOrderLoyaltyPromo).toHaveBeenCalledWith(5);
      expect(result.success).toBe(true);
      expect(result.claimedCount).toBe(2);
    });
  });

  describe('createVoucher', () => {
    it('creates a free item voucher', async () => {
      mocks.createLoyaltyVoucher.mockResolvedValue({ id: 1, code: 'TEST-CODE-1234', customerName: 'JOHN' });
      const result = await createVoucher({ customerName: 'John' });
      expect(mocks.createLoyaltyVoucher).toHaveBeenCalledWith(
        expect.objectContaining({ customerName: 'John', discountType: 'FREE', discountValue: 0 }),
      );
      expect(result.success).toBe(true);
    });

    it('creates a percentage voucher', async () => {
      mocks.createLoyaltyVoucher.mockResolvedValue({ id: 2, code: 'TEST-CODE-1234' });
      const result = await createVoucher({ customerName: 'John', discountType: 'PERCENTAGE', discountValue: 15 });
      expect(mocks.createLoyaltyVoucher).toHaveBeenCalledWith(
        expect.objectContaining({ discountType: 'PERCENTAGE', discountValue: 15 }),
      );
      expect(result.success).toBe(true);
    });

    it('uses promo code for system-created vouchers', async () => {
      mocks.createLoyaltyVoucher.mockResolvedValue({ id: 1 });
      await createVoucher({ customerName: 'System', rewardName: 'Free Coffee' }, 1);
      expect(mocks.createLoyaltyVoucher).toHaveBeenCalledWith(
        expect.objectContaining({ customerName: 'System', rewardName: 'Free Coffee' }),
      );
    });
  });

  describe('listVouchers', () => {
    it('lists vouchers filtered by customer name', async () => {
      mocks.findLoyaltyVouchersLimited.mockResolvedValue([
        { code: 'A', customerName: 'JOHN', status: 'ACTIVE' },
      ]);
      const result = await listVouchers({ customerName: 'John' });
      expect(mocks.findLoyaltyVouchersLimited).toHaveBeenCalledWith('John', 100);
      expect(result).toHaveLength(1);
    });

    it('lists all vouchers when no customer name', async () => {
      mocks.findLoyaltyVouchersLimited.mockResolvedValue([
        { code: 'A', customerName: 'JOHN', status: 'ACTIVE' },
        { code: 'B', customerName: 'JANE', status: 'ACTIVE' },
      ]);
      const result = await listVouchers({});
      expect(mocks.findLoyaltyVouchersLimited).toHaveBeenCalledWith(null, 100);
      expect(result).toHaveLength(2);
    });
  });

  describe('generateRewards', () => {
    it('returns 404 when customer not found', async () => {
      mocks.findLoyaltyCardByNameAndCategory.mockResolvedValue(null);
      const result = await generateRewards({ customerName: 'Unknown' });
      expect(result.status).toBe(404);
      expect(result.totalEarned).toBe(0);
    });

    it('generates rewards when threshold reached', async () => {
      mocks.findLoyaltyCardByNameAndCategory.mockResolvedValue({
        paidCoffeesCount: 25,
        vouchers: [{ status: 'ACTIVE' }],
      });
      mocks.findFirstLoyaltySetting.mockResolvedValue({ coffeesRequiredForFree: 10, rewardType: 'FREE', rewardValue: 0 });
      const result = await generateRewards({ customerName: 'John' });
      expect(result.vouchersCreated).toBe(1);
    });

    it('does not generate when all rewards already active', async () => {
      mocks.findLoyaltyCardByNameAndCategory.mockResolvedValue({
        paidCoffeesCount: 25,
        vouchers: [
          { status: 'ACTIVE' }, { status: 'ACTIVE' },
        ],
      });
      mocks.findFirstLoyaltySetting.mockResolvedValue({ coffeesRequiredForFree: 10, rewardType: 'FREE', rewardValue: 0 });
      const result = await generateRewards({ customerName: 'John' });
      expect(result.vouchersCreated).toBe(0);
      expect(result.message).toBe('All rewards already generated');
    });
  });

  describe('getCardsByCustomer', () => {
    it('returns formatted cards by customer name', async () => {
      mocks.findLoyaltyCardsAll.mockResolvedValue([
        { id: 1, customerName: 'JOHN', paidCoffeesCount: 5, loyaltyPoints: 0, claimedMilestones: '[]', vouchers: [], category: null, categoryId: null, membershipCode: 'M1', memberSince: new Date() },
      ]);
      mocks.findLoyaltySettingsAll.mockResolvedValue([
        { id: 1, categoryId: null, coffeesRequiredForFree: 10, enabled: true, isMilestoneMode: false, milestones: '[]', category: null, rewardType: 'FREE', rewardValue: 0, cardColor: '#8B4513', cardTitle: 'Loyalty', cardDescription: '', maxHeldRewards: 3 },
      ]);
      const result = await getCardsByCustomer({ customerName: 'John' });
      expect(result).toHaveLength(1);
      expect(result[0].paidCoffeesCount).toBe(5);
    });
  });

  describe('addCoffees', () => {
    it('throws 400 when loyalty not enabled for category', async () => {
      mocks.findLoyaltySettingFirstGlobal.mockResolvedValue(null);
      mocks.findEnabledLoyaltySetting.mockResolvedValue(null);
      mocks.findLoyaltySettingUniqueByCategoryId.mockResolvedValue(null);
      await expect(addCoffees({ customerName: 'John', quantity: 1 }, 1)).rejects.toMatchObject({ status: 400 });
    });

    it('adds coffees with global settings and creates card if needed', async () => {
      mocks.findLoyaltySettingFirstGlobal.mockResolvedValue({
        coffeesRequiredForFree: 10, enabled: true, rewardType: 'FREE', rewardValue: 0, isMilestoneMode: false, milestones: '[]', categoryId: null,
      });
      mocks.findLoyaltyCardByNameAndCategory.mockResolvedValue(null);
      mocks.createLoyaltyCardDetailed.mockResolvedValue({
        id: 1, customerName: 'JOHN', paidCoffeesCount: 0, claimedMilestones: '[]', vouchers: [], category: null,
      });
      mocks.incrementLoyaltyCardLoyaltyPoints.mockResolvedValue({ id: 1, paidCoffeesCount: 2 });
      mocks.updateLoyaltyCardAwardState.mockResolvedValue({});
      mocks.createLoyaltyTransaction.mockResolvedValue({});
      mocks.logAction.mockResolvedValue(undefined);

      const result = await addCoffees({ customerName: 'John', quantity: 2 }, 1);
      expect(mocks.createLoyaltyCardDetailed).toHaveBeenCalledWith({ customerName: 'JOHN', categoryId: null });
      expect(mocks.incrementLoyaltyCardLoyaltyPoints).toHaveBeenCalledWith(1, 2);
    });
  });

  describe('renameCard', () => {
    it('throws 409 when new name is already taken', async () => {
      mocks.findLoyaltyCardsAllNames.mockResolvedValue([
        { id: 1, customerName: 'JANE', paidCoffeesCount: 0 },
      ]);
      await expect(renameCard({ customerName: 'John', newName: 'Jane' }, 1)).rejects.toMatchObject({ status: 409 });
    });

    it('renames card successfully', async () => {
      mocks.findLoyaltyCardsAllNames.mockResolvedValue([
        { id: 1, customerName: 'JOHN', paidCoffeesCount: 5 },
      ]);
      mocks.updateLoyaltyCardPaidCoffeesCount.mockResolvedValue({});
      mocks.findLoyaltyVouchersByCustomerNames.mockResolvedValue([
        { code: 'A', customerName: 'JOHN' },
      ]);
      mocks.updateLoyaltyVoucherByCode.mockResolvedValue({});
      mocks.logAction.mockResolvedValue(undefined);

      const result = await renameCard({ customerName: 'John', newName: 'Bob' }, 1);
      expect(result).toEqual({ success: true });
      expect(mocks.updateLoyaltyVoucherByCode).toHaveBeenCalledWith('A', { customerName: 'BOB' });
    });

    it('throws 404 when member not found', async () => {
      mocks.findLoyaltyCardsAllNames.mockResolvedValue([]);
      await expect(renameCard({ customerName: 'Nobody', newName: 'Bob' }, 1)).rejects.toMatchObject({ status: 404 });
    });
  });

  describe('deleteCard', () => {
    it('throws 404 when member not found', async () => {
      mocks.findLoyaltyCardsAllNames.mockResolvedValue([]);
      await expect(deleteCard({ customerName: 'Nobody' }, 1)).rejects.toMatchObject({ status: 404 });
    });

    it('deletes all cards and vouchers for member', async () => {
      mocks.findLoyaltyCardsAllNames.mockResolvedValue([
        { id: 1, customerName: 'JOHN', paidCoffeesCount: 0 },
        { id: 2, customerName: 'JOHN', paidCoffeesCount: 0 },
      ]);
      mocks.deleteLoyaltyVouchersByCardIds.mockResolvedValue({});
      mocks.deleteLoyaltyCard.mockResolvedValue({});
      mocks.logAction.mockResolvedValue(undefined);

      const result = await deleteCard({ customerName: 'John' }, 1);
      expect(mocks.deleteLoyaltyVouchersByCardIds).toHaveBeenCalledWith([1, 2]);
      expect(mocks.deleteLoyaltyCard).toHaveBeenCalledTimes(2);
      expect(result).toEqual({ success: true });
    });
  });

  describe('listCards', () => {
    it('returns formatted cards', async () => {
      mocks.findLoyaltyCardsWithVouchersAndCategory.mockResolvedValue([
        { id: 1, customerName: 'JOHN', paidCoffeesCount: 5, loyaltyPoints: 0, membershipCode: 'M1', memberSince: new Date(), categoryId: null, category: null, vouchers: [{ status: 'ACTIVE' }] },
      ]);
      mocks.findLoyaltySettingsWithCategory.mockResolvedValue([
        { categoryId: null, coffeesRequiredForFree: 10, category: null, rewardType: 'FREE', rewardValue: 0 },
      ]);
      const result = await listCards();
      expect(result).toHaveLength(1);
      expect(result[0].rewardsAvailable).toBe(1);
      expect(result[0].coffeesRequiredForFree).toBe(10);
    });
  });

  describe('getVoucherHistory', () => {
    it('returns voucher records with stats', async () => {
      mocks.findVouchersWithCard.mockResolvedValue([
        { id: 1, code: 'A', customerName: 'JOHN', status: 'REDEEMED', issuedDate: new Date('2025-01-01'), redeemedDate: new Date('2025-01-05'), redeemedOrderId: 10 },
      ]);
      mocks.findOrdersForNumberMap.mockResolvedValue([
        { id: 10, orderNumber: 1001 },
      ]);
      const result = await getVoucherHistory();
      expect(result.vouchers).toHaveLength(1);
      expect(result.vouchers[0].orderNumber).toBe(1001);
      expect(result.stats.totalIssued).toBe(1);
      expect(result.stats.totalRedeemed).toBe(1);
      expect(result.stats.pendingVouchers).toBe(0);
    });
  });

  describe('getCustomerAnalytics', () => {
    it('returns customer analytics', async () => {
      mocks.findLoyaltyCategoriesWithOrders.mockResolvedValue([
        { id: 1, customerName: 'JOHN', paidCoffeesCount: 5, createdAt: new Date('2025-01-01'), vouchers: [{ status: 'REDEEMED' }] },
      ]);
      mocks.findOrdersForCustomerAnalytics.mockResolvedValue([
        { customerName: 'JOHN', totalAmount: 200, createdAt: new Date('2025-01-15'), status: 'COMPLETED' },
      ]);
      const result = await getCustomerAnalytics();
      expect(result.customers).toHaveLength(1);
      expect(result.customers[0].customerName).toBe('JOHN');
      expect(result.customers[0].lifetimeValue).toBe(200);
      expect(result.customers[0].totalOrders).toBe(1);
      expect(result.stats.totalCustomers).toBe(1);
    });
  });
});
