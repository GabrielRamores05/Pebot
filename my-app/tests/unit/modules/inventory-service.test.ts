import { describe, it, expect, vi, beforeEach } from 'vitest';

const mocks = vi.hoisted(() => ({
  findInventoryWithProductDetails: vi.fn(),
  countRequiredProductIngredients: vi.fn(),
  updateInventory: vi.fn(),
}));

vi.mock('../../../modules/inventory/repository', () => mocks);
vi.mock('@/lib/availability', () => ({ recomputeProduct: vi.fn() }));
vi.mock('@/lib/socket', () => ({ emitEvent: vi.fn() }));
vi.mock('@/lib/prisma', () => ({ prisma: {} }));

import { listInventory, updateInventory, ProductHasRecipeError } from '../../../modules/inventory/service';

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
});
