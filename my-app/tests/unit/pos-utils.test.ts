import { describe, expect, test } from 'vitest';
import { calculateLoyaltyDiscountForItems } from '../../lib/pos-utils';

const items = [
  { productId: 1, categoryId: 10, price: 120, quantity: 2 },
  { productId: 2, categoryId: 10, price: 180, quantity: 1 },
  { productId: 3, categoryId: 20, price: 90, quantity: 1 },
];

describe('loyalty voucher discounts', () => {
  test('returns zero for an empty cart', () => {
    expect(
      calculateLoyaltyDiscountForItems(
        [],
        [{ code: 'FREE', discountType: 'FREE', discountValue: 0, targetCategoryId: null }],
        {},
      ),
    ).toBe(0);
  });

  test('uses the highest-priced eligible item when none is selected', () => {
    expect(
      calculateLoyaltyDiscountForItems(
        items,
        [{ code: 'FREE', discountType: 'FREE', discountValue: 0, targetCategoryId: 10 }],
        {},
      ),
    ).toBe(180);
  });

  test('honors a selected eligible item', () => {
    expect(
      calculateLoyaltyDiscountForItems(
        items,
        [{ code: 'HALF', discountType: 'PERCENTAGE', discountValue: 50, targetCategoryId: 10 }],
        { HALF: 1 },
      ),
    ).toBe(60);
  });

  test('falls back when the selected item is outside the target category', () => {
    expect(
      calculateLoyaltyDiscountForItems(
        items,
        [{ code: 'FOOD', discountType: 'PERCENTAGE', discountValue: 10, targetCategoryId: 10 }],
        { FOOD: 3 },
      ),
    ).toBe(18);
  });

  test('caps fixed discounts at the target item price', () => {
    expect(
      calculateLoyaltyDiscountForItems(
        items,
        [{ code: 'FIXED', discountType: 'FIXED_AMOUNT', discountValue: 500, targetCategoryId: 20 }],
        {},
      ),
    ).toBe(90);
  });

  test('ignores vouchers without eligible items or a supported type', () => {
    expect(
      calculateLoyaltyDiscountForItems(
        items,
        [
          { code: 'MISSING', discountType: 'FREE', discountValue: 0, targetCategoryId: 99 },
          { code: 'UNKNOWN', discountType: 'BOGO', discountValue: 100, targetCategoryId: null },
        ],
        {},
      ),
    ).toBe(0);
  });

  test('never discounts more than the cart total', () => {
    expect(
      calculateLoyaltyDiscountForItems(
        [{ productId: 1, price: 50, quantity: 1 }],
        [
          { code: 'ONE', discountType: 'FREE', discountValue: 0, targetCategoryId: null },
          { code: 'TWO', discountType: 'FREE', discountValue: 0, targetCategoryId: null },
        ],
        {},
      ),
    ).toBe(50);
  });
});
