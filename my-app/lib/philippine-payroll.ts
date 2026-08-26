// Philippine payroll computation helpers (2026 rates).
// These produce a calculation guide — they do NOT file or remit to any agency.
// Rates reflect: SSS RA 11199 (15%, final tranche since Jan 2025), PhilHealth
// RA 11223 (5%), Pag-IBIG HDMF Circular 460, and the BIR/TRAIN withholding table.

export interface SSSResult {
  msc: number; // Monthly Salary Credit used
  employee: number;
  employer: number;
  ec: number; // Employees' Compensation (employer-paid)
}

// Map a monthly basic salary to the SSS Monthly Salary Credit (₱500 brackets,
// floored at ₱5,000 and capped at ₱35,000).
export function sssMSC(salary: number): number {
  const rounded = Math.round(salary / 500) * 500;
  return Math.min(35000, Math.max(5000, rounded));
}

export function computeSSS(monthlyBasic: number): SSSResult {
  const msc = sssMSC(monthlyBasic);
  const employee = msc * 0.05;
  const employer = msc * 0.1;
  const ec = msc < 15000 ? 10 : 30; // employer-paid only
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

export function computePhilHealth(monthlyBasic: number): PhilHealthResult {
  // Floor ₱10,000 (min premium ₱500), ceiling ₱100,000 (max premium ₱5,000).
  const base = Math.min(100000, Math.max(10000, monthlyBasic));
  const premium = base * 0.05;
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

export function computePagIbig(monthlyCompensation: number): PagIbigResult {
  const fundSalary = Math.min(10000, monthlyCompensation); // capped
  const employee = fundSalary <= 1500 ? fundSalary * 0.01 : fundSalary * 0.02;
  const employer = fundSalary * 0.02;
  return {
    fundSalary: round2(fundSalary),
    employee: round2(employee),
    employer: round2(employer),
  };
}

// BIR monthly withholding tax on compensation (TRAIN Law brackets).
// Input is taxable income = gross pay minus mandatory employee contributions.
export function computeWithholdingTax(monthlyTaxable: number): number {
  const t = monthlyTaxable;
  if (t <= 20833) return 0;
  if (t <= 33333) return (t - 20833) * 0.15;
  if (t <= 66666) return 2500 + (t - 33333) * 0.2;
  if (t <= 166666) return 10833.33 + (t - 66666) * 0.25;
  if (t <= 666666) return 40833.33 + (t - 166666) * 0.3;
  return 200833.33 + (t - 666666) * 0.35;
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
}): PayrollBreakdown {
  const { grossPay, base, otherDeductions = 0, overtimeHours = 0 } = opts;
  const sss = computeSSS(base);
  const philHealth = computePhilHealth(base);
  const pagIbig = computePagIbig(base);

  const statutoryEmployeeTotal = round2(sss.employee + philHealth.employee + pagIbig.employee);
  const taxableIncome = round2(grossPay - statutoryEmployeeTotal);
  const withholdingTax = round2(computeWithholdingTax(taxableIncome));

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
