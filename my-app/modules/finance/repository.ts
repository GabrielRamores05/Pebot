 
import { prisma } from '@/lib/prisma';

// ---------------------------------------------------------------------------
// Finance – ExpenseCategory + Expense (location-scoped)
// ---------------------------------------------------------------------------

// ----- ExpenseCategory – location-scoped -----

export async function listExpenseCategories(locationId: number = 1) {
  return prisma.expenseCategory.findMany({
    where: { locationId },
    include: { _count: { select: { expenses: true } } },
    orderBy: { name: 'asc' },
  });
}

export async function findExpenseCategoryById(id: number, locationId: number = 1) {
  return prisma.expenseCategory.findFirst({ where: { id, locationId } });
}

export async function createExpenseCategory(
  data: { name: string; description?: string | null },
  locationId: number = 1,
) {
  return prisma.expenseCategory.create({
    data: { name: data.name, description: data.description || null, locationId },
  });
}

// ----- Expense – location-scoped -----

export async function listExpenses(
  filters: { categoryId?: number; supplierId?: number },
  locationId: number = 1,
) {
  const where: Record<string, unknown> = { locationId };
  if (filters.categoryId) (where as any).categoryId = filters.categoryId;
  if (filters.supplierId) (where as any).supplierId = filters.supplierId;
  return prisma.expense.findMany({
    where: where as any,
    include: {
      category: true,
      supplier: true,
      user: { select: { name: true, email: true, role: true } },
    },
    orderBy: { expenseDate: 'desc' },
  });
}

export async function createExpense(
  data: { categoryId: number; supplierId?: number | null; userId: number; amount: number; description?: string | null; expenseDate?: Date },
  locationId: number = 1,
) {
  return prisma.expense.create({
    data: {
      categoryId: data.categoryId,
      supplierId: data.supplierId ?? null,
      userId: data.userId,
      amount: data.amount,
      description: data.description || null,
      expenseDate: data.expenseDate || new Date(),
      locationId,
    },
    include: { category: true, supplier: true },
  } as any);
}

export async function updateExpense(
  id: number,
  data: Record<string, any>,
  _locationId: number = 1,
) {
  return prisma.expense.update({
    where: { id },
    data: data as any,
    include: { category: true, supplier: true },
  } as any);
}

export async function deleteExpense(id: number, _locationId: number = 1) {
  return prisma.expense.delete({ where: { id } });
}

// ----- PaymentTransaction – no locationId, but included via Order -----

export async function findPaymentTransactions(_locationId: number = 1, take: number = 100) {
  return prisma.paymentTransaction.findMany({
    include: { order: true },
    orderBy: { createdAt: 'desc' },
    take,
  });
}

export async function findExpenseCategoryUnique(id: number) {
  return prisma.expenseCategory.findUnique({ where: { id } });
}
