import { describe, expect, test } from 'vitest';
import {
  VAT_RATE,
  basePrice,
  marginAmount,
  normalizeMarginType,
  sellingPrice,
  vatAmount,
} from '../../lib/bir-pricing';

describe('normalizeMarginType', () => {
  test('keeps the supported margin types', () => {
    expect(normalizeMarginType('PERCENTAGE')).toBe('PERCENTAGE');
    expect(normalizeMarginType('FIXED')).toBe('FIXED');
  });

  test('falls back to PERCENTAGE for anything else', () => {
    expect(normalizeMarginType('percentage')).toBe('PERCENTAGE');
    expect(normalizeMarginType('MARKUP')).toBe('PERCENTAGE');
    expect(normalizeMarginType(undefined)).toBe('PERCENTAGE');
    expect(normalizeMarginType(null)).toBe('PERCENTAGE');
    expect(normalizeMarginType(30)).toBe('PERCENTAGE');
  });
});

describe('marginAmount', () => {
  test('percentage margin is a share of the capital cost', () => {
    expect(marginAmount(100, 'PERCENTAGE', 30)).toBe(30);
    expect(marginAmount(80, 'PERCENTAGE', 12.5)).toBe(10);
  });

  test('fixed margin ignores the capital cost', () => {
    expect(marginAmount(100, 'FIXED', 25)).toBe(25);
    expect(marginAmount(0, 'FIXED', 25)).toBe(25);
  });

  test('zero margin adds nothing', () => {
    expect(marginAmount(100, 'PERCENTAGE', 0)).toBe(0);
    expect(marginAmount(100, 'FIXED', 0)).toBe(0);
  });
});

describe('basePrice', () => {
  test('is capital cost plus the margin', () => {
    expect(basePrice(100, 'PERCENTAGE', 30)).toBe(130);
    expect(basePrice(100, 'FIXED', 30)).toBe(130);
    expect(basePrice(50, 'PERCENTAGE', 100)).toBe(100);
  });
});

describe('vatAmount', () => {
  test('charges the VAT rate on the base price', () => {
    expect(VAT_RATE).toBe(12);
    expect(vatAmount(100, false)).toBe(12);
    expect(vatAmount(130, false)).toBeCloseTo(15.6, 10);
  });

  test('is zero for VAT-exempt items', () => {
    expect(vatAmount(130, true)).toBe(0);
  });
});

describe('sellingPrice', () => {
  test('percentage margin plus VAT', () => {
    // 100 capital + 30% margin = 130, + 12% VAT = 145.6
    expect(sellingPrice(100, 'PERCENTAGE', 30, false)).toBeCloseTo(145.6, 10);
  });

  test('fixed margin plus VAT', () => {
    // 100 capital + 30 fixed = 130, + 12% VAT = 145.6
    expect(sellingPrice(100, 'FIXED', 30, false)).toBeCloseTo(145.6, 10);
  });

  test('VAT-exempt items sell at the base price', () => {
    expect(sellingPrice(100, 'PERCENTAGE', 30, true)).toBe(130);
  });

  test('zero capital cost with a percentage margin is free', () => {
    expect(sellingPrice(0, 'PERCENTAGE', 30, false)).toBe(0);
  });
});
