import { describe, expect, test } from 'vitest';
import {
  calcIngredientCost,
  calcInventoryValue,
  calcPricePerUnit,
  calcWeightedAverage,
  convertFromBase,
  convertToBase,
  formatPeso,
  formatStock,
  formatUnitCost,
  getStockStatus,
  validateAdjustment,
  validatePurchase,
} from '../../lib/ingredient-utils';

describe('ingredient unit conversions', () => {
  test('converts supported units to and from their base unit', () => {
    expect(convertToBase(1.25, 'kg')).toBe(1250);
    expect(convertToBase(2, 'oz')).toBe(56.699);
    expect(convertFromBase(1500, 'kg')).toBe(1.5);
    expect(convertFromBase(56.699, 'oz')).toBe(2);
  });

  test('passes unknown units through unchanged', () => {
    expect(convertToBase(12.5, 'tray')).toBe(12.5);
    expect(convertFromBase(12.5, 'tray')).toBe(12.5);
  });
});

describe('ingredient costing', () => {
  test('calculates purchase and weighted-average unit costs', () => {
    expect(calcPricePerUnit(450, 3, 'kg')).toBe(150);
    expect(calcWeightedAverage(2, 10, 30, 5)).toBe(3.33);
  });

  test('rejects invalid price-per-unit inputs', () => {
    expect(calcPricePerUnit(100, 0, 'kg')).toBeNull();
    expect(calcPricePerUnit(-1, 1, 'kg')).toBeNull();
    expect(calcPricePerUnit(100, 1, '')).toBeNull();
  });

  test('handles empty stock and rounds monetary values', () => {
    expect(calcWeightedAverage(2, 0, 0, 0)).toBe(0);
    expect(calcIngredientCost(3.333, 1.005)).toBe(3.35);
    expect(calcInventoryValue(12.345, 2.5)).toBe(30.86);
  });
});

describe('ingredient display formatting', () => {
  test('formats peso values and unit costs', () => {
    expect(formatPeso(1500.5)).toBe('₱1,500.50');
    expect(formatPeso(null)).toBe('₱0.00');
    expect(formatUnitCost(0.6, 'g')).toBe('₱0.60/g (₱600.00/kg)');
    expect(formatUnitCost(0.08, 'ml')).toBe('₱0.08/ml (₱80.00/L)');
    expect(formatUnitCost(12, 'pcs')).toBe('₱12.00/pcs');
  });

  test('uses friendlier units for large weight and volume stocks', () => {
    expect(formatStock(1250, 'g')).toBe('1.25 kg');
    expect(formatStock(2500, 'ml')).toBe('2.5 L');
    expect(formatStock(12.25, 'pcs')).toBe('12.3 pcs');
  });
});

describe('ingredient validation', () => {
  test.each([
    [0, 100, 'kg', 'Quantity must be greater than 0'],
    [1, -1, 'kg', 'Purchase cost cannot be negative'],
    [1, 100, '', 'Unit is required'],
    [1, 100, 'tray', 'Unknown unit: tray'],
    [1, 100, 'kg', null],
  ])('validates purchase input', (quantity, cost, unit, expected) => {
    expect(validatePurchase(quantity as number, cost as number, unit as string)).toBe(expected);
  });

  test.each([
    [0, 10, '', 'Adjustment amount cannot be zero'],
    [-1, 10, 'LOST', 'Invalid reason'],
    [-11, 10, 'WASTE', 'Insufficient stock for this adjustment'],
    [-10, 10, 'WASTE', null],
    [5, 10, '', null],
  ])('validates stock adjustments', (quantity, stock, reason, expected) => {
    expect(validateAdjustment(quantity as number, stock as number, reason as string)).toBe(expected);
  });

  test('classifies stock at zero, threshold, and healthy levels', () => {
    expect(getStockStatus(0, 5)).toBe('OUT_OF_STOCK');
    expect(getStockStatus(5, 5)).toBe('LOW_STOCK');
    expect(getStockStatus(6, 5)).toBe('IN_STOCK');
  });
});
