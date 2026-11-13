import { describe, expect, it } from 'vitest';
import { summarizeDay, type DayOrder } from '@/lib/end-of-day';
import { computeCheckout } from '@/lib/checkout';

let n = 0;
/** An order saved by spec 017, built from the real bill calculation. */
function order(
  bill: Parameters<typeof computeCheckout>[0],
  over: Partial<DayOrder> = {},
): DayOrder {
  const t = computeCheckout(bill);
  n += 1;
  return {
    orderNumber: `ORD-${n}`,
    status: 'COMPLETED',
    paymentMethod: 'CASH',
    orderType: 'DINE_IN',
    totalAmount: t.total,
    grossAmount: t.gross,
    loyaltyDiscount: t.loyaltyDiscount,
    discountAmount: t.discount,
    discountReason: null,
    discountHolders: null,
    vatRemoved: t.vatRemoved,
    vatableSales: t.vatableSales,
    vatAmount: t.vatAmount,
    vatExemptSales: t.vatExemptSales,
    serviceCharge: t.serviceCharge,
    paid: true,
    ...over,
  };
}
const vat = { vatRegistered: true, vatRate: 12 };
const line = (amount: number) => ({ amount, vatExempt: false });

describe('summarizeDay (spec 017, US5)', () => {
  const senior = order(
    { lines: [line(112)], ...vat, discount: { kind: 'SENIOR', holders: 1, diners: 1 } },
    { discountReason: 'SENIOR', discountHolders: JSON.stringify([{ type: 'SENIOR', name: 'Lola', idNumber: 'OSCA-1' }]) },
  );
  const pwd = order(
    { lines: [line(448)], ...vat, discount: { kind: 'PWD', holders: 1, diners: 4 } },
    { discountReason: 'PWD', paymentMethod: 'GCASH', discountHolders: JSON.stringify([{ type: 'PWD', name: 'Ben', idNumber: 'PWD-9' }]) },
  );
  const student = order({ lines: [line(200)], ...vat, loyaltyDiscount: 50, discount: { kind: 'STUDENT', rate: 20 } }, { discountReason: 'STUDENT', orderType: 'TAKEOUT' });
  const withService = order({ lines: [line(500)], ...vat, serviceChargeRate: 10 });
  const cancelled = order({ lines: [line(300)], ...vat }, { status: 'CANCELLED' });
  const summary = summarizeDay([senior, pwd, student, withService, cancelled]);

  it('reconciles: gross − discounts + service charge = net = payments (US5 #1)', () => {
    const s = summary;
    const discounts = Object.values(s.discounts).reduce((a, b) => a + b, 0);
    expect(Math.round((s.gross - s.loyaltyDiscount - discounts - s.vatRemoved + s.serviceCharge) * 100) / 100).toBe(s.net);
    expect(Math.round(s.payments.reduce((a, p) => a + p.amount, 0) * 100) / 100).toBe(s.net);
    expect(s.net).toBe(80 + 416 + 120 + 550);
  });

  it('breaks discounts out by type', () => {
    expect(summary.discounts).toMatchObject({ senior: 20, pwd: 20, student: 30 });
    expect(summary.vatRemoved).toBe(24);
    expect(summary.loyaltyDiscount).toBe(50);
    expect(summary.serviceCharge).toBe(50);
  });

  it('lists each Senior and PWD sale with the holder (US5 #2)', () => {
    expect(summary.statutory).toEqual([
      expect.objectContaining({ orderNumber: senior.orderNumber, reason: 'SENIOR', holders: [{ type: 'SENIOR', name: 'Lola', idNumber: 'OSCA-1' }], vatRemoved: 12, discount: 20, total: 80 }),
      expect.objectContaining({ orderNumber: pwd.orderNumber, reason: 'PWD', vatRemoved: 12, discount: 20, total: 416 }),
    ]);
  });

  it('keeps cancelled orders out of sales and totals them separately (US5 #3)', () => {
    expect(summary.orderCount).toBe(4);
    expect(summary.cancelled).toEqual({ count: 1, amount: 300 });
  });

  it('groups payments and order types', () => {
    expect(summary.payments).toEqual(
      expect.arrayContaining([
        { method: 'CASH', count: 3, amount: 750 },
        { method: 'GCASH', count: 1, amount: 416 },
      ]),
    );
    expect(summary.orderTypes).toEqual(expect.arrayContaining([{ type: 'TAKEOUT', count: 1, amount: 120 }]));
  });

  it('adds up the VAT breakdown', () => {
    const v = summary.vat;
    expect(Math.round((v.vatableSales + v.vatAmount + v.vatExemptSales) * 100) / 100).toBe(summary.net - summary.serviceCharge);
  });

  it('handles orders saved before spec 017 (US5 #4)', () => {
    const legacy: DayOrder = {
      orderNumber: 'OLD-1', status: 'COMPLETED', paymentMethod: 'CASH', orderType: 'DINE_IN',
      totalAmount: 80, grossAmount: 0, loyaltyDiscount: 0, discountAmount: 20, discountReason: 'STUDENT_PWD',
      discountHolders: null, vatRemoved: 0, vatableSales: 0, vatAmount: 0, vatExemptSales: 0, serviceCharge: 0, paid: true,
    };
    const s = summarizeDay([legacy]);
    expect(s.gross).toBe(100);
    expect(s.discounts.legacyStudentPwd).toBe(20);
    expect(s.net).toBe(80);
    expect(s.payments).toEqual([{ method: 'CASH', count: 1, amount: 80 }]);
    expect(s.ordersWithoutVatBreakdown).toBe(1);
  });

  it('leaves orders that were never paid out of sales and lists them separately', () => {
    const waiting = order({ lines: [line(112)], ...vat }, { status: 'PENDING', paid: false });
    const s = summarizeDay([withService, waiting]);
    expect(s.orderCount).toBe(1);
    expect(s.net).toBe(550);
    expect(s.payments).toEqual([{ method: 'CASH', count: 1, amount: 550 }]);
    expect(s.unpaid).toEqual({ count: 1, amount: 112 });
  });

  it('is all zeros for a day with no orders', () => {
    const s = summarizeDay([]);
    expect(s).toMatchObject({ orderCount: 0, gross: 0, net: 0, payments: [], statutory: [] });
  });
});
