/**
 * Government payroll rates (QA: editable without reinstalling). SSS,
 * PhilHealth, Pag-IBIG and the BIR table change by law or circular; the owner's
 * accountant updates them in Staff & HR → Payroll → Government rates.
 * Defaults are the 2026 rates.
 */
import { z } from 'zod';

const pct = z.number().min(0).max(1);
const peso = z.number().min(0).max(10_000_000);

export const PayrollRatesSchema = z.object({
  label: z.string().trim().min(1).max(60),
  sss: z.object({
    employeeRate: pct,
    employerRate: pct,
    mscMin: peso,
    mscMax: peso,
    mscStep: z.number().positive().max(100_000),
    ecLow: peso,
    ecHigh: peso,
    ecThreshold: peso,
  }).refine((s) => s.mscMax >= s.mscMin, 'SSS: the highest salary credit must be at least the lowest.'),
  philHealth: z.object({ rate: pct, floor: peso, ceiling: peso })
    .refine((p) => p.ceiling >= p.floor, 'PhilHealth: the ceiling must be at least the floor.'),
  pagIbig: z.object({ cap: peso, lowThreshold: peso, employeeLowRate: pct, employeeRate: pct, employerRate: pct }),
  /** Monthly BIR withholding brackets: tax = base + (taxable − over) × rate, for the highest `over` reached. */
  tax: z.array(z.object({ over: peso, base: peso, rate: pct })).min(1).max(12)
    .refine((rows) => rows.every((r, i) => i === 0 || r.over > rows[i - 1].over), 'Tax brackets must go from lowest to highest.'),
});

export type PayrollRates = z.infer<typeof PayrollRatesSchema>;

export const DEFAULT_PAYROLL_RATES: PayrollRates = {
  label: '2026 rates',
  sss: { employeeRate: 0.05, employerRate: 0.1, mscMin: 5000, mscMax: 35000, mscStep: 500, ecLow: 10, ecHigh: 30, ecThreshold: 15000 },
  philHealth: { rate: 0.05, floor: 10000, ceiling: 100000 },
  pagIbig: { cap: 10000, lowThreshold: 1500, employeeLowRate: 0.01, employeeRate: 0.02, employerRate: 0.02 },
  tax: [
    { over: 0, base: 0, rate: 0 },
    { over: 20833, base: 0, rate: 0.15 },
    { over: 33333, base: 2500, rate: 0.2 },
    { over: 66666, base: 10833.33, rate: 0.25 },
    { over: 166666, base: 40833.33, rate: 0.3 },
    { over: 666666, base: 200833.33, rate: 0.35 },
  ],
};

/** Saved rates merged over the defaults; anything invalid falls back to the defaults. */
export function resolvePayrollRates(saved: unknown): PayrollRates {
  if (!saved || typeof saved !== 'object') return DEFAULT_PAYROLL_RATES;
  const s = saved as Partial<PayrollRates>;
  const merged = {
    label: s.label ?? DEFAULT_PAYROLL_RATES.label,
    sss: { ...DEFAULT_PAYROLL_RATES.sss, ...(s.sss ?? {}) },
    philHealth: { ...DEFAULT_PAYROLL_RATES.philHealth, ...(s.philHealth ?? {}) },
    pagIbig: { ...DEFAULT_PAYROLL_RATES.pagIbig, ...(s.pagIbig ?? {}) },
    tax: Array.isArray(s.tax) && s.tax.length ? s.tax : DEFAULT_PAYROLL_RATES.tax,
  };
  const parsed = PayrollRatesSchema.safeParse(merged);
  return parsed.success ? parsed.data : DEFAULT_PAYROLL_RATES;
}
