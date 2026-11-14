import { prisma } from '@/lib/prisma';

/** Orders placed within [from, to), with the fields the end-of-day summary needs. */
export async function findOrdersForDay(locationId: number, from: Date, to: Date) {
  return prisma.order.findMany({
    where: { locationId, createdAt: { gte: from, lt: to } },
    orderBy: { createdAt: 'asc' },
    select: {
      orderNumber: true,
      status: true,
      paymentMethod: true,
      orderType: true,
      totalAmount: true,
      grossAmount: true,
      loyaltyDiscount: true,
      discountAmount: true,
      discountReason: true,
      discountHolders: true,
      vatRemoved: true,
      vatableSales: true,
      vatAmount: true,
      vatExemptSales: true,
      serviceCharge: true,
      paidAt: true,
      voidReason: true,
      refundAmount: true,
    },
  });
}

export async function findBusinessIdentity() {
  return prisma.businessSettings.findFirst({
    select: { businessName: true, businessAddress: true, tin: true, vatRegistered: true },
  });
}

// ── Profit report (spec 022) ─────────────────────────────────────────────
export async function findOrdersForProfit(locationId: number, from: Date, to: Date) {
  return prisma.order.findMany({
    where: { locationId, createdAt: { gte: from, lt: to } },
    select: { status: true, paidAt: true, totalAmount: true, refundAmount: true, serviceCharge: true },
  });
}

/** USAGE and ADJUSTMENT ledger rows in the range, with the ingredient's cost. */
export async function findStockMovementsForProfit(locationId: number, from: Date, to: Date) {
  return prisma.ingredientTransaction.findMany({
    where: { locationId, createdAt: { gte: from, lt: to }, type: { in: ['USAGE', 'ADJUSTMENT'] } },
    select: { type: true, quantity: true, unitCost: true, notes: true, ingredient: { select: { costPerUnit: true } } },
  });
}

export async function findExpensesForProfit(from: Date, to: Date) {
  return prisma.expense.findMany({
    where: { expenseDate: { gte: from, lt: to } },
    select: { amount: true, category: { select: { name: true } } },
  });
}

export async function findPayrollForProfit(from: Date, to: Date) {
  return prisma.payroll.findMany({
    where: { periodEnd: { gte: from, lt: to } },
    select: { grossPay: true, breakdown: true },
  });
}
