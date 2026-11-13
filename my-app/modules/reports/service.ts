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
