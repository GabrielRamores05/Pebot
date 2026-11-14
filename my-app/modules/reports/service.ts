import { summarizeDay, type DaySummary } from '@/lib/end-of-day';
import * as repo from '@/modules/reports/repository';
import { drawersOpenedBetween, type DrawerView } from '@/modules/cash-drawer/service';

const LOCATION_ID = 1;

export interface EndOfDayReport {
  date: string;
  business: { name: string; address: string; tin: string; vatRegistered: boolean };
  summary: DaySummary;
  drawers: DrawerView[];
  generatedAt: string;
}

/** Local calendar day [start, next start) for YYYY-MM-DD; the PC runs on Philippine time. */
export function dayRange(date: string): { from: Date; to: Date } {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(date);
  if (!m) {
    const e = new Error('Use a date like 2026-11-14.');
    (e as unknown as { status: number }).status = 400;
    throw e;
  }
  const [y, mo, d] = [Number(m[1]), Number(m[2]) - 1, Number(m[3])];
  const from = new Date(y, mo, d);
  if (from.getFullYear() !== y || from.getMonth() !== mo || from.getDate() !== d) {
    const e = new Error('That date does not exist.');
    (e as unknown as { status: number }).status = 400;
    throw e;
  }
  return { from, to: new Date(y, mo, d + 1) };
}

/**
 * Paid when payment was confirmed. Orders from before spec 017 have no paidAt;
 * for those, an order the kitchen has started or finished counts as paid.
 */
export function isPaid(status: string, paidAt: Date | null): boolean {
  return paidAt != null || ['PREPARING', 'READY', 'COMPLETED'].includes(status);
}

export async function endOfDay(date: string): Promise<EndOfDayReport> {
  const { from, to } = dayRange(date);
  const [orders, business, drawers] = await Promise.all([
    repo.findOrdersForDay(LOCATION_ID, from, to),
    repo.findBusinessIdentity(),
    drawersOpenedBetween(from, to),
  ]);
  return {
    date,
    business: {
      name: business?.businessName ?? 'My Restaurant',
      address: business?.businessAddress ?? '',
      tin: business?.tin ?? '',
      vatRegistered: business?.vatRegistered ?? true,
    },
    summary: summarizeDay(orders.map(({ paidAt, ...o }) => ({ ...o, paid: isPaid(o.status, paidAt) }))),
    drawers,
    generatedAt: new Date().toISOString(),
  };
}

// ── Profit report (spec 022) ─────────────────────────────────────────────
import { summarizeProfit, type ProfitSummary } from '@/lib/profit';
import { isWasteNote } from '@/lib/stock-count';

/** Profit for the local dates [from, to] inclusive (YYYY-MM-DD). */
export async function profitReport(fromDate: string, toDate: string): Promise<ProfitSummary & { from: string; to: string }> {
  const from = dayRange(fromDate).from;
  const to = dayRange(toDate).to;
  if (to <= from) {
    const e = new Error('The end date is before the start date.');
    (e as unknown as { status: number }).status = 400;
    throw e;
  }
  const [orders, moves, expenses, payroll] = await Promise.all([
    repo.findOrdersForProfit(LOCATION_ID, from, to),
    repo.findStockMovementsForProfit(LOCATION_ID, from, to),
    repo.findExpensesForProfit(from, to),
    repo.findPayrollForProfit(from, to),
  ]);
  const cost = (m: (typeof moves)[number]) => m.unitCost ?? m.ingredient?.costPerUnit ?? 0;
  return {
    from: fromDate,
    to: toDate,
    ...summarizeProfit({
      orders: orders.map((o) => ({ ...o, paid: isPaid(o.status, o.paidAt) })),
      usage: moves.filter((m) => m.type === 'USAGE').map((m) => ({ quantity: m.quantity, unitCost: cost(m) })),
      waste: moves.filter((m) => m.type === 'ADJUSTMENT' && m.quantity < 0 && isWasteNote(m.notes)).map((m) => ({ quantity: m.quantity, unitCost: cost(m) })),
      expenses: expenses.map((e) => ({ amount: e.amount, category: e.category?.name ?? 'Other' })),
      payroll: payroll.map((p) => {
        let b: { serviceChargeShare?: number; employerCost?: number } = {};
        try { b = p.breakdown ? JSON.parse(p.breakdown) : {}; } catch { b = {}; }
        return { grossPay: p.grossPay, serviceChargeShare: b.serviceChargeShare ?? 0, employerCost: b.employerCost ?? 0 };
      }),
    }),
  };
}
