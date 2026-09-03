import { describe, expect, test } from 'vitest';
import {
  clearUnknownSupplierLinks,
  normalizeTransactionRow,
  supplierIdFromExport,
} from '../../../modules/tablet/ingest';

describe('tablet ingest: supplier link on ingredient rows (spec 014 T025)', () => {
  test('reads the tablet lastSupplierId field into the web supplierId value', () => {
    expect(supplierIdFromExport({ lastSupplierId: 3 })).toBe(3);
    expect(supplierIdFromExport({ supplierId: 4 })).toBe(4);
    // explicit null / empty means "clear the cache"
    expect(supplierIdFromExport({ lastSupplierId: null })).toBeNull();
    expect(supplierIdFromExport({ lastSupplierId: '' })).toBeNull();
    // absent field leaves the cache alone
    expect(supplierIdFromExport({})).toBeUndefined();
  });
});

describe('tablet ingest: transaction normalization (spec 014 T025)', () => {
  test('maps a supplier-linked purchase incl. reference fields', () => {
    const row = normalizeTransactionRow({
      id: 7,
      ingredientId: 12,
      type: 'PURCHASE',
      quantity: 5000,
      referenceType: 'supplier',
      referenceId: 3,
      purchaseUnit: 'kg',
      purchaseCost: 1100,
      unitCost: 0.55,
      notes: 'Arabica 5kg sack',
      createdAt: 1700000000000,
    });
    expect(row).toEqual({
      id: 7,
      ingredientId: 12,
      type: 'PURCHASE',
      quantity: 5000,
      referenceType: 'supplier',
      referenceId: 3,
      purchaseUnit: 'kg',
      purchaseCost: 1100,
      unitCost: 0.55,
      notes: 'Arabica 5kg sack',
      createdAt: new Date(1700000000000),
    });
  });

  test('keeps VOID_PURCHASE rows (type + referenceType void-of) intact', () => {
    const row = normalizeTransactionRow({
      id: 9,
      ingredientId: 12,
      type: 'VOID_PURCHASE',
      quantity: -2000,
      referenceType: 'void-of',
      referenceId: 7,
    });
    expect(row?.type).toBe('VOID_PURCHASE');
    expect(row?.referenceType).toBe('void-of');
    expect(row?.referenceId).toBe(7);
    expect(row?.quantity).toBe(-2000);
  });

  test('legacy rows without reference fields import unchanged (nulls)', () => {
    const row = normalizeTransactionRow({ ingredientId: 5, type: 'ADJUSTMENT', quantity: -3 });
    expect(row?.referenceType).toBeNull();
    expect(row?.referenceId).toBeNull();
    expect(row?.id).toBeNull(); // no source id → DB assigns
  });

  test('rejects unusable rows (missing ingredient, non-finite quantity)', () => {
    expect(normalizeTransactionRow({ type: 'PURCHASE', quantity: 1 })).toBeNull();
    expect(normalizeTransactionRow({ ingredientId: 1, type: 'PURCHASE', quantity: 'abc' })).toBeNull();
  });

  test('treats ISO string and numeric timestamps alike', () => {
    const iso = normalizeTransactionRow({ ingredientId: 1, type: 'PURCHASE', quantity: 1, createdAt: '2024-01-01T00:00:00.000Z' });
    expect(iso?.createdAt?.toISOString()).toBe('2024-01-01T00:00:00.000Z');
  });
});

describe('tablet ingest: unknown-supplier clearing (bridge rule)', () => {
  const rows = [
    normalizeTransactionRow({ id: 1, ingredientId: 10, type: 'PURCHASE', quantity: 1, referenceType: 'supplier', referenceId: 3 })!,
    normalizeTransactionRow({ id: 2, ingredientId: 11, type: 'PURCHASE', quantity: 1, referenceType: 'supplier', referenceId: 99 })!,
    normalizeTransactionRow({ id: 3, ingredientId: 12, type: 'PURCHASE', quantity: 1 })!, // legacy supplierless
    normalizeTransactionRow({ id: 4, ingredientId: 13, type: 'VOID_PURCHASE', quantity: -1, referenceType: 'void-of', referenceId: 1 })!,
  ];

  test('clears only references to suppliers the PC does not know', () => {
    const { rows: out, clearedSupplierLinks } = clearUnknownSupplierLinks(rows, new Set([3]));
    expect(clearedSupplierLinks).toBe(1);
    // known supplier link kept
    expect(out[0].referenceId).toBe(3);
    expect(out[0].referenceType).toBe('supplier');
    // unknown supplier: row kept, link cleared — never dropped
    expect(out[1].referenceId).toBeNull();
    expect(out[1].referenceType).toBeNull();
    // legacy + void rows untouched
    expect(out[2].referenceId).toBeNull();
    expect(out[3].referenceType).toBe('void-of');
    expect(out[3].referenceId).toBe(1);
  });

  test('never drops a record when the whole supplier set is unknown', () => {
    const { rows: out, clearedSupplierLinks } = clearUnknownSupplierLinks(rows, new Set());
    expect(clearedSupplierLinks).toBe(2);
    expect(out).toHaveLength(rows.length);
  });
});
