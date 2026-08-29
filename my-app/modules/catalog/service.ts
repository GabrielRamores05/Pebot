import { fromZodError, ValidationError } from 'zod-validation-error';
import {
  CreateCategoryInput,
  CreateCategoryInputSchema,
  UpdateCategoryInput,
  UpdateCategoryInputSchema,
  DeleteCategoryInput,
  DeleteCategoryInputSchema,
} from '@/modules/catalog/schema';
import * as repo from '@/modules/catalog/repository';
import { ZodSchema } from 'zod';

export class CategoryNotFoundError extends Error {
  status = 404;
  constructor(id: number) {
    super(`Category with id ${id} not found`);
    this.name = 'CategoryNotFoundError';
  }
}

export class CategoryInUseError extends Error {
  status = 400;
  constructor(categoryName: string, count: number) {
    super(`Cannot delete category "${categoryName}" because it has ${count} product(s). Remove products first.`);
    this.name = 'CategoryInUseError';
  }
}

function parseInput<T>(schema: ZodSchema<T>, input: unknown): T {
  const result = schema.safeParse(input);
  if (!result.success) {
    throw fromZodError(result.error);
  }
  return result.data;
}

function setErrorStatus(e: Error, status: number): Error {
  (e as unknown as { status: number }).status = status;
  return e;
}

export async function listCategories(locationId = 1) {
  return repo.findCategoriesWithProducts(locationId);
}

export async function createCategory(input: unknown, locationId = 1) {
  const data = parseInput(CreateCategoryInputSchema, input);

  const trimmedName = data.name.trim();
  if (!trimmedName) {
    throw new Error('Name is required');
  }

  try {
    return await repo.createCategory(
      {
        name: trimmedName,
        icon: data.icon?.trim() || null,
        sortOrder: data.sortOrder ?? 0,
      },
      locationId,
    );
  } catch (e) {
    const msg = String(e);
    if (msg.includes('P2002') || msg.toLowerCase().includes('unique constraint')) {
      throw setErrorStatus(new Error('A category with this name already exists.'), 400);
    }
    throw e;
  }
}

export async function updateCategory(input: unknown, locationId = 1) {
  const data: UpdateCategoryInput = parseInput(UpdateCategoryInputSchema, input);

  const existing = await repo.findCategoryById(data.id, locationId);
  if (!existing) {
    throw new CategoryNotFoundError(data.id);
  }

  const updateData: Record<string, unknown> = {};
  if (data.name !== undefined) updateData.name = data.name.trim();
  if (data.icon !== undefined) updateData.icon = data.icon?.trim() || null;
  if (data.sortOrder !== undefined) updateData.sortOrder = data.sortOrder;

  return repo.updateCategory(data.id, updateData, locationId);
}

export async function deleteCategory(input: unknown, locationId = 1) {
  const data: DeleteCategoryInput = parseInput(DeleteCategoryInputSchema, input);

  const existing = await repo.findCategoryById(data.id, locationId);
  if (!existing) {
    throw new CategoryNotFoundError(data.id);
  }

  const productCount = await repo.countProductsByCategoryId(data.id, locationId);
  if (productCount > 0) {
    throw new CategoryInUseError(existing.name, productCount);
  }

  return repo.deleteCategory(data.id, locationId);
}
