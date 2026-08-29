import { z } from 'zod';

export const VoucherStatusSchema = z.enum(['ACTIVE', 'REDEEMED', 'EXPIRED']);

export const RegisterCustomerInputSchema = z.object({
  customerName: z.string().min(1, 'Customer name is required'),
});

export type RegisterCustomerInput = z.infer<typeof RegisterCustomerInputSchema>;

export const CheckNameInputSchema = z.object({
  name: z.string().min(1, 'Name is required'),
});

export type CheckNameInput = z.infer<typeof CheckNameInputSchema>;

export const GetCardByCustomerInputSchema = z.object({
  customerName: z.string().min(1),
  categoryId: z.number().int().positive().optional(),
});

export type GetCardByCustomerInput = z.infer<typeof GetCardByCustomerInputSchema>;

export const AddCoffeesInputSchema = z.object({
  customerName: z.string().min(1),
  quantity: z.number().int().positive().default(1),
  categoryId: z.number().nullable().optional(),
});

export type AddCoffeesInput = z.infer<typeof AddCoffeesInputSchema>;

export const RenameCardInputSchema = z.object({
  customerName: z.string().min(1),
  newName: z.string().min(1, 'Name required'),
});

export type RenameCardInput = z.infer<typeof RenameCardInputSchema>;

export const DeleteCardInputSchema = z.object({
  customerName: z.string().min(1),
});

export type DeleteCardInput = z.infer<typeof DeleteCardInputSchema>;

export const RedeemVoucherInputSchema = z.object({
  code: z.string().min(1),
  orderId: z.number().optional(),
});

export type RedeemVoucherInput = z.infer<typeof RedeemVoucherInputSchema>;

export const UpdateSettingInputSchema = z.object({
  id: z.number().optional(),
  categoryId: z.number().nullable().optional(),
  coffeesRequiredForFree: z.number().int().min(1).optional(),
  enabled: z.boolean().optional(),
  cardColor: z.string().optional(),
  cardTitle: z.string().optional(),
  cardDescription: z.string().optional(),
  rewardType: z.string().optional(),
  rewardValue: z.number().optional(),
  isMilestoneMode: z.boolean().optional(),
  milestones: z.array(z.any()).optional(),
  maxHeldRewards: z.number().int().nonnegative().optional(),
});

export type UpdateSettingInput = z.infer<typeof UpdateSettingInputSchema>;

export const DeleteSettingInputSchema = z.object({
  id: z.number({ message: 'ID required' }),
});

export type DeleteSettingInput = z.infer<typeof DeleteSettingInputSchema>;

export const CreateVoucherInputSchema = z.object({
  customerName: z.string().min(1),
  discountType: z.enum(['FREE', 'PERCENTAGE', 'FIXED_AMOUNT']).optional(),
  discountValue: z.number().nonnegative().optional(),
  rewardName: z.string().optional(),
  minPurchase: z.number().nonnegative().optional(),
  maxRedemptions: z.number().int().positive().optional(),
  validDays: z.string().nullable().optional(),
  targetType: z.string().optional(),
  targetCategoryId: z.number().nullable().optional(),
  targetProductId: z.number().nullable().optional(),
  expiryDate: z.string().datetime().nullable().optional(),
});

export type CreateVoucherInput = z.infer<typeof CreateVoucherInputSchema>;
