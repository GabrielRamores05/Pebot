/**
 * Cash drawer arithmetic for one shift (spec 017).
 * Expected cash = opening cash + cash sales + cash in − cash out.
 */

export type CashMovementKind = 'IN' | 'OUT';

export interface DrawerTotals {
  openingCash: number;
  cashSales: number;
  cashIn: number;
  cashOut: number;
  expectedCash: number;
  /** Counted − expected; negative is short. Only when a count is given. */
  overShort?: number;
}

const round2 = (n: number) => Math.round((n + Number.EPSILON) * 100) / 100;

export function drawerTotals(
  input: { openingCash: number; cashSales: number[]; movements: { kind: string; amount: number }[] },
  countedCash?: number | null,
): DrawerTotals {
  const sum = (xs: number[]) => xs.reduce((s, x) => s + x, 0);
  const cashSales = round2(sum(input.cashSales));
  const cashIn = round2(sum(input.movements.filter((m) => m.kind === 'IN').map((m) => m.amount)));
  const cashOut = round2(sum(input.movements.filter((m) => m.kind === 'OUT').map((m) => m.amount)));
  const openingCash = round2(input.openingCash);
  const expectedCash = round2(openingCash + cashSales + cashIn - cashOut);
  const totals: DrawerTotals = { openingCash, cashSales, cashIn, cashOut, expectedCash };
  if (countedCash != null) totals.overShort = round2(countedCash - expectedCash);
  return totals;
}
