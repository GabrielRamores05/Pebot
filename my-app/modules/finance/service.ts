import { z } from 'zod';
import { fromZodError } from 'zod-validation-error';
import { emitEvent } from '@/lib/socket';
import { computePhilippinePayroll } from '@/lib/philippine-payroll';
import * as financeRepo from '@/modules/finance/repository';
import * as hrRepo from '@/modules/hr/repository';
import * as ordersRepo from '@/modules/orders/repository';

function parseInput<T>(schema: z.ZodSchema<T>, input: unknown): T {
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

export async function listExpenses(input: unknown) {
  const params = parseInput(
    z.object({
      categoryId: z.number().optional(),
      supplierId: z.number().optional(),
    }),
    input,
  );
  const filters: { categoryId?: number; supplierId?: number } = {};
  if (params.categoryId !== undefined) filters.categoryId = params.categoryId;
  if (params.supplierId !== undefined) filters.supplierId = params.supplierId;
  return financeRepo.listExpenses(filters);
}

export async function createExpense(input: unknown, approvedById: number) {
  const data = parseInput(
    z.object({
      categoryId: z.number(),
      supplierId: z.number().nullable().optional(),
      amount: z.number().positive(),
      description: z.string().nullable().optional(),
      expenseDate: z.string().optional(),
    }),
    input,
  );

  const category = await financeRepo.findExpenseCategoryUnique(data.categoryId);
  if (!category) {
    throw setErrorStatus(new Error('Category not found'), 404);
  }

  const expense = await financeRepo.createExpense({
    categoryId: data.categoryId,
    supplierId: data.supplierId ?? null,
    userId: approvedById,
    amount: data.amount,
    description: data.description ?? null,
    expenseDate: data.expenseDate ? new Date(data.expenseDate) : new Date(),
  });

  return expense;
}

export async function updateExpense(input: unknown) {
  const data = parseInput(
    z.object({
      id: z.number(),
      categoryId: z.number().optional(),
      supplierId: z.number().nullable().optional(),
      amount: z.number().positive().optional(),
      description: z.string().nullable().optional(),
      expenseDate: z.string().optional(),
    }),
    input,
  );

  const updateData: Record<string, unknown> = {};
  if (data.categoryId !== undefined) updateData.categoryId = data.categoryId;
  if (data.supplierId !== undefined) updateData.supplierId = data.supplierId ?? null;
  if (data.amount !== undefined) updateData.amount = data.amount;
  if (data.description !== undefined) updateData.description = data.description ?? null;
  if (data.expenseDate !== undefined) updateData.expenseDate = new Date(data.expenseDate);

  try {
    return await financeRepo.updateExpense(data.id, updateData);
  } catch (e: any) {
    if (e.code === 'P2025') {
      throw setErrorStatus(new Error('Expense not found'), 404);
    }
    throw e;
  }
}

export async function deleteExpense(input: unknown) {
  const data = parseInput(z.object({ id: z.number() }), input);

  try {
    await financeRepo.deleteExpense(data.id);
    return { success: true };
  } catch (e: any) {
    if (e.code === 'P2025') {
      throw setErrorStatus(new Error('Expense not found'), 404);
    }
    throw e;
  }
}

export async function listExpenseCategories() {
  return financeRepo.listExpenseCategories();
}

export async function createExpenseCategory(input: unknown) {
  const data = parseInput(
    z.object({
      name: z.string().min(1),
      description: z.string().nullable().optional(),
    }),
    input,
  );

  try {
    return await financeRepo.createExpenseCategory({
      name: data.name,
      description: data.description ?? null,
    });
  } catch (e: any) {
    if (e.code === 'P2002') {
      throw setErrorStatus(new Error('Category already exists'), 409);
    }
    throw e;
  }
}

export async function listPayrolls(input: unknown) {
  const params = parseInput(
    z.object({
      userId: z.number().optional(),
      status: z.string().optional(),
    }),
    input,
  );
  const filters: { userId?: number; status?: string } = {};
  if (params.userId !== undefined) filters.userId = params.userId;
  if (params.status) filters.status = params.status;
  return hrRepo.listPayrolls(filters);
}

export async function createPayroll(input: unknown, approvedById: number) {
  const data = parseInput(
    z.object({
      userId: z.number(),
      periodStart: z.string(),
      periodEnd: z.string(),
      deductions: z.number().nonnegative().optional(),
      overtimeRate: z.number().optional(),
    }),
    input,
  );

  const user = await hrRepo.findUserById(data.userId);
  if (!user) {
    throw setErrorStatus(new Error('Staff not found'), 404);
  }

  const attendance = await hrRepo.listAttendanceForPayroll(
    data.userId,
    data.periodStart,
    data.periodEnd,
  );

  let regularHours = 0;
  let overtimeHours = 0;
  for (const a of attendance) {
    const h = a.totalHours ?? 0;
    regularHours += Math.min(h, 8);
    overtimeHours += Math.max(0, h - 8);
  }

  let grossPay = 0;
  let base = 0;
  if (user.paymentType === 'SALARIED' && user.monthlySalary) {
    grossPay = user.monthlySalary;
    base = user.monthlySalary;
  } else if (user.hourlyRate) {
    const rate = user.hourlyRate;
    const otRate = data.overtimeRate ?? rate * 1.25;
    grossPay = regularHours * rate + overtimeHours * otRate;
    base = grossPay;
  }

  const otherDeductions = data.deductions ?? 0;
  const result = computePhilippinePayroll({ grossPay, base, otherDeductions, overtimeHours });

  const payroll = await hrRepo.createPayroll({
    userId: data.userId,
    periodStart: new Date(data.periodStart),
    periodEnd: new Date(data.periodEnd),
    regularHours,
    overtimeHours,
    grossPay: result.grossPay,
    deductions: result.statutoryEmployeeTotal + result.withholdingTax + otherDeductions,
    netPay: result.netPay,
    breakdown: JSON.stringify(result),
    status: 'DRAFT',
    processedById: approvedById,
  });

  return payroll;
}

export async function updatePayrollStatus(input: unknown) {
  const data = parseInput(
    z.object({
      id: z.number(),
      status: z.string(),
    }),
    input,
  );

  return hrRepo.updatePayrollStatus(data.id, data.status);
}

export async function createPayment(input: unknown) {
  const data = parseInput(
    z.object({
      orderId: z.number(),
      method: z.enum(['CASH', 'CARD', 'EWALLET']),
      referenceNo: z.string().optional(),
      terminalId: z.string().optional(),
    }),
    input,
  );

  const payment = await ordersRepo.createPaymentAndCompleteOrder(
    data.orderId,
    {
      method: data.method,
      referenceNo: data.referenceNo,
      terminalId: data.terminalId,
    },
  );

  const updatedOrder = await ordersRepo.findOrderWithPaymentDetails(data.orderId);

  emitEvent('order-status-update', updatedOrder);
  emitEvent('analytics-update', { type: 'payment-completed', order: updatedOrder });

  return payment;
}

export async function listPayments() {
  return ordersRepo.findPaymentTransactions();
}
