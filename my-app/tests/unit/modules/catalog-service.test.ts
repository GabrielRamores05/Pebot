import { describe, it, expect, vi, beforeEach } from 'vitest';

const mocks = vi.hoisted(() => ({
  findCategoriesWithProducts: vi.fn(),
  createCategory: vi.fn(),
  updateCategory: vi.fn(),
  findCategoryById: vi.fn(),
  countProductsByCategoryId: vi.fn(),
  deleteCategory: vi.fn(),
}));

vi.mock('../../../modules/catalog/repository', () => ({
  findCategoriesWithProducts: mocks.findCategoriesWithProducts,
  createCategory: mocks.createCategory,
  updateCategory: mocks.updateCategory,
  findCategoryById: mocks.findCategoryById,
  countProductsByCategoryId: mocks.countProductsByCategoryId,
  deleteCategory: mocks.deleteCategory,
}));

import {
  listCategories,
  createCategory,
  updateCategory,
  deleteCategory,
  CategoryNotFoundError,
  CategoryInUseError,
} from '../../../modules/catalog/service';

describe('catalog/category service', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('listCategories', () => {
    it('calls repository with default locationId', async () => {
      mocks.findCategoriesWithProducts.mockResolvedValue([]);
      await listCategories();
      expect(mocks.findCategoriesWithProducts).toHaveBeenCalledWith(1);
    });

    it('passes locationId through', async () => {
      mocks.findCategoriesWithProducts.mockResolvedValue([]);
      await listCategories(42);
      expect(mocks.findCategoriesWithProducts).toHaveBeenCalledWith(42);
    });

    it('returns the list from repository', async () => {
      const mockResult = [{ id: 1, name: 'Drinks', sortOrder: 0, locationId: 1 }];
      mocks.findCategoriesWithProducts.mockResolvedValue(mockResult);
      const result = await listCategories();
      expect(result).toEqual(mockResult);
    });
  });

  describe('createCategory', () => {
    it('trims the category name', async () => {
      mocks.createCategory.mockResolvedValue({ id: 1, name: 'Drinks', sortOrder: 0, locationId: 1 });
      await createCategory({ name: '  Drinks  ', sortOrder: 0 }, 1);
      expect(mocks.createCategory).toHaveBeenCalledWith(
        { name: 'Drinks', icon: null, sortOrder: 0 },
        1,
      );
    });

    it('defaults sortOrder to 0 when not provided', async () => {
      mocks.createCategory.mockResolvedValue({ id: 1, name: 'Food', sortOrder: 0, locationId: 1 });
      await createCategory({ name: 'Food' });
      expect(mocks.createCategory).toHaveBeenCalledWith(
        { name: 'Food', icon: null, sortOrder: 0 },
        1,
      );
    });

    it('throws ValidationError on empty name', async () => {
      await expect(createCategory({ name: '' })).rejects.toThrow();
    });

    it('translates Prisma unique-constraint error to 400', async () => {
      mocks.createCategory.mockRejectedValue(new Error('P2002: unique constraint failed'));
      await expect(createCategory({ name: 'Drinks' })).rejects.toMatchObject({ status: 400 });
    });

    it('rethrows non-unique-constraint errors', async () => {
      mocks.createCategory.mockRejectedValue(new Error('connection refused'));
      await expect(createCategory({ name: 'Drinks' })).rejects.toThrow('connection refused');
    });
  });

  describe('updateCategory', () => {
    it('throws CategoryNotFoundError when category does not exist', async () => {
      mocks.findCategoryById.mockResolvedValue(null);
      await expect(updateCategory({ id: 999, name: 'New' })).rejects.toThrow(CategoryNotFoundError);
    });

    it('updates only provided fields', async () => {
      mocks.findCategoryById.mockResolvedValue({ id: 1, name: 'Old', sortOrder: 0, locationId: 1 });
      mocks.updateCategory.mockResolvedValue({ id: 1, name: 'New', sortOrder: 0, locationId: 1 });
      await updateCategory({ id: 1, name: '  New  ' });
      expect(mocks.updateCategory).toHaveBeenCalledWith(1, { name: 'New' }, 1);
    });

    it('throws ValidationError on missing id', async () => {
      await expect(updateCategory({ name: 'New' })).rejects.toThrow();
    });
  });

  describe('deleteCategory', () => {
    it('throws CategoryNotFoundError when category does not exist', async () => {
      mocks.findCategoryById.mockResolvedValue(null);
      await expect(deleteCategory({ id: 999 })).rejects.toThrow(CategoryNotFoundError);
    });

    it('throws CategoryInUseError when products are linked', async () => {
      mocks.findCategoryById.mockResolvedValue({ id: 1, name: 'Drinks', sortOrder: 0, locationId: 1 });
      mocks.countProductsByCategoryId.mockResolvedValue(3);
      await expect(deleteCategory({ id: 1 })).rejects.toThrow(CategoryInUseError);
    });

    it('deletes when no products are linked', async () => {
      mocks.findCategoryById.mockResolvedValue({ id: 1, name: 'Drinks', sortOrder: 0, locationId: 1 });
      mocks.countProductsByCategoryId.mockResolvedValue(0);
      mocks.deleteCategory.mockResolvedValue({ id: 1, name: 'Drinks', sortOrder: 0, locationId: 1 });
      const result = await deleteCategory({ id: 1 });
      expect(mocks.deleteCategory).toHaveBeenCalledWith(1, 1);
      expect(result).toEqual({ id: 1, name: 'Drinks', sortOrder: 0, locationId: 1 });
    });
  });
});
