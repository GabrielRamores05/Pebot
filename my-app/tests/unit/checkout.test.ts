import { describe, expect, it } from 'vitest';
import {
  CheckoutError,
  computeCheckout,
  serviceChargeRateFor,
  type CheckoutInput,
} from '@/lib/checkout';

const vat = { vatRegistered: true, vatRate: 12 };
const line = (amount: number, vatExempt = false) => ({ amount, vatExempt });
const run = (input: Partial<CheckoutInput>) => computeCheckout({ lines: [], ...vat, ...input });

/** Every part of the bill adds up to the total. */
function expectBalanced(t: ReturnType<typeof computeCheckout>) {
  const afterDiscounts = t.vatableSales + t.vatAmount + t.vatExemptSales;
  expect(round(afterDiscounts)).toBe(round(t.gross - t.loyaltyDiscount - t.discount - t.vatRemoved));
  expect(round(afterDiscounts + t.serviceCharge)).toBe(t.total);
}
const round = (n: number) => Math.round(n * 100) / 100;

describe('computeCheckout — no discounts', () => {
  it('splits a VAT-inclusive bill into VAT-able sales and VAT', () => {
    const t = run({ lines: [line(112)] });
    expect(t).toMatchObject({ gross: 112, vatableSales: 100, vatAmount: 12, vatExemptSales: 0, total: 112 });
    expectBalanced(t);
  });

  it('keeps VAT-exempt items out of VAT', () => {
    const t = run({ lines: [line(112), line(50, true)] });
    expect(t).toMatchObject({ vatableSales: 100, vatAmount: 12, vatExemptSales: 50, total: 162 });
  });

  it('puts every sale in the non-VAT bucket when the business is not VAT-registered', () => {
    const t = run({ lines: [line(112)], vatRegistered: false });
    expect(t).toMatchObject({ vatableSales: 0, vatAmount: 0, vatExemptSales: 112, total: 112 });
  });

  it('is zero for an empty bill', () => {
    expect(run({}).total).toBe(0);
  });
});

describe('computeCheckout — Senior Citizen / PWD (RA 9994, RA 10754)', () => {
  it('removes VAT, then takes 20% off the VAT-exclusive price (spec US1 #1)', () => {
    const t = run({ lines: [line(112)], discount: { kind: 'SENIOR', holders: 1, diners: 1 } });
    expect(t).toMatchObject({ vatRemoved: 12, discount: 20, total: 80, vatExemptSales: 80, vatableSales: 0, vatAmount: 0 });
    expectBalanced(t);
  });

  it('takes 20% off the price when the business is not VAT-registered (spec US1 #2)', () => {
    const t = run({ lines: [line(112)], vatRegistered: false, discount: { kind: 'PWD', holders: 1, diners: 1 } });
    expect(t).toMatchObject({ vatRemoved: 0, discount: 22.4, total: 89.6 });
    expectBalanced(t);
  });

  it('discounts only the holders’ share of a group meal (spec US1 #3)', () => {
    const t = run({ lines: [line(448)], discount: { kind: 'SENIOR', holders: 1, diners: 4 } });
    expect(t).toMatchObject({ vatRemoved: 12, discount: 20, total: 416, vatExemptSales: 80, vatableSales: 300, vatAmount: 36 });
    expectBalanced(t);
  });

  it('takes 20% off VAT-exempt items without removing VAT (spec US1 #6)', () => {
    const t = run({ lines: [line(100, true)], discount: { kind: 'SENIOR', holders: 1, diners: 1 } });
    expect(t).toMatchObject({ vatRemoved: 0, discount: 20, total: 80 });
  });

  it('rounds a share that is not a whole person and still adds up', () => {
    const t = run({ lines: [line(100)], discount: { kind: 'PWD', holders: 1, diners: 3 } });
    expect(t).toMatchObject({ vatRemoved: 3.57, discount: 5.95, total: 90.48 });
    expectBalanced(t);
  });

  it('refuses to combine with a loyalty reward (spec US1 #5)', () => {
    expect(() =>
      run({ lines: [line(112)], loyaltyDiscount: 10, discount: { kind: 'SENIOR', holders: 1, diners: 1 } }),
    ).toThrow(CheckoutError);
  });

  it('refuses more holders than diners, and zero holders', () => {
    expect(() => run({ lines: [line(112)], discount: { kind: 'SENIOR', holders: 3, diners: 2 } })).toThrow(CheckoutError);
    expect(() => run({ lines: [line(112)], discount: { kind: 'PWD', holders: 0, diners: 2 } })).toThrow(CheckoutError);
    expect(() => run({ lines: [line(112)], discount: { kind: 'PWD', holders: 1.5, diners: 2 } })).toThrow(CheckoutError);
  });
});

describe('computeCheckout — Student discount and loyalty', () => {
  it('takes the owner’s rate off the VAT-inclusive bill, without removing VAT', () => {
    const t = run({ lines: [line(112)], discount: { kind: 'STUDENT', rate: 20 } });
    expect(t).toMatchObject({ vatRemoved: 0, discount: 22.4, total: 89.6, vatableSales: 80, vatAmount: 9.6 });
    expectBalanced(t);
  });

  it('applies the loyalty reward first, then the discount (same order as the server, spec US2)', () => {
    const t = run({ lines: [line(200)], loyaltyDiscount: 50, discount: { kind: 'STUDENT', rate: 20 } });
    expect(t).toMatchObject({ loyaltyDiscount: 50, discount: 30, total: 120 });
    expectBalanced(t);
  });

  it('never lets a reward take the bill below zero', () => {
    const t = run({ lines: [line(40)], loyaltyDiscount: 100 });
    expect(t).toMatchObject({ loyaltyDiscount: 40, total: 0 });
  });

  it('refuses a rate outside 0–100', () => {
    expect(() => run({ lines: [line(100)], discount: { kind: 'STUDENT', rate: 120 } })).toThrow(CheckoutError);
  });
});

describe('computeCheckout — service charge', () => {
  it('adds the service charge as its own line (spec US3 #1)', () => {
    const t = run({ lines: [line(500)], serviceChargeRate: 10 });
    expect(t).toMatchObject({ serviceCharge: 50, total: 550 });
    expectBalanced(t);
  });

  it('computes it on the bill after discounts (spec US3 #3)', () => {
    const t = run({ lines: [line(112)], discount: { kind: 'SENIOR', holders: 1, diners: 1 }, serviceChargeRate: 10 });
    expect(t).toMatchObject({ total: 88, serviceCharge: 8 });
    expectBalanced(t);
  });

  it('changes nothing when it is off (spec US3 #4)', () => {
    expect(run({ lines: [line(500)] }).total).toBe(500);
  });
});

describe('serviceChargeRateFor', () => {
  const settings = { serviceChargeRate: 10, serviceChargeOrderTypes: 'DINE_IN' };

  it('applies to the chosen order types only (spec US3 #2)', () => {
    expect(serviceChargeRateFor(settings, 'DINE_IN')).toBe(10);
    expect(serviceChargeRateFor(settings, 'TAKEOUT')).toBe(0);
  });

  it('accepts a comma-separated list', () => {
    expect(serviceChargeRateFor({ ...settings, serviceChargeOrderTypes: 'DINE_IN,DELIVERY' }, 'DELIVERY')).toBe(10);
  });

  it('is off when settings are missing or the rate is not positive', () => {
    expect(serviceChargeRateFor(null, 'DINE_IN')).toBe(0);
    expect(serviceChargeRateFor({ ...settings, serviceChargeRate: 0 }, 'DINE_IN')).toBe(0);
  });
});
