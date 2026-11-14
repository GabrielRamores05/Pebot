'use client';

import { useEffect, useState } from 'react';
import { fetchJson, userMessage } from '@/lib/fetch-json';
import type { PayrollRates } from '@/lib/payroll-rates';

// Government payroll rates the accountant can update when a law or circular changes them.
type Field = { label: string; path: [keyof PayrollRates, string]; kind: 'pct' | 'peso' };

const FIELDS: { group: string; fields: Field[] }[] = [
  {
    group: 'SSS',
    fields: [
      { label: 'Employee share', path: ['sss', 'employeeRate'], kind: 'pct' },
      { label: 'Employer share', path: ['sss', 'employerRate'], kind: 'pct' },
      { label: 'Lowest salary credit', path: ['sss', 'mscMin'], kind: 'peso' },
      { label: 'Highest salary credit', path: ['sss', 'mscMax'], kind: 'peso' },
    ],
  },
  {
    group: 'PhilHealth',
    fields: [
      { label: 'Premium rate (split 50/50)', path: ['philHealth', 'rate'], kind: 'pct' },
      { label: 'Salary floor', path: ['philHealth', 'floor'], kind: 'peso' },
      { label: 'Salary ceiling', path: ['philHealth', 'ceiling'], kind: 'peso' },
    ],
  },
  {
    group: 'Pag-IBIG',
    fields: [
      { label: 'Employee share', path: ['pagIbig', 'employeeRate'], kind: 'pct' },
      { label: 'Employer share', path: ['pagIbig', 'employerRate'], kind: 'pct' },
      { label: 'Salary cap', path: ['pagIbig', 'cap'], kind: 'peso' },
    ],
  },
];

const INPUT = 'mt-1 block h-9 w-full rounded-lg border border-hair bg-card px-2.5 text-sm tabular-nums outline-none focus:border-accent';

export default function PayrollRatesCard() {
  const [open, setOpen] = useState(false);
  const [rates, setRates] = useState<PayrollRates | null>(null);
  const [defaults, setDefaults] = useState<PayrollRates | null>(null);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);

  useEffect(() => {
    if (!open || rates) return;
    fetchJson<{ rates: PayrollRates; defaults: PayrollRates }>('/api/payroll/rates')
      .then((d) => { setRates(d.rates); setDefaults(d.defaults); })
      .catch(() => setMsg({ ok: false, text: 'Could not load the rates.' }));
  }, [open, rates]);

  const get = (p: Field['path']) => (rates?.[p[0]] as unknown as Record<string, number>)?.[p[1]] ?? 0;
  const put = (p: Field['path'], v: number) =>
    setRates((r) => (r ? { ...r, [p[0]]: { ...(r[p[0]] as object), [p[1]]: v } } : r));

  async function save(next = rates) {
    if (!next) return;
    setMsg(null);
    try {
      const d = await fetchJson<{ rates: PayrollRates }>('/api/payroll/rates', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(next) });
      setRates(d.rates);
      setMsg({ ok: true, text: 'Saved. New payroll runs use these rates.' });
    } catch (e) {
      setMsg({ ok: false, text: userMessage(e, 'Could not save the rates.') });
    }
  }

  return (
    <div className="c-card p-5">
      <button onClick={() => setOpen(!open)} className="flex w-full items-center justify-between text-left">
        <div>
          <p className="text-sm font-semibold text-ink">Government rates{rates ? ` · ${rates.label}` : ''}</p>
          <p className="text-xs text-faint">SSS, PhilHealth, Pag-IBIG and BIR withholding. Update when your accountant says the rates changed.</p>
        </div>
        <span className="text-sm text-muted">{open ? 'Hide' : 'Show'}</span>
      </button>

      {open && rates && (
        <div className="mt-4 space-y-4">
          <label className="block max-w-xs text-xs font-semibold text-muted">Name of this rate set
            <input value={rates.label} onChange={(e) => setRates({ ...rates, label: e.target.value })} className={INPUT} />
          </label>
          <div className="grid gap-4 lg:grid-cols-3">
            {FIELDS.map((g) => (
              <div key={g.group} className="rounded-xl bg-panel p-3">
                <p className="mb-2 text-xs font-bold uppercase tracking-wide text-faint">{g.group}</p>
                <div className="grid grid-cols-2 gap-2">
                  {g.fields.map((f) => (
                    <label key={f.label} className="text-[11px] font-semibold text-muted">
                      {f.label} {f.kind === 'pct' ? '(%)' : '(₱)'}
                      <input type="number" step={f.kind === 'pct' ? 0.01 : 1} min={0}
                        value={f.kind === 'pct' ? Math.round(get(f.path) * 10000) / 100 : get(f.path)}
                        onChange={(e) => put(f.path, f.kind === 'pct' ? Number(e.target.value) / 100 : Number(e.target.value))}
                        className={INPUT} />
                    </label>
                  ))}
                </div>
              </div>
            ))}
          </div>

          <div className="rounded-xl bg-panel p-3">
            <p className="mb-2 text-xs font-bold uppercase tracking-wide text-faint">BIR monthly withholding table</p>
            <table className="c-table">
              <thead><tr><th>Taxable pay over (₱)</th><th>Fixed tax (₱)</th><th>Plus % of the excess</th></tr></thead>
              <tbody>
                {rates.tax.map((row, i) => (
                  <tr key={i}>
                    {(['over', 'base', 'rate'] as const).map((k) => (
                      <td key={k}>
                        <input type="number" min={0} step={k === 'rate' ? 1 : 0.01}
                          value={k === 'rate' ? Math.round(row.rate * 10000) / 100 : row[k]}
                          onChange={(e) => {
                            const v = Number(e.target.value);
                            const tax = rates.tax.map((r, j) => (j === i ? { ...r, [k]: k === 'rate' ? v / 100 : v } : r));
                            setRates({ ...rates, tax });
                          }}
                          aria-label={`Bracket ${i + 1} ${k}`}
                          className="h-8 w-full rounded-lg border border-hair bg-card px-2 text-sm tabular-nums outline-none focus:border-accent" />
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button onClick={() => save()} className="c-btn c-btn--primary">Save rates</button>
            {defaults && <button onClick={() => { setRates(defaults); save(defaults); }} className="c-btn c-btn--ghost">Reset to {defaults.label}</button>}
            {msg && <span className={`text-sm ${msg.ok ? 'text-good' : 'text-danger'}`}>{msg.text}</span>}
          </div>
          <p className="text-xs text-faint">Payslips already made keep the rates they were made with.</p>
        </div>
      )}
    </div>
  );
}
