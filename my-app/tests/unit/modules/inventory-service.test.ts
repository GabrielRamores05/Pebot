import { describe, it, expect, vi, beforeEach } from 'vitest';

const mocks = vi.hoisted(() => ({
  findInventoryWithProductDetails: vi.fn(),
  countRequiredProductIngredients: vi.fn(),
  updateInventory: vi.fn(),
  recordIngredientPurchase: vi.fn(),
  voidIngredientPurchase: vi.fn(),
  bulkAdjustIngredients: vi.fn(),
  findIngredientById: vi.fn(),
  findIngredientPurchaseRows: vi.fn(),
  findVoidedPurchaseIds: vi.fn(),
  findSuppliersByIds: vi.fn(),
  findSupplierBrief: vi.fn(),
  findSupplierLinkedPurchaseRows: vi.fn(),
  findIngredients: vi.fn(),
  logAction: vi.fn(),
}));

vi.mock('../../../modules/inventory/repository', () => mocks);
vi.mock('@/lib/availability', () => ({ recomputeProduct: vi.fn() }));
vi.mock('@/lib/socket', () => ({ emitEvent: vi.fn() }));
vi.mock('@/lib/prisma', () => ({ prisma: {} }));
vi.mock('@/lib/audit-log', () => ({ logAction: mocks.logAction }));

import {
  listInventory,
  updateInventory,
  ProductHasRecipeError,
  recordPurchase,
  voidIngredientPurchase,
  bulkAdjustStock,
  getIngredientPurchaseHistory,
  getSupplierPurchaseInsights,
  getInventorySummary,
  IngredientNotFoundError,
} from '../../../modules/inventory/service';

