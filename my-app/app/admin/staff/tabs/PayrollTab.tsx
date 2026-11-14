'use client';

import { useState, useEffect, Fragment } from 'react';
import { fetchJson, userMessage } from '@/lib/fetch-json';
import { renderPayslipHtml } from '@/lib/payslip';
import { printHtml } from '@/lib/print-client';
import { downloadCsv } from '@/lib/csv';
import PayrollRatesCard from '../PayrollRatesCard';
import { Line, Badge, safeParse } from '../shared';
import type { StaffMember } from '../shared';

// ─── PAYROLL ─────────────────────────────────────────────────────────────────
export function PayrollTab() {
  const [staff, setStaff] = useState<StaffMember[]>([]);
  const [records, setRecords] = useState<any[]>([]);
  const [form, setForm] = useState({ userId: '', periodStart: '', periodEnd: '', deductions: '0' });
  const [openId, setOpenId] = useState<number | null>(null);
  const [error, setError] = useState('');
  // Spec 021: run for everyone, 13th month, payslips
  const [batch, setBatch] = useState({ periodStart: '', periodEnd: '', includeServiceCharge: true });
  const [batchMsg, setBatchMsg] = useState<string | null>(null);
  const [year, setYear] = useState(new Date().getFullYear());
  const [thirteenth, setThirteenth] = useState<{ total: number; staff: { userId: number; name: string; position: string | null; basicEarned: number; thirteenthMonth: number; runs: number }[] } | null>(null);
  const [business, setBusiness] = useState<{ businessName: string; businessAddress?: string; tin?: string }>({ businessName: 'My Restaurant' });

  useEffect(() => {
    fetchJson<{ businessName: string; businessAddress?: string; tin?: string }>('/api/settings/business').then(setBusiness).catch(() => {});
  }, []);
  useEffect(() => {
    fetchJson<NonNullable<typeof thirteenth>>(`/api/payroll/thirteenth-month?year=${year}`).then(setThirteenth).catch(() => setThirteenth(null));
  }, [year]);

  async function runAll() {
    if (!batch.periodStart || !batch.periodEnd) { setBatchMsg('Pick the start and end of the pay period.'); return; }
    setBatchMsg('Working…');
    try {
      const r = await fetchJson<{ created: number; skipped: { name: string; reason: string }[]; serviceChargeTotal: number }>('/api/payroll/batch', {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(batch),
      });
      setBatchMsg(`Created ${r.created} payslip${r.created === 1 ? '' : 's'}${r.serviceChargeTotal > 0 ? ` · ₱${r.serviceChargeTotal.toLocaleString('en-PH', { minimumFractionDigits: 2 })} service charge shared` : ''}${r.skipped.length ? ` · skipped: ${r.skipped.map((x) => `${x.name} (${x.reason.toLowerCase()})`).join(', ')}` : ''}.`);
      await load();
    } catch (e) {
      setBatchMsg(userMessage(e, 'Could not run payroll. Try again.'));
    }
  }

  const printSlip = (r: any) => printHtml(renderPayslipHtml(r, business), { printer: null });

  const load = async () => {
    try {
      const [s, r] = await Promise.all([fetchJson<StaffMember[]>('/api/staff'), fetchJson<Record<string, unknown>[]>('/api/payroll')]);
      setStaff(s); setRecords(r); setError('');
    } catch (e) {
      console.error('Failed to load payroll:', e);
      setError(userMessage(e, 'Could not load payroll. Try again.'));
    }
  };
  useEffect(() => { load(); }, []);

  async function generate() {
    try {
      await fetchJson('/api/payroll', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ...form, userId: Number(form.userId), deductions: Number(form.deductions) }) });
      setForm({ userId: '', periodStart: '', periodEnd: '', deductions: '0' }); await load();
    } catch (e) {
      console.error('Failed to generate payroll:', e);
      setError(userMessage(e, 'Could not generate payroll. Try again.'));
    }
  }
  async function markPaid(id: number) {
    try {
      await fetchJson('/api/payroll', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id, status: 'PAID' }) });
      await load();
    } catch (e) {
      console.error('Failed to mark payroll paid:', e);
      setError(userMessage(e, 'Could not mark payroll as paid. Try again.'));
    }
  }

  return (
    <div className="space-y-4">
      <div className="rounded-2xl bg-tile-sand px-4 py-3 text-sm text-ink">
        Payslips follow Philippine rules: SSS, PhilHealth and Pag-IBIG employee shares are deducted first, then BIR withholding tax is computed on what remains. This is a calculation guide — you still file and pay the agencies.
      </div>
      <h2 className="text-base font-bold">Payroll</h2>
      {error && <div className="rounded-xl bg-danger-bg px-4 py-3 text-sm text-danger">{error}</div>}
      <div className="c-card space-y-3 p-5">
        <div>
          <p className="text-sm font-semibold text-ink">Run payroll for everyone</p>
          <p className="text-xs text-faint">One payslip per active staff member with pay set up. Holiday, rest-day, overtime and night rates come from their time clock.</p>
        </div>
        <div className="flex flex-wrap items-end gap-2">
          <label className="text-xs font-semibold text-muted">From<input type="date" value={batch.periodStart} onChange={e => setBatch({ ...batch, periodStart: e.target.value })} className="mt-1 block h-10 rounded-xl border border-hair bg-card px-3 text-sm outline-none focus:border-accent" /></label>
          <label className="text-xs font-semibold text-muted">To<input type="date" value={batch.periodEnd} onChange={e => setBatch({ ...batch, periodEnd: e.target.value })} className="mt-1 block h-10 rounded-xl border border-hair bg-card px-3 text-sm outline-none focus:border-accent" /></label>
          <label className="flex h-10 items-center gap-2 text-sm">
            <input type="checkbox" checked={batch.includeServiceCharge} onChange={e => setBatch({ ...batch, includeServiceCharge: e.target.checked })} className="h-4 w-4 accent-[var(--c-accent)]" />
            Share service charges equally among staff who worked (RA 11360)
          </label>
          <button onClick={runAll} className="c-btn c-btn--primary">Run payroll</button>
        </div>
        {batchMsg && <p className="text-sm text-muted">{batchMsg}</p>}
      </div>

      <div className="c-card p-5 space-y-3">
        <p className="text-sm font-semibold text-ink">Run payroll for one person</p>
        <div className="flex flex-wrap gap-2 items-end">
          <label className="text-xs font-semibold text-muted">Staff<select value={form.userId} onChange={e => setForm({ ...form, userId: e.target.value })} className="mt-1 block h-10 rounded-xl border border-hair bg-card px-3 text-sm outline-none focus:border-accent"><option value="">Choose…</option>{staff.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}</select></label>
          <label className="text-xs font-semibold text-muted">From<input type="date" value={form.periodStart} onChange={e => setForm({ ...form, periodStart: e.target.value })} className="mt-1 block h-10 rounded-xl border border-hair bg-card px-3 text-sm outline-none focus:border-accent" /></label>
          <label className="text-xs font-semibold text-muted">To<input type="date" value={form.periodEnd} onChange={e => setForm({ ...form, periodEnd: e.target.value })} className="mt-1 block h-10 rounded-xl border border-hair bg-card px-3 text-sm outline-none focus:border-accent" /></label>
          <label className="text-xs font-semibold text-muted">Other deductions (₱)<input inputMode="decimal" placeholder="0" value={form.deductions} onChange={e => setForm({ ...form, deductions: e.target.value })} className="mt-1 block h-10 rounded-xl border border-hair bg-card px-3 text-sm outline-none focus:border-accent w-40" /></label>
          <button onClick={generate} className="c-btn c-btn--primary">Generate</button>
        </div>
      </div>

      <div className="c-card overflow-hidden">
        <div className="flex items-center justify-between border-b border-hair px-4 py-3">
          <p className="text-sm font-semibold text-ink">Payroll runs</p>
          <button
            disabled={records.length === 0}
            onClick={() => downloadCsv('payroll', records as any[], [
              { label: 'Staff', value: (r) => r.user?.name ?? '' },
              { label: 'Period start', value: (r) => new Date(r.periodStart).toLocaleDateString('en-PH') },
              { label: 'Period end', value: (r) => new Date(r.periodEnd).toLocaleDateString('en-PH') },
              { label: 'Regular hours', value: (r) => r.regularHours },
              { label: 'Overtime hours', value: (r) => r.overtimeHours },
              ...(['basicPay', 'holidayPremium', 'overtimePay', 'nightDiff', 'serviceChargeShare'] as const).map((k) => ({
                label: { basicPay: 'Basic pay', holidayPremium: 'Holiday premium', overtimePay: 'Overtime pay', nightDiff: 'Night differential', serviceChargeShare: 'Service charge share' }[k],
                value: (r: any) => { try { return JSON.parse(r.breakdown || '{}')[k] ?? ''; } catch { return ''; } },
              })),
              { label: 'Gross (PHP)', value: (r) => r.grossPay },
              { label: 'Net (PHP)', value: (r) => r.netPay },
              { label: 'Status', value: (r) => r.status },
            ])}
            className="c-btn c-btn--ghost text-sm disabled:opacity-50"
          >
            Export CSV
          </button>
        </div>
        <table className="c-table">
          <thead><tr className="border-b border-slate-100 text-muted"><th className="text-left p-3">Staff</th><th className="text-left p-3">Period</th><th className="text-right p-3">Hours</th><th className="text-right p-3">Gross</th><th className="text-right p-3">Net</th><th className="text-left p-3">Status</th></tr></thead>
          <tbody>
            {records.map(r => {
              const b = safeParse(r.breakdown);
              return (
                <Fragment key={r.id}>
                  <tr className="border-b border-slate-50 cursor-pointer hover:bg-page" onClick={() => setOpenId(openId === r.id ? null : r.id)}>
                    <td className="p-3">{r.user?.name}</td>
                    <td className="p-3">{r.periodStart.slice(0,10)} → {r.periodEnd.slice(0,10)}</td>
                    <td className="p-3 text-right">{r.regularHours + r.overtimeHours}h</td>
                    <td className="p-3 text-right">₱{r.grossPay.toFixed(2)}</td>
                    <td className="p-3 text-right font-semibold">₱{r.netPay.toFixed(2)}</td>
                    <td className="p-3"><Badge color={r.status === 'PAID' ? 'green' : r.status === 'PROCESSED' ? 'blue' : 'amber'}>{r.status}</Badge>{r.status !== 'PAID' && <button onClick={(e) => { e.stopPropagation(); markPaid(r.id); }} className="ml-2 text-xs font-semibold text-good hover:underline">Mark paid</button>}<button onClick={(e) => { e.stopPropagation(); printSlip(r); }} className="ml-2 text-xs font-semibold text-accent-text hover:underline">Payslip</button></td>
                  </tr>
                  {openId === r.id && b && (
                    <tr className="bg-page">
                      <td colSpan={6} className="p-4 text-xs">
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-2 max-w-2xl">
                          <Line label="Gross pay" value={b.grossPay} />
                          <Line label="SSS (EE)" value={b.sss?.employee} sub={`MSC ₱${b.sss?.msc}`} />
                          <Line label="PhilHealth (EE)" value={b.philHealth?.employee} />
                          <Line label="Pag-IBIG (EE)" value={b.pagIbig?.employee} />
                          <Line label="Withholding tax" value={b.withholdingTax} />
                          <Line label="Taxable income" value={b.taxableIncome} />
                          <Line label="Employer cost" value={b.employerCost} sub="SSS/Phil/Pag shares" />
                          {typeof b.basicPay === 'number' && <Line label="Basic pay" value={b.basicPay} />}
                          {b.holidayPremium > 0 && <Line label="Holiday / rest-day premium" value={b.holidayPremium} />}
                          {b.overtimePay > 0 && <Line label="Overtime" value={b.overtimePay} />}
                          {b.nightDiff > 0 && <Line label="Night differential" value={b.nightDiff} sub={`${b.nightHours} night hours`} />}
                          {b.serviceChargeShare > 0 && <Line label="Service charge share" value={b.serviceChargeShare} />}
                          <Line label="Net pay" value={b.netPay} bold />
                        </div>
                      </td>
                    </tr>
                  )}
                </Fragment>
              );
            })}
            {records.length === 0 && <tr><td colSpan={6} className="p-6 text-center text-faint">No payroll runs</td></tr>}
          </tbody>
        </table>
      </div>

      <PayrollRatesCard />

      <div className="c-card p-5">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <div>
            <p className="text-sm font-semibold text-ink">13th-month pay</p>
            <p className="text-xs text-faint">Basic pay earned in the year ÷ 12. Pay it on or before December 24.</p>
          </div>
          <select value={year} onChange={e => setYear(Number(e.target.value))} className="h-10 rounded-xl border border-hair bg-card px-3 text-sm outline-none focus:border-accent">
            {[0, 1, 2].map((d) => new Date().getFullYear() - d).map((y) => <option key={y} value={y}>{y}</option>)}
          </select>
        </div>
        {!thirteenth || thirteenth.staff.length === 0 ? (
          <p className="text-sm text-faint">No payroll runs in {year} yet.</p>
        ) : (
          <table className="c-table">
            <thead><tr><th>Staff</th><th className="c-num">Payroll runs</th><th className="c-num">Basic pay earned</th><th className="c-num">13th month</th></tr></thead>
            <tbody>
              {thirteenth.staff.map((p) => (
                <tr key={p.userId}><td><span className="font-semibold">{p.name}</span>{p.position ? <span className="text-faint"> · {p.position}</span> : null}</td><td className="c-num">{p.runs}</td><td className="c-num">₱{p.basicEarned.toLocaleString('en-PH', { minimumFractionDigits: 2 })}</td><td className="c-num font-bold">₱{p.thirteenthMonth.toLocaleString('en-PH', { minimumFractionDigits: 2 })}</td></tr>
              ))}
              <tr><td className="font-bold">Total</td><td /><td /><td className="c-num font-bold">₱{thirteenth.total.toLocaleString('en-PH', { minimumFractionDigits: 2 })}</td></tr>
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
