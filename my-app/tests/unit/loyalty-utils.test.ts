import { describe, expect, test } from 'vitest';
import {
  findOrCreateCardData,
  normalizeMemberName,
  rewardLabel,
  voucherCode,
} from '../../lib/loyalty-utils';

describe('loyalty member data', () => {
  test('normalizes surrounding, repeated, and mixed-case whitespace', () => {
    expect(normalizeMemberName('  Ana   de la Cruz  ')).toBe('ANA DE LA CRUZ');
  });

  test('builds normalized card data without changing the category', () => {
    expect(findOrCreateCardData('  Gabriel  Ramos ', 12)).toEqual({
      customerName: 'GABRIEL RAMOS',
      categoryId: 12,
    });
    expect(findOrCreateCardData('Walk In', null).categoryId).toBeNull();
  });
});

describe('reward names', () => {
  test('reads as the customer would see it', () => {
    expect(rewardLabel('FREE', 0)).toBe('Free Item');
    expect(rewardLabel('PERCENTAGE', 10)).toBe('10% Off');
    expect(rewardLabel('FIXED_AMOUNT', 50)).toBe('₱50 Off');
  });
});

describe('voucher codes', () => {
  test('keeps the prefix that explains where the voucher came from', () => {
    expect(voucherCode('MIL-T10', 'G')).toMatch(/^MIL-T10-G-[0-9a-z]+-[0-9A-Z]{6}$/);
    expect(voucherCode('PROMO')).toMatch(/^PROMO-[0-9a-z]+-[0-9A-Z]{6}$/);
  });

  test('never issues the same code twice', () => {
    const codes = new Set(Array.from({ length: 500 }, () => voucherCode('CAFE')));
    expect(codes.size).toBe(500);
  });
});
