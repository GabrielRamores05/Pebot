'use client';

import { useState, useEffect } from 'react';
import { fetchJson, userMessage } from '@/lib/fetch-json';
import { Badge } from '../shared';
import type { StaffMember } from '../shared';

// ─── TIME OFF ────────────────────────────────────────────────────────────────
export function TimeOffTab({ onChanged }: { onChanged: () => void }) {
  const [balances, setBalances] = useState<{ userId: number; name: string; balances: { leaveTypeId: number; leaveType: string; allowance: number; used: number; left: number }[] }[]>([]);
  useEffect(() => { fetchJson<typeof balances>(`/api/leave-balances?year=${new Date().getFullYear()}`).then(setBalances).catch(() => setBalances([])); }, []);
  const [types, setTypes] = useState<any[]>([]);
  const [requests, setRequests] = useState<any[]>([]);
  const [staff, setStaff] = useState<StaffMember[]>([]);
  const [form, setForm] = useState({ userId: '', leaveTypeId: '', startDate: '', endDate: '', reason: '' });
  const [error, setError] = useState('');

  const load = async () => {
    try {
      const [t, r, s] = await Promise.all([
        fetchJson<Record<string, unknown>[]>('/api/leave-types'),
        fetchJson<Record<string, unknown>[]>('/api/leave-requests'),
        fetchJson<StaffMember[]>('/api/staff'),
      ]);
      setTypes(t); setRequests(r); setStaff(s); setError('');
    } catch (e) {
      console.error('Failed to load time off:', e);
      setError(userMessage(e, 'Could not load time off. Try again.'));
    }
  };
  useEffect(() => { load(); }, []);

  async function submit() {
    try {
      await fetchJson('/api/leave-requests', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ...form, userId: Number(form.userId) }) });
      setForm({ userId: '', leaveTypeId: '', startDate: '', endDate: '', reason: '' }); await load(); onChanged();
    } catch (e) {
      console.error('Failed to submit leave request:', e);
      setError(userMessage(e, 'Could not submit the leave request. Try again.'));
    }
  }
  async function review(id: number, status: string) {
    try {
      await fetchJson('/api/leave-requests', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id, status }) });
      await load(); onChanged();
    } catch (e) {
      console.error('Failed to review leave request:', e);
      setError(userMessage(e, 'Could not update the leave request. Try again.'));
    }
  }

  return (
    <div className="space-y-4">
      <h2 className="text-base font-bold">Time off</h2>
      {error && <div className="rounded-xl bg-danger-bg px-4 py-3 text-sm text-danger">{error}</div>}
      <div className="c-card p-5 space-y-3">
        <p className="text-sm font-semibold text-ink">Request leave</p>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-3">
          <select value={form.userId} onChange={e => setForm({ ...form, userId: e.target.value })} className="h-10 rounded-xl border border-hair bg-card px-3 text-sm outline-none focus:border-accent"><option value="">Staff</option>{staff.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}</select>
          <select value={form.leaveTypeId} onChange={e => setForm({ ...form, leaveTypeId: e.target.value })} className="h-10 rounded-xl border border-hair bg-card px-3 text-sm outline-none focus:border-accent"><option value="">Type</option>{types.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}</select>
          <input type="date" value={form.startDate} onChange={e => setForm({ ...form, startDate: e.target.value })} className="h-10 rounded-xl border border-hair bg-card px-3 text-sm outline-none focus:border-accent" />
          <input type="date" value={form.endDate} onChange={e => setForm({ ...form, endDate: e.target.value })} className="h-10 rounded-xl border border-hair bg-card px-3 text-sm outline-none focus:border-accent" />
          <input placeholder="Reason" value={form.reason} onChange={e => setForm({ ...form, reason: e.target.value })} className="h-10 rounded-xl border border-hair bg-card px-3 text-sm outline-none focus:border-accent" />
        </div>
        <button onClick={submit} className="c-btn c-btn--primary">Submit request</button>
      </div>

      <div className="c-card overflow-hidden">
        <table className="c-table">
          <thead><tr className="border-b border-slate-100 text-muted"><th className="text-left p-3">Staff</th><th className="text-left p-3">Type</th><th className="text-left p-3">Dates</th><th className="text-left p-3">Status</th><th className="text-left p-3">Actions</th></tr></thead>
          <tbody>
            {requests.map(r => (
              <tr key={r.id} className="border-b border-slate-50">
                <td className="p-3">{r.user?.name}</td>
                <td className="p-3">{r.leaveType?.name}</td>
                <td className="p-3">{r.startDate.slice(0,10)} → {r.endDate.slice(0,10)}</td>
                <td className="p-3"><Badge color={r.status === 'APPROVED' ? 'green' : r.status === 'REJECTED' ? 'red' : 'amber'}>{r.status}</Badge></td>
                <td className="p-3 space-x-1">
                  {r.status === 'PENDING' && <>
                    <button onClick={() => review(r.id, 'APPROVED')} className="h-8 rounded-lg bg-good-bg px-2.5 text-xs font-semibold text-good">Approve</button>
                    <button onClick={() => review(r.id, 'REJECTED')} className="h-8 rounded-lg px-2.5 text-xs font-semibold text-danger hover:bg-danger-bg">Reject</button>
                  </>}
                </td>
              </tr>
            ))}
            {requests.length === 0 && <tr><td colSpan={5} className="p-6 text-center text-faint">No requests</td></tr>}
          </tbody>
        </table>
      </div>

      <div className="c-card overflow-x-auto p-5">
        <p className="text-sm font-semibold text-ink">Leave balances {new Date().getFullYear()}</p>
        <p className="mb-3 text-xs text-faint">Allowance per leave type, approved days used and days left. Staff with a year of service are owed at least 5 days of Service Incentive Leave.</p>
        {balances.length === 0 || balances[0].balances.length === 0 ? (
          <p className="text-sm text-faint">Add leave types (for example Service Incentive Leave, 5 days) to see balances.</p>
        ) : (
          <table className="c-table min-w-[560px]">
            <thead><tr><th>Staff</th>{balances[0].balances.map((b) => <th key={b.leaveTypeId} className="c-num">{b.leaveType}</th>)}</tr></thead>
            <tbody>
              {balances.map((p) => (
                <tr key={p.userId}>
                  <td className="font-semibold">{p.name}</td>
                  {p.balances.map((b) => (
                    <td key={b.leaveTypeId} className="c-num"><span className={b.left === 0 && b.allowance > 0 ? 'font-bold text-danger' : 'font-bold'}>{b.left}</span><span className="text-faint"> / {b.allowance} left</span></td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
