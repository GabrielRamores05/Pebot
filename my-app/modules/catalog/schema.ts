import { z } from 'zod';

export const CategorySchema = z.object({
  id: z.number().int().positive(),
  name: z.string().min(1, 'Name is required'),
  icon: z.string().nullable().optional(),
  sortOrder: z.number().int().default(0),
  locationId: z.number().int().positive().default(1),
});

export const CreateCategoryInputSchema = z.object({
  name: z.string().min(1, 'Name is required'),
  icon: z.string().optional().nullable(),
  sortOrder: z.number().int().optional(),
});

export const UpdateCategoryInputSchema = z.object({
  id: z.number({ message: 'Category ID is required' }),
  name: z.string().min(1).optional(),
  icon: z.string().optional().nullable(),
  sortOrder: z.number().int().optional(),
});

export const DeleteCategoryInputSchema = z.object({
  id: z.number({ message: 'Category ID is required' }),
});

export type Category = z.infer<typeof CategorySchema>;
export type CreateCategoryInput = z.infer<typeof CreateCategoryInputSchema>;
export type UpdateCategoryInput = z.infer<typeof UpdateCategoryInputSchema>;
export type DeleteCategoryInput = z.infer<typeof DeleteCategoryInputSchema>;
