'use client';

import { useState, useEffect, useRef } from 'react';
import { fetchJson, userMessage } from '@/lib/fetch-json';
import { addDays, iso } from '../shared';
import type { StaffMember } from '../shared';

// ─── TIME CLOCK ──────────────────────────────────────────────────────────────
export function TimeClockTab({ onChanged }: { onChanged: () => void }) {
  const [staff, setStaff] = useState<StaffMember[]>([]);
  const [records, setRecords] = useState<any[]>([]);
  const [schedules, setSchedules] = useState<any[]>([]);
  const [msg, setMsg] = useState('');
  const [error, setError] = useState('');
  const clockError = useRef('');
  const [from, setFrom] = useState(iso(addDays(new Date(), -30)));
  const [to, setTo] = useState(iso(new Date()));

  const loadSchedules = async () => {
    const t = iso(new Date());
    try { setSchedules(await fetchJson<Record<string, unknown>[]>(`/api/schedules?from=${t}&to=${t}`)); }
    catch (e) {
      console.error('Failed to load today’s schedules:', e);
      const message = userMessage(e, 'Could not load schedules. Try again.');
      clockError.current = message;
      setError(message);
    }
  };

  useEffect(() => {
    (async () => {
      try { setStaff(await fetchJson<StaffMember[]>('/api/staff')); }
      catch (e) {
        console.error('Failed to load staff:', e);
        const message = userMessage(e, 'Could not load staff. Try again.');
        clockError.current = message;
        setError(message);
      }
      await loadRecords();
      await loadSchedules();
    })();
  }, []);
  const loadRecords = async () => {
    try { setRecords(await fetchJson<Record<string, unknown>[]>(`/api/attendance?from=${from}&to=${to}`)); }
    catch (e) {
      console.error('Failed to load attendance:', e);
      const message = userMessage(e, 'Could not load attendance. Try again.');
      clockError.current = message;
      setError(message);
    }
  };

  async function clockIn(staffId: number): Promise<boolean> {
    try {
      await fetchJson('/api/attendance', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ userId: staffId }) });
      await loadRecords(); onChanged();
      return true;
    } catch (e) {
      console.error('Failed to clock in staff:', e);
      const message = userMessage(e, 'Could not clock in staff. Try again.');
      clockError.current = message;
      setError(message);
      return false;
    }
  }
  async function clockOut(recId: number): Promise<boolean> {
    try {
      await fetchJson('/api/attendance', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ attendanceId: recId }) });
      await loadRecords(); onChanged();
      return true;
    } catch (e) {
      console.error('Failed to clock out staff:', e);
      const message = userMessage(e, 'Could not clock out staff. Try again.');
      clockError.current = message;
      setError(message);
      return false;
    }
  }

  const toMin = (t?: string | null) => { if (!t) return null; const [h, m] = t.split(':').map(Number); return (h || 0) * 60 + (m || 0); };

  async function clockInScheduledNow() {
    setMsg('');
    setError('');
    const now = new Date();
    const nowMin = now.getHours() * 60 + now.getMinutes();
    let done = 0;
    const failed: string[] = [];
    for (const s of schedules) {
      const sm = toMin(s.shift?.startTime);
      const em = toMin(s.shift?.endTime);
      if (sm == null || em == null) continue;
      const scheduled = sm <= em ? (nowMin >= sm && nowMin <= em) : (nowMin >= sm || nowMin <= em);
      if (scheduled && !activeByUser.get(s.userId)) {
        clockError.current = '';
        if (await clockIn(s.userId)) done++;
        else failed.push(clockError.current || 'Could not clock in staff. Try again.');
      }
    }
    const attempted = done + failed.length;
    if (failed.length) {
      setError(`Clocked in ${done} of ${attempted} — ${failed.length} could not be clocked in: ${[...new Set(failed)].join('; ')}`);
    } else {
      setMsg(done ? `Clocked in ${done} scheduled staff.` : 'No staff currently scheduled to clock in.');
    }
    await loadSchedules();
  }

  async function clockOutEnded() {
    setMsg('');
    setError('');
    const now = new Date();
    const nowMin = now.getHours() * 60 + now.getMinutes();
    let done = 0;
    const failed: string[] = [];
    for (const rec of records) {
      if (rec.clockOut) continue;
      const ends = schedules.filter((s: any) => s.userId === rec.userId).map((s: any) => toMin(s.shift?.endTime)).filter((x): x is number => x != null);
      if (!ends.length) continue;
      const latestEnd = Math.max(...ends);
      if (nowMin > latestEnd) {
        clockError.current = '';
        if (await clockOut(rec.id)) done++;
        else failed.push(clockError.current || 'Could not clock out staff. Try again.');
      }
    }
    const attempted = done + failed.length;
    if (failed.length) {
      setError(`Clocked out ${done} of ${attempted} — ${failed.length} could not be clocked out: ${[...new Set(failed)].join('; ')}`);
    } else {
      setMsg(done ? `Clocked out ${done} ended shift(s).` : 'No ended shifts to clock out.');
    }
  }

  const activeByUser = new Map<number, any>();
  records.filter(r => !r.clockOut).forEach(r => activeByUser.set(r.userId, r));

  return (
    <div className="space-y-4">
      <div className="rounded-2xl bg-tile-sand px-4 py-3 text-sm text-ink">
        Staff clock in and out themselves from the menu sidebar. Use the buttons below to fix mistakes or to clock someone in for their shift.
      </div>
      <h2 className="text-base font-bold">Time clock</h2>
      <div className="flex gap-2 items-end flex-wrap">
        <div><label className="text-xs text-muted">From</label><input type="date" value={from} onChange={e => setFrom(e.target.value)} className="mt-1 block h-10 rounded-xl border border-hair bg-card px-3 text-sm outline-none focus:border-accent" /></div>
        <div><label className="text-xs text-muted">To</label><input type="date" value={to} onChange={e => setTo(e.target.value)} className="mt-1 block h-10 rounded-xl border border-hair bg-card px-3 text-sm outline-none focus:border-accent" /></div>
        <button onClick={loadRecords} className="c-btn c-btn--primary">Filter</button>
        <button onClick={clockInScheduledNow} className="c-btn c-btn--ghost">Clock in everyone scheduled now</button>
        <button onClick={clockOutEnded} className="c-btn c-btn--ghost">Clock out ended shifts</button>
        {msg && <span className="text-sm text-muted">{msg}</span>}
      </div>
      {error && <div className="rounded-xl bg-danger-bg px-4 py-3 text-sm text-danger">{error}</div>}

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
        {staff.map(s => {
          const active = activeByUser.get(s.id);
          return (
            <div key={s.id} className="c-card p-4 flex items-center justify-between">
              <div>
                <p className="font-medium text-ink">{s.name}</p>
                <p className="text-xs text-faint">{active ? 'In since ' + new Date(active.clockIn).toLocaleTimeString() : 'Not clocked in'}</p>
              </div>
              {active
                ? <button onClick={() => clockOut(active.id)} className="h-9 rounded-xl px-3 text-sm font-semibold text-danger hover:bg-danger-bg">Clock out</button>
                : <button onClick={() => clockIn(s.id)} className="h-9 rounded-xl bg-good-bg px-3 text-sm font-semibold text-good hover:brightness-95">Clock in</button>}
            </div>
          );
        })}
      </div>

      <div className="c-card overflow-hidden">
        <table className="c-table">
          <thead><tr className="border-b border-slate-100 text-muted"><th className="text-left p-3">Staff</th><th className="text-left p-3">In</th><th className="text-left p-3">Out</th><th className="text-left p-3">Hours</th></tr></thead>
          <tbody>
            {records.map(r => (
              <tr key={r.id} className="border-b border-slate-50">
                <td className="p-3">{r.user?.name}</td>
                <td className="p-3">{new Date(r.clockIn).toLocaleString()}</td>
                <td className="p-3">{r.clockOut ? new Date(r.clockOut).toLocaleString() : <span className="text-accent-text">Active</span>}</td>
                <td className="p-3">{r.totalHours ?? '—'}</td>
              </tr>
            ))}
            {records.length === 0 && <tr><td colSpan={4} className="p-6 text-center text-faint">No records in range</td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  );
}
