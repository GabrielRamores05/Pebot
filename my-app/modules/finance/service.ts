import { z } from 'zod';
import { fromZodError } from 'zod-validation-error';
import { emitEvent } from '@/lib/socket';
import { computePhilippinePayroll } from '@/lib/philippine-payroll';
import { defaultHolidays, nightHours, periodPay, serviceChargeShares, thirteenthMonthPay, type DayType } from '@/lib/labor-pay';
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

const localIso = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

/** Holidays for the years a period touches, filling the year's defaults the first time (spec 021). */
async function holidayMap(periodStart: string, periodEnd: string) {
  for (let y = Number(periodStart.slice(0, 4)); y <= Number(periodEnd.slice(0, 4)); y++) {
    if ((await hrRepo.countHolidaysForYear(y)) === 0) await hrRepo.createHolidays(defaultHolidays(y));
  }
  const rows = await hrRepo.listHolidaysBetween(periodStart, periodEnd);
  return new Map(rows.map((h) => [h.date, h.type as DayType]));
}

export async function createPayroll(input: unknown, approvedById: number) {
  const data = parseInput(
    z.object({
      userId: z.number(),
      periodStart: z.string(),
      periodEnd: z.string(),
      deductions: z.number().nonnegative().optional(),
      overtimeRate: z.number().optional(),
      serviceChargeShare: z.number().nonnegative().optional(),
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

  // Spec 021: holiday, rest-day, overtime and night rates; salary prorated to the period.
  let holidays = new Map<string, DayType>();
  let scheduled: Date[] = [];
  try {
    holidays = await holidayMap(data.periodStart, data.periodEnd);
    scheduled = (await hrRepo.listScheduleDates(data.userId, data.periodStart, data.periodEnd)) ?? [];
  } catch (e) {
    // Pay is still computed; it just cannot apply holiday or rest-day rates.
    console.error('Payroll: could not read holidays or schedules, paying ordinary rates:', e);
  }
  const salaried = user.paymentType === 'SALARIED' && Boolean(user.monthlySalary);
  const pay = periodPay({
    shifts: attendance.map((a) => {
      const inAt = a.clockIn ? new Date(a.clockIn) : null;
      const outAt = a.clockOut ? new Date(a.clockOut) : null;
      return {
        date: inAt ? localIso(inAt) : null,
        hours: a.totalHours ?? 0,
        nightHours: inAt && outAt ? nightHours(inAt, outAt) : 0,
      };
    }),
    holidays,
    scheduledDates: scheduled.length ? new Set(scheduled.map((d) => localIso(new Date(d)))) : null,
    hourlyRate: user.hourlyRate ?? 0,
    salary: salaried ? { monthly: user.monthlySalary!, periodStart: data.periodStart, periodEnd: data.periodEnd } : null,
  });
  const regularHours = pay.regularHours;
  const overtimeHours = pay.overtimeHours;
  const serviceChargeShare = data.serviceChargeShare ?? 0;
  const grossPay = pay.grossPay + serviceChargeShare;
  // Contributions use a monthly basis: the salary, or for hourly staff this period's pay.
  const base = salaried ? user.monthlySalary! : grossPay;

  const otherDeductions = data.deductions ?? 0;
  const result = {
    ...computePhilippinePayroll({ grossPay, base, otherDeductions, overtimeHours }),
    basicPay: pay.basicPay,
    holidayPremium: pay.holidayPremium,
    overtimePay: pay.overtimePay,
    nightDiff: pay.nightDiff,
    nightHours: pay.nightHours,
    serviceChargeShare,
    daysWorked: pay.days,
  };

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

/** Run payroll for every active staff member with pay set up (spec 021). */
export async function runPayrollForAll(input: unknown, approvedById: number) {
  const data = parseInput(
    z.object({ periodStart: z.string(), periodEnd: z.string(), includeServiceCharge: z.boolean().optional() }),
    input,
  );
  const staff = await hrRepo.listPayableStaff();
  let shares: Record<number, number> = {};
  let serviceChargeTotal = 0;
  if (data.includeServiceCharge) {
    serviceChargeTotal = await hrRepo.sumServiceCharge(data.periodStart, data.periodEnd);
    const worked = new Set(await hrRepo.listUserIdsWithAttendance(data.periodStart, data.periodEnd));
    shares = serviceChargeShares(serviceChargeTotal, staff.filter((s) => worked.has(s.id)).map((s) => s.id));
  }
  const created = [];
  const skipped: { name: string; reason: string }[] = [];
  for (const s of staff) {
    if (s.paymentType === 'HOURLY' && !s.hourlyRate) { skipped.push({ name: s.name, reason: 'No hourly rate' }); continue; }
    if (s.paymentType === 'SALARIED' && !s.monthlySalary) { skipped.push({ name: s.name, reason: 'No monthly salary' }); continue; }
    created.push(await createPayroll({ userId: s.id, periodStart: data.periodStart, periodEnd: data.periodEnd, serviceChargeShare: shares[s.id] ?? 0 }, approvedById));
  }
  return { created: created.length, skipped, serviceChargeTotal, records: created };
}

/** 13th-month pay for a year: basic pay earned (from payroll runs) ÷ 12 (spec 021). */
export async function thirteenthMonthReport(input: unknown) {
  const { year } = parseInput(z.object({ year: z.number().int().min(2000).max(2100) }), input);
  const rows = await hrRepo.listPayrollsEndingIn(`${year}-01-01`, `${year}-12-31`);
  const byUser = new Map<number, { name: string; position: string | null; basic: number; runs: number }>();
  for (const r of rows) {
    let basic = r.grossPay;
    try {
      const b = r.breakdown ? JSON.parse(r.breakdown) : null;
      if (b && typeof b.basicPay === 'number') basic = b.basicPay;
    } catch { /* older run without a breakdown: gross pay is the best record */ }
    const cur = byUser.get(r.userId) ?? { name: r.user?.name ?? 'Staff', position: r.user?.position ?? null, basic: 0, runs: 0 };
    cur.basic += basic;
    cur.runs += 1;
    byUser.set(r.userId, cur);
  }
  const staff = [...byUser.entries()].map(([userId, v]) => ({
    userId, name: v.name, position: v.position, runs: v.runs,
    basicEarned: Math.round(v.basic * 100) / 100,
    thirteenthMonth: thirteenthMonthPay(v.basic),
  })).sort((a, b) => a.name.localeCompare(b.name));
  return { year, staff, total: Math.round(staff.reduce((n, s) => n + s.thirteenthMonth, 0) * 100) / 100 };
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
