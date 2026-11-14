import { describe, it, expect, vi, beforeEach } from 'vitest';

const mocks = vi.hoisted(() => ({
  listExpenses: vi.fn(),
  findExpenseCategoryUnique: vi.fn(),
  createExpense: vi.fn(),
  updateExpense: vi.fn(),
  deleteExpense: vi.fn(),
  listExpenseCategories: vi.fn(),
  createExpenseCategory: vi.fn(),
  findUserById: vi.fn(),
  listAttendanceForPayroll: vi.fn(),
  countHolidaysForYear: vi.fn(),
  createHolidays: vi.fn(),
  listHolidaysBetween: vi.fn(),
  listScheduleDates: vi.fn(),
  listPayableStaff: vi.fn(),
  sumServiceCharge: vi.fn(),
  listUserIdsWithAttendance: vi.fn(),
  listPayrollsEndingIn: vi.fn(),
  createPayroll: vi.fn(),
  updatePayrollStatus: vi.fn(),
  listPayrolls: vi.fn(),
  createPaymentAndCompleteOrder: vi.fn(),
  findOrderWithPaymentDetails: vi.fn(),
  findPaymentTransactions: vi.fn(),
}));

vi.mock('../../../modules/finance/repository', () => ({
  listExpenses: mocks.listExpenses,
  findExpenseCategoryUnique: mocks.findExpenseCategoryUnique,
  createExpense: mocks.createExpense,
  updateExpense: mocks.updateExpense,
  deleteExpense: mocks.deleteExpense,
  listExpenseCategories: mocks.listExpenseCategories,
  createExpenseCategory: mocks.createExpenseCategory,
}));
vi.mock('../../../modules/hr/repository', () => ({
  listPayrolls: mocks.listPayrolls,
  createPayroll: mocks.createPayroll,
  updatePayrollStatus: mocks.updatePayrollStatus,
  findUserById: mocks.findUserById,
  listAttendanceForPayroll: mocks.listAttendanceForPayroll,
  countHolidaysForYear: mocks.countHolidaysForYear,
  createHolidays: mocks.createHolidays,
  listHolidaysBetween: mocks.listHolidaysBetween,
  listScheduleDates: mocks.listScheduleDates,
  listPayableStaff: mocks.listPayableStaff,
  sumServiceCharge: mocks.sumServiceCharge,
  listUserIdsWithAttendance: mocks.listUserIdsWithAttendance,
  listPayrollsEndingIn: mocks.listPayrollsEndingIn,
}));
vi.mock('../../../modules/orders/repository', () => ({
  createPaymentAndCompleteOrder: mocks.createPaymentAndCompleteOrder,
  findOrderWithPaymentDetails: mocks.findOrderWithPaymentDetails,
  findPaymentTransactions: mocks.findPaymentTransactions,
}));
vi.mock('@/lib/socket', () => ({ emitEvent: vi.fn() }));
vi.mock('@/lib/philippine-payroll', () => ({
  computePhilippinePayroll: vi.fn(() => ({ grossPay: 50000, netPay: 45000, statutoryEmployeeTotal: 5000, withholdingTax: 0 })),
}));

import {
  listExpenses,
  createExpense,
  updateExpense,
  deleteExpense,
  listExpenseCategories,
  createExpenseCategory,
  listPayrolls,
  createPayroll,
  runPayrollForAll,
  thirteenthMonthReport,
  updatePayrollStatus,
  createPayment,
  listPayments,
} from '../../../modules/finance/service';

