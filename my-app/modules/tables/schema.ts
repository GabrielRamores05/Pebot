import { z } from 'zod';

export const TableSchema = z.object({
  id: z.number().int().positive(),
  name: z.string(),
  slug: z.string(),
  capacity: z.number().int().default(4),
  currentOccupants: z.number().int().default(0),
  status: z.string().default('AVAILABLE'),
  section: z.string().nullable().optional(),
  positionX: z.number().nullable().optional(),
  positionY: z.number().nullable().optional(),
  occupiedSince: z.date().nullable().optional(),
  assignedOrderId: z.number().nullable().optional(),
  locationId: z.number().int().positive().default(1),
  createdAt: z.date().optional(),
  updatedAt: z.date().optional(),
});

export const ListTablesParamsSchema = z.object({
  locationId: z.number().int().positive().optional(),
});

export type ListTablesParams = z.infer<typeof ListTablesParamsSchema>;

export const CreateTableInputSchema = z.object({
  name: z.string().min(1, 'Table name is required'),
  capacity: z.number().int().min(0).optional(),
  section: z.string().optional().nullable(),
  positionX: z.number().optional().nullable(),
  positionY: z.number().optional().nullable(),
});

export type CreateTableInput = z.infer<typeof CreateTableInputSchema>;

export const UpdateTableInputSchema = z.object({
  id: z.number({ message: 'Table ID is required' }),
  status: z.string().optional(),
  name: z.string().min(1).optional(),
  capacity: z.number().int().positive().optional(),
  section: z.string().optional().nullable(),
  positionX: z.number().optional().nullable(),
  positionY: z.number().optional().nullable(),
});

export type UpdateTableInput = z.infer<typeof UpdateTableInputSchema>;

export const DeleteTableInputSchema = z.object({
  id: z.number({ message: 'Table ID is required' }),
  force: z.boolean().optional(),
});

export type DeleteTableInput = z.infer<typeof DeleteTableInputSchema>;

export const AdjustOccupantsInputSchema = z.object({
  id: z.number({ message: 'Table ID is required' }),
  action: z.enum(['add', 'remove', 'set', 'clear']).optional(),
  occupantCount: z.number().int().min(0).optional(),
  customerName: z.string().optional(),
});

export type AdjustOccupantsInput = z.infer<typeof AdjustOccupantsInputSchema>;

export const TableEntryInputSchema = z.object({
  tableId: z.number({ message: 'Table ID is required' }),
  occupants: z.number().int().positive(),
  customerName: z.string().min(1, 'Customer name is required'),
  moodEmoji: z.string().nullable().optional(),
  moodNote: z.string().nullable().optional(),
  sessionId: z.number().nullable().optional(),
});

export type TableEntryInput = z.infer<typeof TableEntryInputSchema>;

export const TableExitInputSchema = z.object({
  tableId: z.number({ message: 'Table ID is required' }),
  occupants: z.number().int().positive().optional(),
});

export type TableExitInput = z.infer<typeof TableExitInputSchema>;

export const CreateGuestInputSchema = z.object({
  tableId: z.number({ message: 'Table ID is required' }),
  sessionId: z.number({ message: 'Session ID is required' }),
  displayName: z.string().min(1, 'Display name is required'),
  moodEmoji: z.string().nullable().optional(),
  moodNote: z.string().nullable().optional(),
});

export type CreateGuestInput = z.infer<typeof CreateGuestInputSchema>;

export const UpdateGuestInputSchema = z.object({
  id: z.number({ message: 'Guest ID is required' }),
  moodEmoji: z.string().nullable().optional(),
  moodNote: z.string().nullable().optional(),
  active: z.boolean().optional(),
});

export type UpdateGuestInput = z.infer<typeof UpdateGuestInputSchema>;

export const CleanRequestInputSchema = z.object({
  tableId: z.number().int().positive().optional(),
  tableName: z.string().min(1).optional(),
}).refine((val) => val.tableId || val.tableName, {
  message: 'tableId or tableName is required',
});

export type CleanRequestInput = z.infer<typeof CleanRequestInputSchema>;