describe('inventory service', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('listInventory', () => {
    it('calls repository with default locationId', async () => {
      mocks.findInventoryWithProductDetails.mockResolvedValue([]);
      await listInventory();
      expect(mocks.findInventoryWithProductDetails).toHaveBeenCalledWith(1);
    });

    it('passes locationId through', async () => {
      mocks.findInventoryWithProductDetails.mockResolvedValue([]);
      await listInventory(42);
      expect(mocks.findInventoryWithProductDetails).toHaveBeenCalledWith(42);
    });

    it('returns the result from repository', async () => {
      const result = [{ id: 1, productId: 1, quantity: 10, lowStockThreshold: 5 }];
      mocks.findInventoryWithProductDetails.mockResolvedValue(result);
      const r = await listInventory();
      expect(r).toEqual(result);
    });
  });

  describe('updateInventory', () => {
    it('throws ProductHasRecipeError when product has recipe and quantity is set', async () => {
      mocks.countRequiredProductIngredients.mockResolvedValue(2);
      await expect(updateInventory({ productId: 1, quantity: 10 })).rejects.toThrow(ProductHasRecipeError);
    });

    it('allows lowStockThreshold update even with recipe', async () => {
      mocks.countRequiredProductIngredients.mockResolvedValue(3);
      mocks.updateInventory.mockResolvedValue({ id: 1, productId: 1, quantity: 0, lowStockThreshold: 5 });
      const result = await updateInventory({ productId: 1, lowStockThreshold: 5 });
      expect(mocks.updateInventory).toHaveBeenCalledWith(1, { lowStockThreshold: 5 }, 1);
      expect(result.lowStockThreshold).toBe(5);
    });

    it('uses increment when adjustment is provided', async () => {
      mocks.countRequiredProductIngredients.mockResolvedValue(0);
      mocks.updateInventory.mockResolvedValue({ id: 1, productId: 1, quantity: 15, lowStockThreshold: 5 });
      const result = await updateInventory({ productId: 1, adjustment: 5 });
      expect(mocks.updateInventory).toHaveBeenCalledWith(1, { quantity: { increment: 5 } }, 1);
      expect(result.quantity).toBe(15);
    });

    it('uses quantity directly when provided', async () => {
      mocks.countRequiredProductIngredients.mockResolvedValue(0);
      mocks.updateInventory.mockResolvedValue({ id: 1, productId: 1, quantity: 50, lowStockThreshold: 5 });
      await updateInventory({ productId: 1, quantity: 50 });
      expect(mocks.updateInventory).toHaveBeenCalledWith(1, { quantity: 50 }, 1);
    });

    it('throws ValidationError on missing productId', async () => {
      await expect(updateInventory({ quantity: 10 })).rejects.toThrow();
    });

    it('allows setting quantity when product has no recipe', async () => {
      mocks.countRequiredProductIngredients.mockResolvedValue(0);
      mocks.updateInventory.mockResolvedValue({ id: 1, productId: 1, quantity: 20, lowStockThreshold: 5 });
      const result = await updateInventory({ productId: 1, quantity: 20, lowStockThreshold: 3 });
      expect(mocks.updateInventory).toHaveBeenCalledWith(1, { quantity: 20, lowStockThreshold: 3 }, 1);
      expect(result.quantity).toBe(20);
    });
  });

  describe('recordPurchase (spec 014 US1 + audit)', () => {
    it('rejects a non-positive quantity before any repository write', async () => {
      await expect(
        recordPurchase({ ingredientId: 1, quantity: 0, purchaseUnit: 'kg', purchaseCost: 100 }),
      ).rejects.toThrow();
      expect(mocks.recordIngredientPurchase).not.toHaveBeenCalled();
      expect(mocks.logAction).not.toHaveBeenCalled();
    });

    it('rejects a missing unit or negative cost', async () => {
      await expect(
        recordPurchase({ ingredientId: 1, quantity: 2, purchaseUnit: '', purchaseCost: 100 }),
      ).rejects.toThrow();
      await expect(
        recordPurchase({ ingredientId: 1, quantity: 2, purchaseUnit: 'kg', purchaseCost: -1 }),
      ).rejects.toThrow();
      expect(mocks.recordIngredientPurchase).not.toHaveBeenCalled();
    });

    it('delegates a valid purchase to the repository and writes an audit event', async () => {
      mocks.recordIngredientPurchase.mockResolvedValue({
        ingredient: { id: 1, currentStock: 12000, costPerUnit: 0.55, supplierId: 3 },
        transaction: { id: 7, unitCost: 0.55 },
        pricePerUnit: 550,
        newStock: 12000,
        newWeightedCost: 0.55,
      });
      const result = await recordPurchase(
        { ingredientId: 1, quantity: 2, purchaseUnit: 'kg', purchaseCost: 1100, supplierId: 3 },
        { userId: 9 },
      );
      expect(mocks.recordIngredientPurchase).toHaveBeenCalledWith(
        expect.objectContaining({
          ingredientId: 1,
          quantity: 2,
          purchaseUnit: 'kg',
          purchaseCost: 1100,
          supplierId: 3,
          userId: 9,
        }),
        1,
      );
      expect(mocks.logAction).toHaveBeenCalledWith(
        expect.objectContaining({
          action: 'PURCHASE_RECORD',
          resource: 'ingredient_transaction',
          resourceId: 7,
          userId: 9,
          details: expect.objectContaining({ ingredientId: 1, unitCost: 0.55, supplierId: 3 }),
        }),
      );
      expect(result.newStock).toBe(12000);
    });
  });

  describe('voidIngredientPurchase (spec 014 FR-009 + audit)', () => {
    it('voids through the repository and writes an audit event', async () => {
      mocks.voidIngredientPurchase.mockResolvedValue({
        ingredient: { id: 1, currentStock: 10000 },
        voidRow: { id: 8 },
        voidedIsLatest: true,
      });
      const result = await voidIngredientPurchase({ transactionId: 7 }, { userId: 2 });
      expect(mocks.voidIngredientPurchase).toHaveBeenCalledWith(7);
      expect(mocks.logAction).toHaveBeenCalledWith(
        expect.objectContaining({
          action: 'VOID_PURCHASE',
          resource: 'ingredient_transaction',
          resourceId: 7,
          details: expect.objectContaining({ ingredientId: 1, voidRowId: 8, voidedIsLatest: true }),
        }),
      );
      expect(result.voidedIsLatest).toBe(true);
    });

    it('rejects an invalid transaction id', async () => {
      await expect(voidIngredientPurchase({ transactionId: -1 })).rejects.toThrow();
      expect(mocks.voidIngredientPurchase).not.toHaveBeenCalled();
    });
  });

  describe('bulkAdjustStock (spec 014 US4 + audit)', () => {
    it('rejects an empty batch before any repository write', async () => {
      await expect(bulkAdjustStock({ rows: [] })).rejects.toThrow();
      expect(mocks.bulkAdjustIngredients).not.toHaveBeenCalled();
    });

    it('adjusts the whole batch through the repository and writes an audit event', async () => {
      mocks.bulkAdjustIngredients.mockResolvedValue({
        adjusted: [{ id: 1, name: 'Beans', currentStock: 800, baseUnit: 'g', adjustment: -200 }],
        transactionIds: [11, 12],
        batchId: 11,
      });
      const result = await bulkAdjustStock(
        { rows: [{ ingredientId: 1, adjustment: -200 }, { ingredientId: 2, adjustment: 100 }], notes: 'count' },
        { userId: 4 },
      );
      expect(mocks.bulkAdjustIngredients).toHaveBeenCalledWith(
        [{ ingredientId: 1, adjustment: -200 }, { ingredientId: 2, adjustment: 100 }],
        { userId: 4, notes: 'count' },
        1,
      );
      expect(mocks.logAction).toHaveBeenCalledWith(
        expect.objectContaining({
          action: 'BULK_ADJUST',
          resource: 'ingredient',
          resourceId: 0,
          userId: 4,
          details: expect.objectContaining({ batchId: 11, ingredientCount: 1 }),
        }),
      );
      expect(result.batchId).toBe(11);
    });
  });

  describe('getIngredientPurchaseHistory (spec 014 US2)', () => {
    it('throws when the ingredient does not exist', async () => {
      mocks.findIngredientById.mockResolvedValue(null);
      await expect(getIngredientPurchaseHistory(99)).rejects.toThrow(IngredientNotFoundError);
    });

    it('returns newest-first rows with supplier name and change vs previous', async () => {
      mocks.findIngredientById.mockResolvedValue({
        id: 1,
        name: 'Coffee Beans',
        baseUnit: 'g',
        currentStock: 12000,
        minStock: 2000,
        costPerUnit: 0.55,
        supplierId: 3,
      });
      mocks.findIngredientPurchaseRows.mockResolvedValue([
        { id: 1, ingredientId: 1, type: 'PURCHASE', quantity: 5000, purchaseUnit: 'kg', purchaseCost: 2000, unitCost: 0.4, referenceType: 'supplier', referenceId: 3, notes: null, createdAt: new Date('2024-01-01') },
        { id: 2, ingredientId: 1, type: 'PURCHASE', quantity: 2000, purchaseUnit: 'kg', purchaseCost: 1100, unitCost: 0.55, referenceType: 'supplier', referenceId: 3, notes: null, createdAt: new Date('2024-01-02') },
      ]);
      mocks.findVoidedPurchaseIds.mockResolvedValue(new Set([1]));
      mocks.findSuppliersByIds.mockResolvedValue([{ id: 3, name: 'Acme Grains' }]);

      const history = await getIngredientPurchaseHistory(1);
      // newest first
      expect(history.purchases).toHaveLength(2);
      expect(history.purchases[0].id).toBe(2);
      expect(history.purchases[0].voided).toBe(false);
      expect(history.purchases[0].enteredQuantity).toBe(2); // 2000 g expressed in kg
      expect(history.purchases[0].quantity).toBe(2000);
      expect(history.purchases[0].supplierName).toBe('Acme Grains');
      expect(history.purchases[0].change).toEqual({ delta: 0.15, percent: 37.5 }); // QS-1/+QS-2
      expect(history.purchases[1].change).toBeNull(); // first purchase
      expect(history.purchases[1].voided).toBe(true); // already has a VOID row
    });
  });

  describe('getSupplierPurchaseInsights (spec 014 US3)', () => {
    it('groups ledger rows per supplier and computes latest price + change', async () => {
      mocks.findSupplierBrief.mockResolvedValue([{ id: 3, name: 'Acme Grains', status: 'ACTIVE' }]);
      mocks.findSupplierLinkedPurchaseRows.mockResolvedValue([
        { id: 1, ingredientId: 10, type: 'PURCHASE', unitCost: 0.45, referenceType: 'supplier', referenceId: 3 },
        { id: 2, ingredientId: 10, type: 'PURCHASE', unitCost: 0.5, referenceType: 'supplier', referenceId: 3 },
      ]);
      mocks.findIngredients.mockResolvedValue([{ id: 10, name: 'Coffee Beans', baseUnit: 'g' }]);

      const insights = await getSupplierPurchaseInsights();
      expect(insights).toHaveLength(1);
      expect(insights[0].supplierName).toBe('Acme Grains');
      expect(insights[0].items).toHaveLength(1);
      expect(insights[0].items[0].ingredientName).toBe('Coffee Beans');
      expect(insights[0].items[0].latestUnitCost).toBe(0.5);
      expect(insights[0].items[0].change).toEqual({ delta: 0.05, percent: 11.11 });
    });

    it('returns an empty items list for a supplier without purchases', async () => {
      mocks.findSupplierBrief.mockResolvedValue([{ id: 8, name: 'Nobody Yet', status: 'ACTIVE' }]);
      mocks.findSupplierLinkedPurchaseRows.mockResolvedValue([]);
      mocks.findIngredients.mockResolvedValue([]);
      const insights = await getSupplierPurchaseInsights();
      expect(insights[0].items).toEqual([]);
    });
  });

  describe('getInventorySummary (spec 014 US5)', () => {
    it('aggregates healthy/low/out and stock value over ingredients', async () => {
      mocks.findIngredients.mockResolvedValue([
        { id: 1, currentStock: 100, minStock: 50, costPerUnit: 2 }, // healthy
        { id: 2, currentStock: 50, minStock: 50, costPerUnit: 1 }, // low (boundary)
        { id: 3, currentStock: 0, minStock: 10, costPerUnit: 5 }, // out
      ]);
      const summary = await getInventorySummary();
      expect(mocks.findIngredients).toHaveBeenCalledWith(1);
      expect(summary.healthy).toBe(1);
      expect(summary.low).toBe(1);
      expect(summary.out).toBe(1);
      expect(summary.totalStockValue).toBe(250);
    });
  });
});
