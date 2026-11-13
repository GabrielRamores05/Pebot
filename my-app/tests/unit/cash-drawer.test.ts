import { describe, expect, it } from 'vitest';
import { drawerTotals } from '@/lib/cash-drawer';

describe('drawerTotals (spec 017, US4)', () => {
  it('works out expected cash: opening + cash sales + cash in − cash out', () => {
    const t = drawerTotals({
      openingCash: 1000,
      cashSales: [250, 180],
      movements: [{ kind: 'OUT', amount: 300 }],
    });
    expect(t).toEqual({ openingCash: 1000, cashSales: 430, cashIn: 0, cashOut: 300, expectedCash: 1130 });
  });

  it('adds cash put into the drawer', () => {
    const t = drawerTotals({ openingCash: 500, cashSales: [], movements: [{ kind: 'IN', amount: 200 }, { kind: 'OUT', amount: 50 }] });
    expect(t.expectedCash).toBe(650);
  });

  it('shows over/short against a count (spec independent test: ₱10.00 short)', () => {
    const t = drawerTotals({ openingCash: 1000, cashSales: [250, 180], movements: [{ kind: 'OUT', amount: 300 }] }, 1120);
    expect(t.overShort).toBe(-10);
  });

  it('rounds to the centavo', () => {
    const t = drawerTotals({ openingCash: 0.1, cashSales: [0.2], movements: [] }, 0.3);
    expect(t.expectedCash).toBe(0.3);
    expect(t.overShort).toBe(0);
  });
});
