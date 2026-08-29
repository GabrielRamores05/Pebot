import { z } from 'zod';

export const CreateExpenseInputSchema = z.object({
  categoryId: z.number({ message: 'categoryId is required' }).int().positive(),
  supplierId: z.number().int().positive().nullable().optional(),
  amount: z.number({ message: 'amount is required' }).positive('Amount must be greater than 0'),
  description: z.string().nullable().optional(),
  expenseDate: z.string().datetime().optional(),
});

export type CreateExpenseInput = z.infer<typeof CreateExpenseInputSchema>;

export const UpdateExpenseInputSchema = z.object({
  id: z.number({ message: 'Expense ID is required' }),
  categoryId: z.number().int().positive().optional(),
  supplierId: z.number().int().positive().nullable().optional(),
  amount: z.number().positive().optional(),
  description: z.string().nullable().optional(),
  expenseDate: z.string().datetime().optional(),
});

export type UpdateExpenseInput = z.infer<typeof UpdateExpenseInputSchema>;

export const DeleteExpenseInputSchema = z.object({
  id: z.number({ message: 'Expense ID is required' }),
});

export type DeleteExpenseInput = z.infer<typeof DeleteExpenseInputSchema>;

export const ListExpensesParamsSchema = z.object({
  categoryId: z.number().int().positive().optional(),
  supplierId: z.number().int().positive().optional(),
});

export type ListExpensesParams = z.infer<typeof ListExpensesParamsSchema>;

export const CreateExpenseCategoryInputSchema = z.object({
  name: z.string().min(1, 'Category name is required'),
  description: z.string().nullable().optional(),
});

export type CreateExpenseCategoryInput = z.infer<typeof CreateExpenseCategoryInputSchema>;

export const CreatePayrollInputSchema = z.object({
  userId: z.number({ message: 'userId is required' }),
  periodStart: z.string().min(1, 'periodStart is required'),
  periodEnd: z.string().min(1, 'periodEnd is required'),
  overtimeRate: z.number().positive().optional(),
  deductions: z.number().nonnegative().optional(),
});

export type CreatePayrollInput = z.infer<typeof CreatePayrollInputSchema>;

export const UpdatePayrollInputSchema = z.object({
  id: z.number({ message: 'Payroll ID is required' }),
  status: z.string().min(1, 'status is required'),
});

export type UpdatePayrollInput = z.infer<typeof UpdatePayrollInputSchema>;

export const ListPayrollsParamsSchema = z.object({
  userId: z.number().optional(),
  status: z.string().optional(),
});

export type ListPayrollsParams = z.infer<typeof ListPayrollsParamsSchema>;

export const CreatePaymentInputSchema = z.object({
  orderId: z.number({ message: 'orderId is required' }).int().positive(),
  method: z.enum(['CASH', 'CARD', 'EWALLET']),
  referenceNo: z.string().optional(),
  terminalId: z.string().optional(),
});

export type CreatePaymentInput = z.infer<typeof CreatePaymentInputSchema>;
