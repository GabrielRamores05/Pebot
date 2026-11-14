'use client';

import { useCallback, useEffect, useState } from 'react';
import { formatPeso } from '@/lib/format';
import { StatTile } from '@/components/pebot-ui';

// End-of-day summary (spec 017, US5). A management report, not a BIR Z-reading.

interface Holder { type: string; name: string; idNumber: string }
interface DrawerRow {
  id: number;
  openedAt: string;
  closedAt: string | null;
  openedByName: string;
  closedByName: string | null;
  countedCash: number | null;
  totals: { openingCash: number; cashSales: number; cashIn: number; cashOut: number; expectedCash: number; overShort?: number };
}
interface Report {
  date: string;
  business: { name: string; address: string; tin: string; vatRegistered: boolean };
  generatedAt: string;
  drawers: DrawerRow[];
  summary: {
    orderCount: number;
    cancelled: { count: number; amount: number };
    unpaid: { count: number; amount: number };
    voids: { orderNumber: string; reason: string; refund: number }[];
    refundTotal: number;
    gross: number;
    loyaltyDiscount: number;
    discounts: { senior: number; pwd: number; seniorAndPwd: number; student: number; legacyStudentPwd: number; other: number };
    vatRemoved: number;
    serviceCharge: number;
    net: number;
    vat: { vatableSales: number; vatAmount: number; vatExemptSales: number };
    ordersWithoutVatBreakdown: number;
    payments: { method: string; count: number; amount: number }[];
    orderTypes: { type: string; count: number; amount: number }[];
    statutory: { orderNumber: string; reason: string; holders: Holder[]; vatRemoved: number; discount: number; total: number }[];
  };
}

const ORDER_TYPE_LABELS: Record<string, string> = { DINE_IN: 'Dine-in', TAKEOUT: 'Takeout', DELIVERY: 'Delivery' };
const HOLDER_LABELS: Record<string, string> = { SENIOR: 'Senior', PWD: 'PWD' };

