import { z } from 'zod';

export const ListOrdersInputSchema = z.object({
  status: z.string().optional(),
  date: z.string().optional(),
  search: z.string().optional(),
  all: z.boolean().optional(),
});

export type ListOrdersInput = z.infer<typeof ListOrdersInputSchema>;

export const OrderItemInputSchema = z.object({
  productId: z.number().int().positive(),
  quantity: z.number().int().positive(),
  notes: z.string().optional(),
  optionIds: z.array(z.number()).optional(),
});

export type OrderItemInput = z.infer<typeof OrderItemInputSchema>;

export const DiscountHolderSchema = z.object({
  type: z.enum(['SENIOR', 'PWD']),
  name: z.string().trim().min(1, "Enter the ID holder's name."),
  idNumber: z.string().trim().min(1, "Enter the ID holder's ID number."),
});

export type DiscountHolder = z.infer<typeof DiscountHolderSchema>;

/** Discount chosen at the POS terminal (spec 017). Staff only. */
export const OrderDiscountSchema = z.discriminatedUnion('kind', [
  z.object({
    kind: z.literal('STATUTORY'),
    diners: z.number().int().positive(),
    holders: z.array(DiscountHolderSchema).min(1, 'Add at least one Senior Citizen or PWD ID holder.'),
  }),
  z.object({ kind: z.literal('STUDENT') }),
]);

export type OrderDiscount = z.infer<typeof OrderDiscountSchema>;

export const CreateOrderInputSchema = z.object({
  customerName: z.string().min(1, 'Customer name is required'),
  loyaltyCustomerName: z.string().nullable().optional(),
  tableId: z.number().int().positive().optional(),
  sessionId: z.number().int().positive().nullable().optional(),
  items: z.array(OrderItemInputSchema).min(1, 'At least one item is required'),
  notes: z.string().optional(),
  loyaltyVoucherCodes: z.array(z.string()).optional(),
  loyaltySelection: z.record(z.string(), z.number()).optional(),
  paymentMethod: z.enum(['CASH', 'CARD', 'GCASH', 'MAYA', 'KEEP', 'OTHER']).optional(),
  paymentScreenshot: z.string().optional(),
  paymentConfirmed: z.boolean().optional(),
  overrideStock: z.boolean().optional(),
  orderType: z.enum(['DINE_IN', 'TAKEOUT', 'DELIVERY']).optional(),
  deliveryAddress: z.string().nullable().optional(),
  loyaltyAssignments: z
    .array(
      z.object({
        productId: z.number().int().positive(),
        quantity: z.number().int().positive(),
        loyaltyCardIds: z.array(z.number()),
        quantitiesPerCard: z.array(z.number()),
      }),
    )
    .optional(),
  discount: OrderDiscountSchema.optional(),
  // Older clients (tablet import): a Student/PWD rate without VAT removal.
  discountRate: z.number().nonnegative().max(100).optional(),
  discountReason: z.string().optional(),
});

export type CreateOrderInput = z.infer<typeof CreateOrderInputSchema>;

export const UpdateOrderItemInputSchema = z.object({
  productId: z.number().int().positive(),
  quantity: z.number().int().positive(),
});

export type UpdateOrderItemInput = z.infer<typeof UpdateOrderItemInputSchema>;

export const UpdateOrderInputSchema = z.object({
  status: z.enum(['PENDING', 'PREPARING', 'READY', 'COMPLETED', 'CANCELLED']).optional(),
  tableId: z.number().int().positive().optional(),
  paymentConfirmed: z.boolean().optional(),
  addItems: z.array(UpdateOrderItemInputSchema).optional(),
});

export type UpdateOrderInput = z.infer<typeof UpdateOrderInputSchema>;

export const OrderMessageInputSchema = z.object({
  type: z.enum(['text', 'voice']).optional().default('text'),
  content: z.string().min(1, 'Message content is required'),
});

export type OrderMessageInput = z.infer<typeof OrderMessageInputSchema>;
