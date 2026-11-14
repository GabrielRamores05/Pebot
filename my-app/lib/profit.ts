/**
 * Profit report (spec 022). Pure: turns a period's records into
 * sales − cost of goods − waste − labor − expenses.
 *
 * - Sales are paid, not-cancelled orders, less refunds, less service charge
 *   (service charge belongs to staff under RA 11360, so it is not income).
 * - Cost of goods is what the recipes used, at the ingredient's cost
 *   (signed: a voided order's usage coming back lowers it).
 * - Labor is payroll whose period ends inside the range: gross pay without the
 *   service charge share, plus the employer's SSS/PhilHealth/Pag-IBIG.
 * A management guide, not a tax return.
 */

const round2 = (n: number) => Math.round((n + Number.EPSILON) * 100) / 100;

export interface ProfitInput {
  orders: { paid: boolean; status: string; totalAmount: number; refundAmount?: number | null; serviceCharge?: number | null }[];
  /** USAGE ledger rows: quantity is negative when stock was used. */
  usage: { quantity: number; unitCost: number }[];
  /** Waste rows: negative quantities. */
  waste: { quantity: number; unitCost: number }[];
  expenses: { amount: number; category: string }[];
  payroll: { grossPay: number; serviceChargeShare?: number; employerCost?: number }[];
}

export interface ProfitSummary {
  orderCount: number;
  grossSales: number;
  refunds: number;
  serviceCharge: number;
  netSales: number;
  costOfGoods: number;
  grossProfit: number;
  grossMargin: number | null;
  waste: number;
  labor: number;
  expenses: number;
  expenseByCategory: { category: string; amount: number }[];
  netProfit: number;
  netMargin: number | null;
}

export function summarizeProfit(input: ProfitInput): ProfitSummary {
  let orderCount = 0, grossSales = 0, refunds = 0, serviceCharge = 0;
  for (const o of input.orders) {
    if (o.status === 'CANCELLED') {
      continue;
    }
    if (!o.paid) continue;
    orderCount += 1;
    grossSales += o.totalAmount;
    refunds += o.refundAmount ?? 0;
    serviceCharge += o.serviceCharge ?? 0;
  }
  const netSales = round2(grossSales - refunds - serviceCharge);
  const costOfGoods = round2(-input.usage.reduce((s, u) => s + u.quantity * u.unitCost, 0));
  const waste = round2(-input.waste.reduce((s, w) => s + w.quantity * w.unitCost, 0));
  const labor = round2(input.payroll.reduce((s, p) => s + p.grossPay - (p.serviceChargeShare ?? 0) + (p.employerCost ?? 0), 0));
  const byCat = new Map<string, number>();
  for (const e of input.expenses) byCat.set(e.category, (byCat.get(e.category) ?? 0) + e.amount);
  const expenses = round2([...byCat.values()].reduce((s, v) => s + v, 0));
  const grossProfit = round2(netSales - costOfGoods);
  const netProfit = round2(grossProfit - waste - labor - expenses);
  const margin = (n: number) => (netSales > 0 ? round2((n / netSales) * 100) : null);
  return {
    orderCount,
    grossSales: round2(grossSales),
    refunds: round2(refunds),
    serviceCharge: round2(serviceCharge),
    netSales,
    costOfGoods,
    grossProfit,
    grossMargin: margin(grossProfit),
    waste,
    labor,
    expenses,
    expenseByCategory: [...byCat.entries()].map(([category, amount]) => ({ category, amount: round2(amount) })).sort((a, b) => b.amount - a.amount),
    netProfit,
    netMargin: margin(netProfit),
  };
}
