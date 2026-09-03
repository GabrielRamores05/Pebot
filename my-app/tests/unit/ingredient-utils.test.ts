import { describe, expect, test } from 'vitest';
import {
  aggregateSupplierPurchasePrices,
  calcIngredientCost,
  calcInventoryValue,
  calcPriceChange,
  calcPricePerUnit,
  calcWeightedAverage,
  canConvertUnit,
  computePurchaseCostBreakdown,
  computeVoidRollback,
  convertFromBase,
  convertToBase,
  formatPeso,
  formatStock,
  formatUnitCost,
  getStockStatus,
  priceChangeByPurchaseId,
  purchaseUnitOptions,
  summarizeStockLevels,
  toBaseQuantity,
  unitFamily,
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

describe('price change (spec 014 trends)', () => {
  test('first purchase has no comparison', () => {
    expect(calcPriceChange(null, 0.5)).toBeNull();
    expect(calcPriceChange(undefined, 0.5)).toBeNull();
  });

  test('equal prices show zero change', () => {
    expect(calcPriceChange(0.5, 0.5)).toEqual({ delta: 0, percent: 0 });
  });

  test('increase computes delta and percent', () => {
    expect(calcPriceChange(0.4, 0.5)).toEqual({ delta: 0.1, percent: 25 });
  });

  test('decrease computes negative delta and percent', () => {
    expect(calcPriceChange(0.5, 0.4)).toEqual({ delta: -0.1, percent: -20 });
  });

  test('previous zero yields zero percent but real delta', () => {
    expect(calcPriceChange(0, 0.75)).toEqual({ delta: 0.75, percent: 0 });
  });
});

describe('purchase unit families (spec 014)', () => {
  test('classifies weight, volume and count units', () => {
    expect(unitFamily('kg')).toBe('weight');
    expect(unitFamily('g')).toBe('weight');
    expect(unitFamily('L')).toBe('volume');
    expect(unitFamily('ml')).toBe('volume');
    expect(unitFamily('pcs')).toBe('count');
    expect(unitFamily('pack')).toBe('count');
    expect(unitFamily('tray')).toBeNull();
  });

  test('only same-family units convert to a base unit', () => {
    expect(canConvertUnit('g', 'kg')).toBe(true);
    expect(canConvertUnit('g', 'g')).toBe(true);
    expect(canConvertUnit('ml', 'L')).toBe(true);
    expect(canConvertUnit('pcs', 'pcs')).toBe(true);
    expect(canConvertUnit('pcs', 'ml')).toBe(false);
    expect(canConvertUnit('ml', 'kg')).toBe(false);
    expect(canConvertUnit('g', 'pcs')).toBe(false);
  });

  test('offers convertible purchase-unit options per base unit', () => {
    expect(purchaseUnitOptions('g')).toContain('kg');
    expect(purchaseUnitOptions('g')).not.toContain('ml');
    expect(purchaseUnitOptions('ml')).toEqual(['L', 'ml']);
    expect(purchaseUnitOptions('pcs')).toContain('pcs');
    expect(purchaseUnitOptions('tray')).toEqual([]);
  });

  test('toBaseQuantity converts valid pairs and rejects the rest', () => {
    expect(toBaseQuantity('g', 'kg', 2)).toBe(2000);
    expect(toBaseQuantity('ml', 'L', 1.5)).toBe(1500);
    expect(toBaseQuantity('g', 'kg', 0)).toBeNull();
    expect(toBaseQuantity('g', 'kg', -1)).toBeNull();
    expect(toBaseQuantity('g', 'ml', 2)).toBeNull();
    expect(toBaseQuantity('pcs', 'ml', 2)).toBeNull();
  });

  test('computePurchaseCostBreakdown previews base and purchase-unit costs', () => {
    // QS-1: 2 kg of a grams ingredient for ₱1,100 → ₱0.55/g, ₱550/kg
    const qs1 = computePurchaseCostBreakdown('g', 'kg', 2, 1100)!;
    expect(qs1.quantityInBase).toBe(2000);
    expect(qs1.unitCostBase).toBe(0.55);
    expect(qs1.pricePerUnit).toBe(550);
    // supplierless supplierless purchase still converts
    expect(computePurchaseCostBreakdown('ml', 'L', 1, 90)!.unitCostBase).toBe(0.09);
    // unconvertible pair and non-positive quantity return null
    expect(computePurchaseCostBreakdown('g', 'L', 2, 100)).toBeNull();
    expect(computePurchaseCostBreakdown('g', 'kg', 0, 100)).toBeNull();
  });
});

describe('purchase history trend (spec 014 US2)', () => {
  test('first purchase has no comparison; later rows compare vs previous priced row', () => {
    const changes = priceChangeByPurchaseId([
      { id: 1, unitCost: 0.4 },
      { id: 2, unitCost: 0.5 },
    ]);
    expect(changes.get(1)).toBeNull();
    expect(changes.get(2)).toEqual({ delta: 0.1, percent: 25 });
  });

  test('equal prices show ₱0.00 / 0% — never "no data"', () => {
    const changes = priceChangeByPurchaseId([
      { id: 1, unitCost: 0.5 },
      { id: 2, unitCost: 0.5 },
    ]);
    expect(changes.get(2)).toEqual({ delta: 0, percent: 0 });
  });

  test('row-id order defines previous, not array order', () => {
    const changes = priceChangeByPurchaseId([
      { id: 2, unitCost: 0.9 },
      { id: 1, unitCost: 0.6 },
    ]);
    expect(changes.get(1)).toBeNull();
    expect(changes.get(2)).toEqual({ delta: 0.3, percent: 50 });
  });

  test('rows without a stored unit cost are skipped for comparison', () => {
    const changes = priceChangeByPurchaseId([
      { id: 1, unitCost: 0.4 },
      { id: 2, unitCost: null },
      { id: 3, unitCost: 0.5 },
    ]);
    expect(changes.get(3)).toEqual({ delta: 0.1, percent: 25 });
  });
});

describe('void-reversal decision (spec 014 FR-009 / QS-4)', () => {
  const rows = [
    { id: 1, unitCost: 0.3, referenceType: 'supplier', referenceId: 10 },
    { id: 2, unitCost: 0.4, referenceType: null, referenceId: null },
    { id: 3, unitCost: 0.5, referenceType: 'supplier', referenceId: 11 },
  ];

  test('voiding the only purchase is latest with nothing to roll back to', () => {
    const decision = computeVoidRollback([{ id: 7, unitCost: 0.9, referenceType: 'supplier', referenceId: 3 }], 7);
    expect(decision.voidedIsLatest).toBe(true);
    expect(decision.previousUnitCost).toBeNull();
    expect(decision.previousSupplierId).toBeNull();
  });

  test('voiding the latest purchase rolls cost back to the previous priced row', () => {
    const decision = computeVoidRollback(rows, 3);
    expect(decision.voidedIsLatest).toBe(true);
    expect(decision.previousUnitCost).toBe(0.4); // row 2 prices it; row 1 is older
    expect(decision.previousSupplierId).toBe(10); // row 2 has no supplier → falls to row 1
  });

  test('voiding a non-latest purchase only reverses stock (no rollback)', () => {
    const decision = computeVoidRollback(rows, 2);
    expect(decision.voidedIsLatest).toBe(false);
    expect(decision.previousUnitCost).toBeNull();
    expect(decision.previousSupplierId).toBeNull();
  });

  test('unknown voided id is treated as non-latest/no-op', () => {
    const decision = computeVoidRollback(rows, 999);
    expect(decision).toEqual({ voidedIsLatest: false, previousUnitCost: null, previousSupplierId: null });
  });

  test('VOID_PURCHASE rows are excluded before the decision (caller filters)', () => {
    // Passing only non-void PURCHASE rows must behave as if the void row never existed.
    const withVoidRows = [...rows, { id: 4, unitCost: null, referenceType: 'void-of', referenceId: 3 }];
    const nonVoid = withVoidRows.filter((r) => r.referenceType !== 'void-of');
    const decision = computeVoidRollback(nonVoid, 3);
    expect(decision.voidedIsLatest).toBe(true);
    expect(decision.previousUnitCost).toBe(0.4);
  });
});

describe('supplier price aggregation (spec 014 US3)', () => {
  const meta = new Map([
    [1, { name: 'Coffee Beans', baseUnit: 'g' }],
    [2, { name: 'Milk', baseUnit: 'ml' }],
  ]);

  test('groups by supplier and ingredient with latest price and change', () => {
    const rows = [
      { id: 1, supplierId: 5, ingredientId: 1, unitCost: 0.45 },
      { id: 2, supplierId: 5, ingredientId: 1, unitCost: 0.5 },
      { id: 3, supplierId: 6, ingredientId: 1, unitCost: 0.6 },
    ];
    const result = aggregateSupplierPurchasePrices(rows, meta);
    expect(result).toHaveLength(2);
    const fromFive = result.find((r) => r.supplierId === 5)!;
    expect(fromFive.ingredientName).toBe('Coffee Beans');
    expect(fromFive.latestUnitCost).toBe(0.5);
    expect(fromFive.change).toEqual({ delta: 0.05, percent: 11.11 });
    const fromSix = result.find((r) => r.supplierId === 6)!;
    expect(fromSix.change).toBeNull(); // single purchase → no comparison
    expect(fromSix.latestUnitCost).toBe(0.6);
  });

  test('equal prices from the same supplier yield 0.00 / 0%', () => {
    const result = aggregateSupplierPurchasePrices(
      [
        { id: 1, supplierId: 5, ingredientId: 2, unitCost: 0.5 },
        { id: 2, supplierId: 5, ingredientId: 2, unitCost: 0.5 },
      ],
      meta,
    );
    expect(result[0].change).toEqual({ delta: 0, percent: 0 });
  });
});

describe('inventory analytics summary (spec 014 US5)', () => {
  test('counts healthy/low/out with the shared threshold rule incl. boundary', () => {
    const summary = summarizeStockLevels([
      { currentStock: 10, minStock: 5, costPerUnit: 2 }, // healthy
      { currentStock: 5, minStock: 5, costPerUnit: 1 }, // equal → LOW
      { currentStock: 2, minStock: 5, costPerUnit: 3 }, // low
      { currentStock: 0, minStock: 5, costPerUnit: 4 }, // out
      { currentStock: -1, minStock: 0, costPerUnit: 1 }, // out
    ]);
    expect(summary.healthy).toBe(1);
    expect(summary.low).toBe(2);
    expect(summary.out).toBe(2);
    expect(summary.totalIngredients).toBe(5);
    expect(summary.totalStockValue).toBe(10 * 2 + 5 * 1 + 2 * 3 + 0 * 4 + -1 * 1); // 30
  });
});
