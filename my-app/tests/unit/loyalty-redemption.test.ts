import { describe, it, expect } from 'vitest';
import {
  dayCode,
  eligibleItems,
  loyaltyDiscountFor,
  voucherRejection,
  type RedeemableVoucher,
} from '../../lib/loyalty-redemption';

function voucher(overrides: Partial<RedeemableVoucher> = {}): RedeemableVoucher {
  return {
    code: 'REWARD-1',
    status: 'ACTIVE',
    discountType: 'FREE',
    discountValue: 0,
    minPurchase: 0,
    maxRedemptions: 1,
    usedCount: 0,
    validDays: null,
    targetType: 'ALL',
    targetCategoryId: null,
    targetProductId: null,
    expiryDate: null,
    ...overrides,
  };
}

const latte = { productId: 1, price: 150, quantity: 1, categoryId: 1 };
const cake = { productId: 2, price: 90, quantity: 2, categoryId: 2 };
// A Wednesday and a Saturday, for the valid-days rules.
const weekday = new Date('2026-08-26T10:00:00Z');
const weekend = new Date('2026-08-29T10:00:00Z');

describe('voucherRejection', () => {
  const order = { items: [latte, cake], subtotal: 330, now: weekday };

  it('accepts a plain active voucher', () => {
    expect(voucherRejection(voucher(), order)).toBeNull();
  });

  it('refuses a voucher that is not ACTIVE', () => {
    expect(voucherRejection(voucher({ status: 'REDEEMED' }), order)).toMatch(/already been used/);
  });

  it('refuses an expired voucher', () => {
    const expired = voucher({ expiryDate: new Date('2026-08-01T00:00:00Z') });
    expect(voucherRejection(expired, order)).toMatch(/expired/);
  });

  it('refuses a voucher with no uses left even while still ACTIVE', () => {
    const spent = voucher({ maxRedemptions: 2, usedCount: 2 });
    expect(voucherRejection(spent, order)).toMatch(/no uses left/);
  });

  it('enforces the minimum spend against the order subtotal', () => {
    expect(voucherRejection(voucher({ minPurchase: 500 }), order)).toMatch(/minimum spend/);
    expect(voucherRejection(voucher({ minPurchase: 330 }), order)).toBeNull();
  });

  it('enforces WEEKENDS / WEEKDAYS / explicit day lists', () => {
    expect(voucherRejection(voucher({ validDays: 'WEEKENDS' }), order)).toMatch(/weekends/);
    expect(
      voucherRejection(voucher({ validDays: 'WEEKENDS' }), { ...order, now: weekend }),
    ).toBeNull();

    expect(
      voucherRejection(voucher({ validDays: 'WEEKDAYS' }), { ...order, now: weekend }),
    ).toMatch(/weekdays/);
    expect(voucherRejection(voucher({ validDays: 'WEEKDAYS' }), order)).toBeNull();

    expect(voucherRejection(voucher({ validDays: 'MON,TUE' }), order)).toMatch(/cannot be used today/);
    expect(voucherRejection(voucher({ validDays: 'MON,WED' }), order)).toBeNull();
  });

  it('refuses a voucher whose target is not in the order', () => {
    const otherCategory = voucher({ targetType: 'CATEGORY', targetCategoryId: 99 });
    expect(voucherRejection(otherCategory, order)).toMatch(/does not apply/);

    const otherProduct = voucher({ targetType: 'PRODUCT', targetProductId: 99 });
    expect(voucherRejection(otherProduct, order)).toMatch(/does not apply/);
  });
});

describe('eligibleItems', () => {
  it('narrows by product, by category, or not at all', () => {
    const items = [latte, cake];
    expect(eligibleItems(voucher(), items)).toEqual(items);
    expect(eligibleItems(voucher({ targetType: 'CATEGORY', targetCategoryId: 2 }), items)).toEqual([cake]);
    expect(eligibleItems(voucher({ targetType: 'PRODUCT', targetProductId: 1 }), items)).toEqual([latte]);
  });

  it('ignores a target id that the type does not use', () => {
    const items = [latte, cake];
    const mismatched = voucher({ targetType: 'ALL', targetCategoryId: 2, targetProductId: 1 });
    expect(eligibleItems(mismatched, items)).toEqual(items);
  });
});

describe('loyaltyDiscountFor', () => {
  const order = { items: [latte, cake], now: weekday };

  it('is zero with no vouchers', () => {
    expect(loyaltyDiscountFor([], order)).toEqual({ discount: 0, rejections: [] });
  });

  it('gives a FREE voucher the most expensive eligible item, by unit price', () => {
    expect(loyaltyDiscountFor([voucher()], order).discount).toBe(150);
  });

  it('honours the customer\u2019s chosen item', () => {
    const withSelection = { ...order, selection: { 'REWARD-1': 2 } };
    expect(loyaltyDiscountFor([voucher()], withSelection).discount).toBe(90);
  });

  it('pins a product-targeted voucher to its product, ignoring any selection', () => {
    const pinned = voucher({ targetType: 'PRODUCT', targetProductId: 2 });
    const misleading = { ...order, selection: { 'REWARD-1': 1 } };
    expect(loyaltyDiscountFor([pinned], misleading).discount).toBe(90);
  });

  it('computes PERCENTAGE and caps FIXED_AMOUNT at the item price', () => {
    const percentage = voucher({ discountType: 'PERCENTAGE', discountValue: 10 });
    expect(loyaltyDiscountFor([percentage], order).discount).toBe(15);

    const fixed = voucher({
      discountType: 'FIXED_AMOUNT',
      discountValue: 400,
      targetType: 'CATEGORY',
      targetCategoryId: 2,
    });
    expect(loyaltyDiscountFor([fixed], order).discount).toBe(90);
  });

  it('never discounts more than the order is worth', () => {
    const vouchers = [
      voucher({ code: 'A' }),
      voucher({ code: 'B' }),
      voucher({ code: 'C' }),
    ];
    expect(loyaltyDiscountFor(vouchers, order).discount).toBe(330);
  });

  it('discounts nothing when any voucher is unusable, and says why for each', () => {
    const vouchers = [
      voucher({ code: 'GOOD' }),
      voucher({ code: 'USED', status: 'REDEEMED' }),
      voucher({ code: 'OLD', expiryDate: new Date('2020-01-01T00:00:00Z') }),
    ];
    const result = loyaltyDiscountFor(vouchers, order);
    expect(result.discount).toBe(0);
    expect(result.rejections).toHaveLength(2);
    expect(result.rejections.join(' ')).toContain('USED');
    expect(result.rejections.join(' ')).toContain('OLD');
  });

  it('rounds to centavos', () => {
    const percentage = voucher({ discountType: 'PERCENTAGE', discountValue: 33 });
    const odd = { items: [{ productId: 1, price: 100.01, quantity: 1, categoryId: 1 }], now: weekday };
    expect(loyaltyDiscountFor([percentage], odd).discount).toBe(33);
  });
});

describe('dayCode', () => {
  it('maps a date to the code the voucher rules use', () => {
    expect(dayCode(weekday)).toBe('WED');
    expect(dayCode(weekend)).toBe('SAT');
  });
});