describe('finance service', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('listExpenses', () => {
    it('calls repository with no filters by default', async () => {
      mocks.listExpenses.mockResolvedValue([]);
      await listExpenses({});
      expect(mocks.listExpenses).toHaveBeenCalledWith({ categoryId: undefined, supplierId: undefined });
    });

    it('passes filters through', async () => {
      mocks.listExpenses.mockResolvedValue([]);
      await listExpenses({ categoryId: 5, supplierId: 3 });
      expect(mocks.listExpenses).toHaveBeenCalledWith({ categoryId: 5, supplierId: 3 });
    });
  });

  describe('createExpense', () => {
    it('throws 404 when category not found', async () => {
      mocks.findExpenseCategoryUnique.mockResolvedValue(null);
      await expect(createExpense({ categoryId: 1, amount: 100 }, 1)).rejects.toMatchObject({ status: 404 });
    });

    it('creates expense when category exists', async () => {
      mocks.findExpenseCategoryUnique.mockResolvedValue({ id: 1 });
      mocks.createExpense.mockResolvedValue({ id: 1, amount: 100 });
      const result = await createExpense({ categoryId: 1, amount: 100, description: 'Supplies' }, 5);
      expect(mocks.createExpense).toHaveBeenCalledWith({
        categoryId: 1, supplierId: null, userId: 5, amount: 100,
        description: 'Supplies', expenseDate: expect.any(Date),
      });
      expect(result.id).toBe(1);
    });

    it('throws ValidationError when amount is not positive', async () => {
      await expect(createExpense({ categoryId: 1, amount: -5 }, 1)).rejects.toThrow();
    });
  });

  describe('updateExpense', () => {
    it('throws 404 on P2025 error', async () => {
      const err = new Error('not found');
      (err as any).code = 'P2025';
      mocks.updateExpense.mockRejectedValue(err);
      await expect(updateExpense({ id: 999, amount: 100 })).rejects.toMatchObject({ status: 404 });
    });

    it('updates expense', async () => {
      mocks.updateExpense.mockResolvedValue({ id: 1, amount: 200 });
      const result = await updateExpense({ id: 1, amount: 200 });
      expect(mocks.updateExpense).toHaveBeenCalledWith(1, { amount: 200 });
    });
  });

  describe('deleteExpense', () => {
    it('throws 404 on P2025 error', async () => {
      const err = new Error('not found');
      (err as any).code = 'P2025';
      mocks.deleteExpense.mockRejectedValue(err);
      await expect(deleteExpense({ id: 999 })).rejects.toMatchObject({ status: 404 });
    });

    it('deletes expense', async () => {
      mocks.deleteExpense.mockResolvedValue({ id: 1 });
      const result = await deleteExpense({ id: 1 });
      expect(mocks.deleteExpense).toHaveBeenCalledWith(1);
      expect(result).toEqual({ success: true });
    });
  });

  describe('listExpenseCategories', () => {
    it('calls repository', async () => {
      mocks.listExpenseCategories.mockResolvedValue([]);
      await listExpenseCategories();
      expect(mocks.listExpenseCategories).toHaveBeenCalled();
    });
  });

  describe('createExpenseCategory', () => {
    it('creates category', async () => {
      mocks.createExpenseCategory.mockResolvedValue({ id: 1, name: 'Food' });
      const result = await createExpenseCategory({ name: 'Food', description: 'Food costs' });
      expect(mocks.createExpenseCategory).toHaveBeenCalledWith({ name: 'Food', description: 'Food costs' });
      expect(result.id).toBe(1);
    });

    it('throws 409 on unique constraint error', async () => {
      const err = new Error('duplicate');
      (err as any).code = 'P2002';
      mocks.createExpenseCategory.mockRejectedValue(err);
      await expect(createExpenseCategory({ name: 'Food' })).rejects.toMatchObject({ status: 409 });
    });
  });

  describe('listPayrolls', () => {
    it('calls repository with filters', async () => {
      mocks.listPayrolls.mockResolvedValue([]);
      await listPayrolls({ userId: 5, status: 'PAID' });
      expect(mocks.listPayrolls).toHaveBeenCalledWith({ userId: 5, status: 'PAID' });
    });
  });

  describe('createPayroll', () => {
    it('throws 404 when user not found', async () => {
      mocks.findUserById.mockResolvedValue(null);
      await expect(createPayroll({
        userId: 999, periodStart: '2025-01-01', periodEnd: '2025-01-31',
      }, 1)).rejects.toMatchObject({ status: 404 });
    });

    it('creates payroll with computed values', async () => {
      mocks.findUserById.mockResolvedValue({ id: 1, hourlyRate: 100, paymentType: 'HOURLY', monthlySalary: null });
      mocks.listAttendanceForPayroll.mockResolvedValue([
        { totalHours: 8 },
        { totalHours: 10 },
      ]);
      mocks.createPayroll.mockResolvedValue({ id: 1, grossPay: 1000 });
      const result = await createPayroll({
        userId: 1, periodStart: '2025-01-01', periodEnd: '2025-01-31',
      }, 5);
      expect(mocks.createPayroll).toHaveBeenCalledWith(expect.objectContaining({
        userId: 1, regularHours: 16, overtimeHours: 2, processedById: 5,
      }));
      expect(result.id).toBe(1);
    });
  });

  describe('payroll compliance (spec 021)', () => {
    beforeEach(() => {
      mocks.countHolidaysForYear.mockResolvedValue(16);
      mocks.listHolidaysBetween.mockResolvedValue([{ date: '2026-11-30', type: 'REGULAR_HOLIDAY' }]);
      mocks.listScheduleDates.mockResolvedValue([]);
      mocks.createPayroll.mockImplementation(async (d: { userId: number }) => ({ id: d.userId, ...d }));
    });

    it('pays a regular holiday at 200% and records the breakdown', async () => {
      mocks.findUserById.mockResolvedValue({ id: 1, hourlyRate: 100, paymentType: 'HOURLY', monthlySalary: null });
      mocks.listAttendanceForPayroll.mockResolvedValue([
        { totalHours: 8, clockIn: new Date('2026-11-29T09:00:00'), clockOut: new Date('2026-11-29T17:00:00') },
        { totalHours: 8, clockIn: new Date('2026-11-30T09:00:00'), clockOut: new Date('2026-11-30T17:00:00') },
      ]);
      await createPayroll({ userId: 1, periodStart: '2026-11-16', periodEnd: '2026-11-30' }, 5);
      const saved = mocks.createPayroll.mock.calls[0][0];
      const b = JSON.parse(saved.breakdown);
      expect(b).toMatchObject({ basicPay: 1600, holidayPremium: 800, daysWorked: 2 });
    });

    it('fills in the default holidays for the year the first time', async () => {
      mocks.countHolidaysForYear.mockResolvedValue(0);
      mocks.findUserById.mockResolvedValue({ id: 1, hourlyRate: 100, paymentType: 'HOURLY', monthlySalary: null });
      mocks.listAttendanceForPayroll.mockResolvedValue([]);
      await createPayroll({ userId: 1, periodStart: '2026-11-16', periodEnd: '2026-11-30' }, 5);
      expect(mocks.createHolidays).toHaveBeenCalledWith(expect.arrayContaining([expect.objectContaining({ date: '2026-11-30', type: 'REGULAR_HOLIDAY' })]));
    });

    it('runs payroll for everyone and shares the service charge among those who worked', async () => {
      mocks.listPayableStaff.mockResolvedValue([
        { id: 1, name: 'Ana', paymentType: 'HOURLY', hourlyRate: 80, monthlySalary: null },
        { id: 2, name: 'Ben', paymentType: 'HOURLY', hourlyRate: 80, monthlySalary: null },
        { id: 3, name: 'Cara', paymentType: 'HOURLY', hourlyRate: null, monthlySalary: null },
      ]);
      mocks.sumServiceCharge.mockResolvedValue(1000);
      mocks.listUserIdsWithAttendance.mockResolvedValue([1, 2]);
      mocks.findUserById.mockImplementation(async (id: number) => ({ id, hourlyRate: 80, paymentType: 'HOURLY', monthlySalary: null }));
      mocks.listAttendanceForPayroll.mockResolvedValue([]);
      const r = await runPayrollForAll({ periodStart: '2026-11-01', periodEnd: '2026-11-15', includeServiceCharge: true }, 5);
      expect(r.created).toBe(2);
      expect(r.skipped).toEqual([{ name: 'Cara', reason: 'No hourly rate' }]);
      const shares = mocks.createPayroll.mock.calls.map((c) => JSON.parse(c[0].breakdown).serviceChargeShare);
      expect(shares).toEqual([500, 500]);
    });

    it('works out 13th-month pay from basic pay earned in the year', async () => {
      mocks.listPayrollsEndingIn.mockResolvedValue([
        { userId: 1, grossPay: 13000, breakdown: JSON.stringify({ basicPay: 12000 }), user: { id: 1, name: 'Ana', position: 'Cashier' } },
        { userId: 1, grossPay: 12500, breakdown: JSON.stringify({ basicPay: 12000 }), user: { id: 1, name: 'Ana', position: 'Cashier' } },
        { userId: 2, grossPay: 6000, breakdown: null, user: { id: 2, name: 'Ben', position: 'Cook' } },
      ]);
      const r = await thirteenthMonthReport({ year: 2026 });
      expect(r.staff).toEqual([
        expect.objectContaining({ name: 'Ana', basicEarned: 24000, thirteenthMonth: 2000, runs: 2 }),
        expect.objectContaining({ name: 'Ben', basicEarned: 6000, thirteenthMonth: 500 }),
      ]);
      expect(r.total).toBe(2500);
    });
  });

  describe('updatePayrollStatus', () => {
    it('updates payroll status', async () => {
      mocks.updatePayrollStatus.mockResolvedValue({ id: 1, status: 'PAID' });
      const result = await updatePayrollStatus({ id: 1, status: 'PAID' });
      expect(mocks.updatePayrollStatus).toHaveBeenCalledWith(1, 'PAID');
      expect(result.status).toBe('PAID');
    });

    it('throws ValidationError on missing fields', async () => {
      await expect(updatePayrollStatus({})).rejects.toThrow();
    });
  });

  describe('createPayment', () => {
    it('creates payment and emits events', async () => {
      mocks.createPaymentAndCompleteOrder.mockResolvedValue({ id: 1, method: 'CASH' });
      mocks.findOrderWithPaymentDetails.mockResolvedValue({ id: 5, status: 'COMPLETED' });
      const result = await createPayment({ orderId: 5, method: 'CASH' });
      expect(mocks.createPaymentAndCompleteOrder).toHaveBeenCalled();
      expect(result.id).toBe(1);
    });

    it('throws ValidationError on invalid method', async () => {
      await expect(createPayment({ orderId: 5, method: 'CHEQUE' })).rejects.toThrow();
    });
  });

  describe('listPayments', () => {
    it('calls repository', async () => {
      mocks.findPaymentTransactions.mockResolvedValue([]);
      await listPayments();
      expect(mocks.findPaymentTransactions).toHaveBeenCalled();
    });
  });
});
