'use client';

import { useEffect, useState } from 'react';
import { formatPeso } from '@/lib/format';
import { fetchJson } from '@/lib/fetch-json';
import { downloadCsv } from '@/lib/csv';
import type { ProfitSummary } from '@/lib/profit';
import { Panel } from '@/components/pebot-ui';

const iso = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

/** The same periods as the Revenue filter, as local dates. */
export function filterRange(filter: string, now = new Date()): { from: string; to: string } {
  const y = now.getFullYear(), m = now.getMonth();
  const start =
    filter === 'today' ? now
    : filter === 'week' ? new Date(y, m, now.getDate() - 6)
    : filter === 'month' ? new Date(y, m, 1)
    : filter === 'quarter' ? new Date(y, Math.floor(m / 3) * 3, 1)
    : filter === 'year' ? new Date(y, 0, 1)
    : new Date(2020, 0, 1);
  return { from: iso(start), to: iso(now) };
}

type Report = ProfitSummary & { from: string; to: string };

export default function ProfitPanel({ filter }: { filter: string }) {
  const [r, setR] = useState<Report | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const { from, to } = filterRange(filter);
    setError(null);
    fetchJson<Report>(`/api/reports/profit?from=${from}&to=${to}`).then(setR).catch(() => setError('Could not load the profit report.'));
  }, [filter]);

  if (error) return <Panel title="Profit"><p className="text-sm text-danger">{error}</p></Panel>;
  if (!r) return <Panel title="Profit"><p className="text-sm text-faint">Working it out…</p></Panel>;

  // -0 would print as "₱-0.00".
  const z = (n: number) => (n === 0 ? 0 : n);
  const lines: { label: string; value: number; kind: 'in' | 'out' | 'total'; note?: string }[] = [
    { label: 'Sales', value: r.grossSales, kind: 'in', note: `${r.orderCount} paid orders` },
    ...(r.refunds ? [{ label: 'Refunds', value: -r.refunds, kind: 'out' as const }] : []),
    ...(r.serviceCharge ? [{ label: 'Service charge (goes to staff)', value: -r.serviceCharge, kind: 'out' as const }] : []),
    { label: 'Net sales', value: r.netSales, kind: 'total' },
    { label: 'Cost of ingredients used', value: z(-r.costOfGoods), kind: 'out', note: 'From recipes, at ingredient cost' },
    { label: 'Gross profit', value: r.grossProfit, kind: 'total', note: r.grossMargin != null ? `${r.grossMargin}% of net sales` : undefined },
    ...(r.waste ? [{ label: 'Waste', value: -r.waste, kind: 'out' as const }] : []),
    { label: 'Labor', value: z(-r.labor), kind: 'out', note: 'Payroll ending in the period + employer contributions' },
    { label: 'Expenses', value: z(-r.expenses), kind: 'out' },
    { label: 'Net profit', value: r.netProfit, kind: 'total', note: r.netMargin != null ? `${r.netMargin}% of net sales` : undefined },
  ];

  const exportCsv = () =>
    downloadCsv(`profit ${r.from} to ${r.to}`, [...lines, ...r.expenseByCategory.map((e) => ({ label: `Expense: ${e.category}`, value: -e.amount, kind: 'out' as const, note: '' }))], [
      { label: 'Line', value: (l) => l.label },
      { label: 'Amount (PHP)', value: (l) => l.value.toFixed(2) },
      { label: 'Note', value: (l) => l.note ?? '' },
    ]);

  const positive = r.netProfit >= 0;
  return (
    <Panel
      title="Profit"
      subtitle="Sales less ingredients, waste, labor and expenses. A management guide, not a tax return."
      actions={<button onClick={exportCsv} className="c-btn c-btn--ghost text-sm">Export CSV</button>}
    >
      <div className="grid gap-5 lg:grid-cols-[1fr_280px]">
        <table className="c-table">
          <tbody>
            {lines.map((l) => (
              <tr key={l.label} className={l.kind === 'total' ? 'bg-panel' : ''}>
                <td className={l.kind === 'total' ? 'font-bold' : ''}>
                  {l.label}
                  {l.note && <span className="block text-xs font-normal text-faint">{l.note}</span>}
                </td>
                <td className={`c-num ${l.kind === 'total' ? 'font-bold' : ''} ${l.value < 0 ? 'text-muted' : ''}`}>
                  {l.value < 0 ? `−${formatPeso(-l.value)}` : formatPeso(l.value)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        <div className="space-y-3">
          <div className={`rounded-[20px] px-5 py-4 ${positive ? 'bg-tile-sage' : 'bg-tile-peach'}`}>
            <p className="text-[13px] font-semibold text-muted">Net profit</p>
            <p className={`text-[30px] font-bold tabular-nums tracking-[-0.03em] ${positive ? 'text-good' : 'text-danger'}`}>
              {r.netProfit < 0 ? '−' : ''}{formatPeso(Math.abs(r.netProfit))}
            </p>
            <p className="text-xs text-muted">{r.netMargin != null ? `${r.netMargin}% margin` : 'No sales yet'}</p>
          </div>
          {r.expenseByCategory.length > 0 && (
            <div>
              <p className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-faint">Expenses by category</p>
              <ul className="space-y-1 text-sm">
                {r.expenseByCategory.slice(0, 6).map((e) => (
                  <li key={e.category} className="flex justify-between gap-2"><span className="truncate">{e.category}</span><span className="tabular-nums">{formatPeso(e.amount)}</span></li>
                ))}
              </ul>
            </div>
          )}
        </div>
      </div>
    </Panel>
  );
}
