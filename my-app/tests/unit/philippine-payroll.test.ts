import { describe, expect, test } from 'vitest';
import {
  computePagIbig,
  computePhilHealth,
  computePhilippinePayroll,
  computeSSS,
  computeWithholdingTax,
  sssMSC,
} from '../../lib/philippine-payroll';

describe('statutory contributions', () => {
  test('floors, rounds, and caps the SSS monthly salary credit', () => {
    expect(sssMSC(1000)).toBe(5000);
    expect(sssMSC(15249)).toBe(15000);
    expect(sssMSC(15250)).toBe(15500);
    expect(sssMSC(50000)).toBe(35000);
  });

  test('computes SSS shares and EC threshold', () => {
    expect(computeSSS(14000)).toEqual({
      msc: 14000,
      employee: 700,
      employer: 1400,
      ec: 10,
    });
    expect(computeSSS(15000).ec).toBe(30);
  });

  test('applies PhilHealth floor, standard rate, and ceiling', () => {
    expect(computePhilHealth(5000)).toEqual({
      base: 10000,
      premium: 500,
      employee: 250,
      employer: 250,
    });
    expect(computePhilHealth(30000).premium).toBe(1500);
    expect(computePhilHealth(150000).premium).toBe(5000);
  });

  test('applies Pag-IBIG employee brackets and salary cap', () => {
    expect(computePagIbig(1500)).toEqual({
      fundSalary: 1500,
      employee: 15,
      employer: 30,
    });
    expect(computePagIbig(5000).employee).toBe(100);
    expect(computePagIbig(15000)).toEqual({
      fundSalary: 10000,
      employee: 200,
      employer: 200,
    });
  });
});

describe('withholding tax', () => {
  test.each([
    [20833, 0],
    [30000, 1375.05],
    [50000, 5833.4],
    [100000, 19166.83],
    [300000, 80833.53],
    [700000, 212500.23],
  ])('computes the monthly bracket for %s', (taxable, expected) => {
    expect(computeWithholdingTax(taxable)).toBeCloseTo(expected as number, 2);
  });
});

describe('full payroll calculation', () => {
  test('combines statutory contributions, tax, deductions, and employer cost', () => {
    expect(
      computePhilippinePayroll({
        grossPay: 35000,
        base: 30000,
        otherDeductions: 1000,
      }),
    ).toEqual({
      grossPay: 35000,
      sss: {
        msc: 30000,
        employee: 1500,
        employer: 3000,
        ec: 30,
      },
      philHealth: {
        base: 30000,
        premium: 1500,
        employee: 750,
        employer: 750,
      },
      pagIbig: {
        fundSalary: 10000,
        employee: 200,
        employer: 200,
      },
      statutoryEmployeeTotal: 2450,
      taxableIncome: 32550,
      withholdingTax: 1757.55,
      otherDeductions: 1000,
      employerCost: 3980,
      netPay: 29792.45,
    });
  });

  test('defaults optional deductions to zero', () => {
    const result = computePhilippinePayroll({ grossPay: 20000, base: 20000 });

    expect(result.otherDeductions).toBe(0);
    expect(result.withholdingTax).toBe(0);
  });
});
