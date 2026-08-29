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
