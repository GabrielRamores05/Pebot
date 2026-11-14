// Philippine payroll computation helpers (2026 rates).
// These produce a calculation guide — they do NOT file or remit to any agency.
// Rates reflect: SSS RA 11199 (15%, final tranche since Jan 2025), PhilHealth
// RA 11223 (5%), Pag-IBIG HDMF Circular 460, and the BIR/TRAIN withholding table.

import { DEFAULT_PAYROLL_RATES, type PayrollRates } from '@/lib/payroll-rates';

export interface SSSResult {
  msc: number; // Monthly Salary Credit used
  employee: number;
  employer: number;
  ec: number; // Employees' Compensation (employer-paid)
}

// Map a monthly basic salary to the SSS Monthly Salary Credit (₱500 brackets,
// floored at ₱5,000 and capped at ₱35,000).
export function sssMSC(salary: number, r: PayrollRates['sss'] = DEFAULT_PAYROLL_RATES.sss): number {
  const rounded = Math.round(salary / r.mscStep) * r.mscStep;
  return Math.min(r.mscMax, Math.max(r.mscMin, rounded));
}

export function computeSSS(monthlyBasic: number, r: PayrollRates['sss'] = DEFAULT_PAYROLL_RATES.sss): SSSResult {
  const msc = sssMSC(monthlyBasic, r);
  const employee = msc * r.employeeRate;
  const employer = msc * r.employerRate;
  const ec = msc < r.ecThreshold ? r.ecLow : r.ecHigh; // employer-paid only
  return {
    msc,
    employee: round2(employee),
    employer: round2(employer),
    ec,
  };
}

export interface PhilHealthResult {
  base: number;
  premium: number;
  employee: number;
  employer: number;
}

export function computePhilHealth(monthlyBasic: number, r: PayrollRates['philHealth'] = DEFAULT_PAYROLL_RATES.philHealth): PhilHealthResult {
  // 2026: floor ₱10,000 (min premium ₱500), ceiling ₱100,000 (max premium ₱5,000).
  const base = Math.min(r.ceiling, Math.max(r.floor, monthlyBasic));
  const premium = base * r.rate;
  return {
    base: round2(base),
    premium: round2(premium),
    employee: round2(premium / 2),
    employer: round2(premium / 2),
  };
}

export interface PagIbigResult {
  fundSalary: number;
  employee: number;
  employer: number;
}

export function computePagIbig(monthlyCompensation: number, r: PayrollRates['pagIbig'] = DEFAULT_PAYROLL_RATES.pagIbig): PagIbigResult {
  const fundSalary = Math.min(r.cap, monthlyCompensation); // capped
  const employee = fundSalary <= r.lowThreshold ? fundSalary * r.employeeLowRate : fundSalary * r.employeeRate;
  const employer = fundSalary * r.employerRate;
  return {
    fundSalary: round2(fundSalary),
    employee: round2(employee),
    employer: round2(employer),
  };
}

// BIR monthly withholding tax on compensation (TRAIN Law brackets).
// Input is taxable income = gross pay minus mandatory employee contributions.
export function computeWithholdingTax(monthlyTaxable: number, brackets: PayrollRates['tax'] = DEFAULT_PAYROLL_RATES.tax): number {
  const t = monthlyTaxable;
  let row = brackets[0];
  for (const b of brackets) if (t > b.over) row = b;
  if (t <= row.over) return 0;
  return Math.max(0, row.base + (t - row.over) * row.rate);
}

export interface PayrollBreakdown {
  grossPay: number;
  sss: SSSResult;
  philHealth: PhilHealthResult;
  pagIbig: PagIbigResult;
  statutoryEmployeeTotal: number;
  taxableIncome: number;
  withholdingTax: number;
  otherDeductions: number;
  employerCost: number; // employer shares + EC (informational)
  netPay: number;
}

// Full computation for one payroll run.
// `base` is the monthly pay basis: for salaried staff it is monthlySalary; for
// hourly staff it is the period's gross pay (assumed to cover ~one month).
export function computePhilippinePayroll(opts: {
  grossPay: number;
  base: number; // monthly pay basis used for statutory contributions
  otherDeductions?: number;
  overtimeHours?: number; // informational only
  /** Share of a month this run covers (0.5 for semi-monthly). Default 1. */
  periodFraction?: number;
  /** Government rates; the 2026 defaults when not given. */
  rates?: PayrollRates;
}): PayrollBreakdown {
  const rates = opts.rates ?? DEFAULT_PAYROLL_RATES;
  const { grossPay, base, otherDeductions = 0, overtimeHours = 0 } = opts;
  const f = opts.periodFraction && opts.periodFraction > 0 ? opts.periodFraction : 1;
  // Contributions are monthly: work them out on the monthly basis, then take this run's share.
  const scale = <T extends object>(r: T, keys: (keyof T)[]): T => {
    const out = { ...r };
    for (const k of keys) (out as Record<keyof T, unknown>)[k] = round2((r[k] as unknown as number) * f);
    return out;
  };
  const sss = scale(computeSSS(base, rates.sss), ['employee', 'employer', 'ec']);
  const philHealth = scale(computePhilHealth(base, rates.philHealth), ['premium', 'employee', 'employer']);
  const pagIbig = scale(computePagIbig(base, rates.pagIbig), ['employee', 'employer']);

  const statutoryEmployeeTotal = round2(sss.employee + philHealth.employee + pagIbig.employee);
  const taxableIncome = round2(grossPay - statutoryEmployeeTotal);
  // The BIR table is monthly: tax the monthly equivalent, then take this run's share.
  const withholdingTax = round2(computeWithholdingTax(taxableIncome / f, rates.tax) * f);

  const employerCost = round2(sss.employer + sss.ec + philHealth.employer + pagIbig.employer);
  const netPay = round2(grossPay - statutoryEmployeeTotal - withholdingTax - otherDeductions);

  return {
    grossPay: round2(grossPay),
    sss,
    philHealth,
    pagIbig,
    statutoryEmployeeTotal,
    taxableIncome,
    withholdingTax,
    otherDeductions: round2(otherDeductions),
    employerCost,
    netPay,
  };
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}