function localDate(d = new Date()) {
  const p = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

function Row({ label, value, strong, minus }: { label: string; value: number; strong?: boolean; minus?: boolean }) {
  return (
    <div className={`flex justify-between gap-4 py-1 ${strong ? 'border-t border-hair-strong font-semibold' : ''}`}>
      <span className={strong ? '' : 'text-muted'}>{label}</span>
      <span className="tabular-nums">{minus && value > 0 ? '−' : ''}{formatPeso(value)}</span>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="c-card break-inside-avoid p-5 print:rounded-none print:border-0 print:border-t print:p-0 print:pt-2 print:shadow-none">
      <h2 className="mb-2 text-base font-bold">{title}</h2>
      <div className="text-sm">{children}</div>
    </section>
  );
}

export default function EndOfDayPage() {
  const [date, setDate] = useState(localDate());
  const [report, setReport] = useState<Report | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const load = useCallback(async (d: string) => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/reports/end-of-day?date=${encodeURIComponent(d)}`);
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setReport(null);
        setError(res.status === 403 ? 'You need the Analytics permission to see this report.' : data.error || 'Could not load the report.');
        return;
      }
      setReport(data);
    } catch {
      setError('Network error. Try again.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load(date);
  }, [date, load]);

  const s = report?.summary;
  const discountRows: [string, number][] = s
    ? [
        ['Senior Citizen discount', s.discounts.senior],
        ['PWD discount', s.discounts.pwd],
        ['Senior/PWD discount (mixed table)', s.discounts.seniorAndPwd],
        ['Student discount', s.discounts.student],
        ['Student/PWD discount (before update)', s.discounts.legacyStudentPwd],
        ['Other discounts', s.discounts.other],
      ].filter(([, v]) => (v as number) > 0) as [string, number][]
    : [];

  return (
    <div className="space-y-4 px-6 pb-8 pt-6 print:p-0 print:text-black">
      <div className="flex flex-wrap items-end justify-between gap-3 print:hidden">
        <div>
          <h1 className="c-title">End of day</h1>
          <p className="mt-1.5 text-sm text-muted">Sales, discounts, VAT and cash for one day. Print it for your books.</p>
        </div>
        <div className="flex items-end gap-2">
          <label className="text-xs font-semibold text-muted">
            <span className="mb-1 block">Date</span>
            <input
              type="date"
              value={date}
              max={localDate()}
              onChange={(e) => e.target.value && setDate(e.target.value)}
              className="h-10 rounded-xl border border-hair bg-card px-3 text-ink outline-none focus:border-accent"
            />
          </label>
          <button
            type="button"
            onClick={() => window.print()}
            disabled={!report}
            className="c-btn c-btn--primary disabled:opacity-50"
          >
            Print
          </button>
        </div>
      </div>

      {loading && <p className="text-sm text-faint">Loading…</p>}
      {error && <p className="rounded-lg bg-danger-bg p-3 text-sm text-danger" role="alert">{error}</p>}

      {report && s && (
        <>
          <header className="hidden text-center print:block">
            <p className="text-lg font-semibold">{report.business.name}</p>
            {report.business.address && <p className="text-xs">{report.business.address}</p>}
            {report.business.tin && <p className="text-xs">TIN {report.business.tin}</p>}
            <p className="mt-1 text-sm font-semibold">End-of-day summary — {report.date}</p>
          </header>

          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4 print:hidden">
            <StatTile tone="peach" label="Net sales" value={formatPeso(s.net)} note={`${s.orderCount} paid orders`} />
            <StatTile tone="sand" label="Discounts given" value={formatPeso(Object.values(s.discounts).reduce((a, b) => a + b, 0) + s.vatRemoved + s.loyaltyDiscount)} note={`${s.statutory.length} Senior/PWD sales`} />
            <StatTile tone="sky" label="VAT" value={formatPeso(s.vat.vatAmount)} note={report.business.vatRegistered ? 'On VAT-able sales' : 'Not VAT-registered'} />
            <StatTile tone={report.drawers.some((d) => (d.totals.overShort ?? 0) < 0) ? 'danger' : 'sage'} label="Cash drawers" value={report.drawers.length} note={report.drawers.length ? report.drawers.map((d) => d.totals.overShort == null ? 'open' : d.totals.overShort === 0 ? 'balanced' : (d.totals.overShort < 0 ? 'short ' : 'over ') + formatPeso(Math.abs(d.totals.overShort))).join(' · ') : 'None opened'} />
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <Section title="Sales">
              <Row label={`Gross sales (${s.orderCount} orders)`} value={s.gross} />
              {s.loyaltyDiscount > 0 && <Row label="Loyalty rewards" value={s.loyaltyDiscount} minus />}
              {s.vatRemoved > 0 && <Row label="Less VAT (Senior/PWD)" value={s.vatRemoved} minus />}
              {discountRows.map(([label, v]) => <Row key={label} label={label} value={v} minus />)}
              {s.serviceCharge > 0 && <Row label="Service charge" value={s.serviceCharge} />}
              <Row label="Net sales" value={s.net} strong />
              {s.unpaid.count > 0 && (
                <p className="mt-2 text-xs text-faint">
                  {s.unpaid.count} order{s.unpaid.count === 1 ? '' : 's'} not yet paid ({formatPeso(s.unpaid.amount)}) not counted.
                </p>
              )}
              {s.cancelled.count > 0 && (
                <p className="mt-2 text-xs text-faint">
                  {s.cancelled.count} cancelled order{s.cancelled.count === 1 ? '' : 's'} ({formatPeso(s.cancelled.amount)}) not counted.
                </p>
              )}
            </Section>

            <Section title="Payments">
              {s.payments.length === 0 && <p className="text-faint">No sales.</p>}
              {s.payments.map((p) => <Row key={p.method} label={`${p.method} (${p.count})`} value={p.amount} />)}
              {s.payments.length > 0 && <Row label="Total collected" value={s.net} strong />}
              <h3 className="mb-1 mt-3 text-xs font-semibold uppercase tracking-wide text-faint">Order types</h3>
              {s.orderTypes.map((t) => (
                <Row key={t.type} label={`${ORDER_TYPE_LABELS[t.type] ?? t.type} (${t.count})`} value={t.amount} />
              ))}
            </Section>

            <Section title={report.business.vatRegistered ? 'VAT' : 'Sales for tax'}>
              {report.business.vatRegistered ? (
                <>
                  <Row label="VAT-able sales" value={s.vat.vatableSales} />
                  <Row label="VAT" value={s.vat.vatAmount} />
                  <Row label="VAT-exempt sales" value={s.vat.vatExemptSales} />
                </>
              ) : (
                <Row label="Sales (not VAT-registered)" value={s.vat.vatExemptSales} />
              )}
              {s.serviceCharge > 0 && <p className="mt-1 text-xs text-faint">Service charge is shown separately and not included above.</p>}
              {s.ordersWithoutVatBreakdown > 0 && (
                <p className="mt-1 text-xs text-faint">
                  {s.ordersWithoutVatBreakdown} order{s.ordersWithoutVatBreakdown === 1 ? '' : 's'} from before the update have no VAT breakdown and are not included above.
                </p>
              )}
            </Section>

            <Section title="Cash drawers">
              {report.drawers.length === 0 && <p className="text-faint">No drawer was opened this day.</p>}
              {report.drawers.map((d) => (
                <div key={d.id} className="mb-2 border-b border-hair pb-2 last:border-0">
                  <p className="text-xs text-faint">
                    #{d.id} · {new Date(d.openedAt).toLocaleTimeString()} – {d.closedAt ? new Date(d.closedAt).toLocaleTimeString() : 'still open'} · {d.openedByName}
                  </p>
                  <Row label="Expected" value={d.totals.expectedCash} />
                  {d.countedCash != null && <Row label="Counted" value={d.countedCash} />}
                  {d.totals.overShort != null && (
                    <div className="flex justify-between py-1 font-semibold">
                      <span>{d.totals.overShort < 0 ? 'Short' : d.totals.overShort > 0 ? 'Over' : 'Balanced'}</span>
                      <span className="tabular-nums">{formatPeso(Math.abs(d.totals.overShort))}</span>
                    </div>
                  )}
                </div>
              ))}
            </Section>
          </div>

          <Section title={`Senior Citizen and PWD sales (${s.statutory.length})`}>
            {s.statutory.length === 0 ? (
              <p className="text-faint">None.</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full min-w-[560px] text-left text-sm">
                  <thead className="text-xs uppercase text-faint">
                    <tr>
                      <th className="py-1 pr-2 font-medium">Order</th>
                      <th className="py-1 pr-2 font-medium">ID holder</th>
                      <th className="py-1 pr-2 font-medium">ID number</th>
                      <th className="py-1 pr-2 text-right font-medium">Less VAT</th>
                      <th className="py-1 pr-2 text-right font-medium">Discount</th>
                      <th className="py-1 text-right font-medium">Paid</th>
                    </tr>
                  </thead>
                  <tbody>
                    {s.statutory.map((r) => (
                      <tr key={r.orderNumber} className="border-t border-hair align-top">
                        <td className="py-1 pr-2">{r.orderNumber}</td>
                        <td className="py-1 pr-2">{r.holders.map((h, i) => <div key={i}>{h.name} <span className="text-faint">({HOLDER_LABELS[h.type] ?? h.type})</span></div>)}</td>
                        <td className="py-1 pr-2">{r.holders.map((h, i) => <div key={i}>{h.idNumber}</div>)}</td>
                        <td className="py-1 pr-2 text-right tabular-nums">{formatPeso(r.vatRemoved)}</td>
                        <td className="py-1 pr-2 text-right tabular-nums">{formatPeso(r.discount)}</td>
                        <td className="py-1 text-right tabular-nums">{formatPeso(r.total)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </Section>

          <Section title={`Voids and refunds (${s.voids.length})`}>
            {s.voids.length === 0 ? (
              <p className="text-faint">None.</p>
            ) : (
              <>
                <ul className="divide-y divide-hair">
                  {s.voids.map((v) => (
                    <li key={v.orderNumber} className="flex items-center justify-between gap-4 py-2">
                      <span className="min-w-0"><span className="font-semibold tabular-nums">{v.orderNumber}</span> <span className="text-muted">· {v.reason}</span></span>
                      <span className="shrink-0 tabular-nums">{v.refund > 0 ? `Refunded ${formatPeso(v.refund)}` : 'Not paid'}</span>
                    </li>
                  ))}
                </ul>
                <div className="mt-2 flex justify-between border-t border-hair pt-2 font-semibold"><span>Total refunded</span><span className="tabular-nums">{formatPeso(s.refundTotal)}</span></div>
              </>
            )}
          </Section>

          <p className="text-xs text-faint">
            Management report generated {new Date(report.generatedAt).toLocaleString()}. Not an official BIR reading. Pebot is not BIR-accredited.
          </p>
        </>
      )}
    </div>
  );
}
