import { z } from 'zod';

export const InventoryItemSchema = z.object({
  id: z.number().int().positive(),
  quantity: z.number().int(),
  lowStockThreshold: z.number().int(),
  productId: z.number().int().positive(),
  product: z.object({
    id: z.number().int().positive(),
    name: z.string(),
    categoryId: z.number().int(),
    category: z.object({ id: z.number().int(), name: z.string() }).nullable().optional(),
    _count: z.object({ ingredients: z.number().int() }).optional(),
  }),
});

export const ListInventoryParamsSchema = z.object({
  locationId: z.number().int().positive().optional(),
});

export type ListInventoryParams = z.infer<typeof ListInventoryParamsSchema>;

export const UpdateInventoryInputSchema = z.object({
  productId: z.number({ message: 'Product ID is required' }),
  quantity: z.number().int().optional(),
  lowStockThreshold: z.number().int().min(0).optional(),
  adjustment: z.number().int().optional(),
});

export type UpdateInventoryInput = z.infer<typeof UpdateInventoryInputSchema>;
