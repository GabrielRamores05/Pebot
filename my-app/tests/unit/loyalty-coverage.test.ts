import { describe, expect, it } from 'vitest';
import { loyaltyCoveredValue } from '@/lib/loyalty-utils';

const item = (categoryId: number | null, unitPrice: number, quantity = 1) => ({
  unitPrice,
  quantity,
  product: { categoryId },
});

describe('loyaltyCoveredValue', () => {
  const items = [item(1, 120, 2), item(2, 85), item(null, 40)];

  it('counts only items in the categories the loyalty program covers', () => {
    const settings = [{ enabled: true, categoryId: 2 }];
    expect(loyaltyCoveredValue(items, settings)).toBe(85);
  });

  it('does not depend on a category being named "coffee"', () => {
    // Category 1 could be "Rice Meals"; only its id matters.
    const settings = [{ enabled: true, categoryId: 1 }];
    expect(loyaltyCoveredValue(items, settings)).toBe(240);
  });

  it('adds up several covered categories', () => {
    const settings = [
      { enabled: true, categoryId: 1 },
      { enabled: true, categoryId: 2 },
    ];
    expect(loyaltyCoveredValue(items, settings)).toBe(325);
  });

  it('counts every item when a program covers the whole menu', () => {
    const settings = [{ enabled: true, categoryId: null }];
    expect(loyaltyCoveredValue(items, settings)).toBe(365);
  });

  it('ignores programs that are switched off', () => {
    const settings = [
      { enabled: false, categoryId: null },
      { enabled: true, categoryId: 2 },
    ];
    expect(loyaltyCoveredValue(items, settings)).toBe(85);
  });

  it('is zero when there is no enabled program', () => {
    expect(loyaltyCoveredValue(items, [])).toBe(0);
    expect(loyaltyCoveredValue(items, [{ enabled: false, categoryId: 1 }])).toBe(0);
  });
});
