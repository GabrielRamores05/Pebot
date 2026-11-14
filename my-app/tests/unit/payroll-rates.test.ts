import { describe, expect, it } from 'vitest';
import { DEFAULT_PAYROLL_RATES, resolvePayrollRates } from '@/lib/payroll-rates';
import { computePhilippinePayroll, computeWithholdingTax } from '@/lib/philippine-payroll';

describe('editable payroll rates', () => {
  it('the default table gives the same tax as the old fixed table', () => {
    expect(computeWithholdingTax(20000)).toBe(0);
    expect(computeWithholdingTax(30000)).toBeCloseTo((30000 - 20833) * 0.15, 2);
    expect(computeWithholdingTax(50000)).toBeCloseTo(2500 + (50000 - 33333) * 0.2, 2);
    expect(computeWithholdingTax(1000000)).toBeCloseTo(200833.33 + (1000000 - 666666) * 0.35, 2);
  });

  it('uses new rates when the accountant changes them', () => {
    const rates = resolvePayrollRates({ ...DEFAULT_PAYROLL_RATES, sss: { ...DEFAULT_PAYROLL_RATES.sss, employeeRate: 0.06 } });
    const r = computePhilippinePayroll({ grossPay: 20000, base: 20000, rates });
    expect(r.sss.employee).toBe(1200);
  });

  it('falls back to the defaults when saved rates are broken', () => {
    expect(resolvePayrollRates({ sss: { employeeRate: 5 } })).toEqual(DEFAULT_PAYROLL_RATES);
    expect(resolvePayrollRates('nonsense')).toEqual(DEFAULT_PAYROLL_RATES);
    expect(resolvePayrollRates({ tax: [{ over: 100, base: 0, rate: 0.1 }, { over: 50, base: 0, rate: 0.2 }] })).toEqual(DEFAULT_PAYROLL_RATES);
  });
});
