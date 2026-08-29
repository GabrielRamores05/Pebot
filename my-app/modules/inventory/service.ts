import { z } from 'zod';
import { fromZodError, ValidationError } from 'zod-validation-error';
import {
  ListInventoryParamsSchema,
  UpdateInventoryInputSchema,
} from '@/modules/inventory/schema';
import * as repo from '@/modules/inventory/repository';
import { recomputeProduct } from '@/lib/availability';
import { prisma } from '@/lib/prisma';
import { emitEvent } from '@/lib/socket';

export class ProductNotFoundError extends Error {
  status = 404;
  constructor(productId: number) {
    super(`Product with id ${productId} not found`);
    this.name = 'ProductNotFoundError';
  }
}

export class ProductHasRecipeError extends Error {
  status = 403;
  constructor() {
    super('This product derives its stock from a recipe. Adjust ingredient levels instead of setting product stock directly.');
    this.name = 'ProductHasRecipeError';
  }
}

function parseInput<T>(schema: z.ZodSchema<T>, input: unknown): T {
  const result = schema.safeParse(input);
  if (!result.success) {
    throw fromZodError(result.error);
  }
  return result.data;
}

export async function listInventory(locationId = 1) {
  return repo.findInventoryWithProductDetails(locationId);
}

export async function updateInventory(input: unknown, locationId = 1) {
  const data = parseInput(UpdateInventoryInputSchema, input);

  const hasRecipe = await repo.countRequiredProductIngredients(data.productId, locationId);

  const updateData: Record<string, unknown> = {};

  if (data.lowStockThreshold !== undefined) {
    updateData.lowStockThreshold = data.lowStockThreshold;
  }

  if (data.quantity !== undefined || data.adjustment !== undefined) {
    if (hasRecipe > 0) {
      throw new ProductHasRecipeError();
    }
    updateData.quantity = data.adjustment !== undefined
      ? { increment: data.adjustment }
      : data.quantity;
  }

  const inv = await repo.updateInventory(data.productId, updateData, locationId);

  await recomputeProduct(prisma, data.productId);

  emitEvent('inventory-update', [inv]);
  emitEvent('ingredients-update', []);

  if ((inv.quantity as number) <= (inv.lowStockThreshold as number)) {
    emitEvent('low-stock-alert', [inv]);
  }

  return inv;
}

export { ValidationError };
