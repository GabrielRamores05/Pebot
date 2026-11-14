'use client';

import { useState, useEffect } from 'react';
import { fetchJson, userMessage } from '@/lib/fetch-json';
import { Field, getMonday, addDays, iso, dayName, fmtTime } from '../shared';
import type { StaffMember } from '../shared';

// ─── SCHEDULE ────────────────────────────────────────────────────────────────
export function ScheduleTab() {
  const [holidays, setHolidays] = useState<{ id: number; date: string; name: string; type: string }[]>([]);
  const [holidayForm, setHolidayForm] = useState({ date: '', name: '', type: 'SPECIAL_HOLIDAY' });
  const [holidayMsg, setHolidayMsg] = useState<string | null>(null);
  const loadHolidays = () => fetchJson<typeof holidays>(`/api/holidays?year=${new Date().getFullYear()}`).then(setHolidays).catch(() => setHolidays([]));
  useEffect(() => { loadHolidays(); }, []);
  async function addHoliday() {
    try {
      await fetchJson('/api/holidays', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(holidayForm) });
      setHolidayForm({ date: '', name: '', type: 'SPECIAL_HOLIDAY' }); setHolidayMsg(null); loadHolidays();
    } catch (e) { setHolidayMsg(userMessage(e, 'Could not save the holiday.')); }
  }
  async function deleteHoliday(id: number) {
    try { await fetchJson(`/api/holidays?id=${id}`, { method: 'DELETE' }); loadHolidays(); } catch (e) { setHolidayMsg(userMessage(e, 'Could not remove the holiday.')); }
  }
  const [staff, setStaff] = useState<StaffMember[]>([]);
  const [shifts, setShifts] = useState<any[]>([]);
  const [schedules, setSchedules] = useState<any[]>([]);
  const [weekStart, setWeekStart] = useState(getMonday(new Date()));
  const [editingShift, setEditingShift] = useState<any | null>(null);
  const [shiftForm, setShiftForm] = useState({ name: '', startTime: '08:00', endTime: '17:00', breakMinutes: 60 });
  const [showShiftForm, setShowShiftForm] = useState(false);
  const [error, setError] = useState('');

  const loadShifts = async () => {
    try { setShifts(await fetchJson<Record<string, unknown>[]>('/api/shifts')); }
    catch (e) { console.error('Failed to load shifts:', e); setError(userMessage(e, 'Could not load shifts. Try again.')); }
  };
  const loadStaff = async () => {
    try { setStaff(await fetchJson<StaffMember[]>('/api/staff')); }
    catch (e) { console.error('Failed to load staff:', e); setError(userMessage(e, 'Could not load staff. Try again.')); }
  };
  const loadSchedules = async () => {
    const from = iso(weekStart); const to = iso(addDays(weekStart, 6));
    try { setSchedules(await fetchJson<Record<string, unknown>[]>(`/api/schedules?from=${from}&to=${to}`)); }
    catch (e) { console.error('Failed to load schedules:', e); setError(userMessage(e, 'Could not load schedules. Try again.')); }
  };
  useEffect(() => { loadStaff(); loadShifts(); loadSchedules(); }, [weekStart]);

  const weekDays = Array.from({ length: 7 }, (_, i) => addDays(weekStart, i));
  function daySchedules(day: Date, userId: number) {
    return schedules.filter(s => s.userId === userId && s.date.slice(0, 10) === iso(day).slice(0, 10));
  }

  async function assign(userId: number, shiftId: number, day: Date) {
    try {
      await fetchJson('/api/schedules', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ userId, shiftId, dates: [iso(day)] }) });
      setError(''); await loadSchedules();
    } catch (e) {
      console.error('Failed to assign schedule:', e);
      setError(userMessage(e, 'Could not assign the schedule. Try again.'));
    }
  }
  async function unassign(s: any) {
    try {
      await fetchJson('/api/schedules', { method: 'DELETE', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id: s.id }) });
      await loadSchedules();
    } catch (e) {
      console.error('Failed to remove schedule:', e);
      setError(userMessage(e, 'Could not remove the schedule. Try again.'));
    }
  }

  function openNewShift() { setEditingShift(null); setShiftForm({ name: '', startTime: '08:00', endTime: '17:00', breakMinutes: 60 }); setShowShiftForm(true); setError(''); }
  function openEditShift(s: any) { setEditingShift(s); setShiftForm({ name: s.name, startTime: s.startTime, endTime: s.endTime, breakMinutes: s.breakMinutes ?? 0 }); setShowShiftForm(true); setError(''); }
  async function saveShift() {
    if (!shiftForm.name) { setError('Name required'); return; }
    const body = { name: shiftForm.name, startTime: shiftForm.startTime, endTime: shiftForm.endTime, breakMinutes: Number(shiftForm.breakMinutes) };
    try {
      await fetchJson('/api/shifts', {
        method: editingShift ? 'PUT' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(editingShift ? { id: editingShift.id, ...body } : body),
      });
      setShowShiftForm(false); await loadShifts();
    } catch (e) {
      console.error('Failed to save shift:', e);
      setError(userMessage(e, 'Save failed'));
    }
  }
  async function deleteShift(id: number) {
    if (!confirm('Delete this shift template?')) return;
    try {
      await fetchJson('/api/shifts', { method: 'DELETE', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id }) });
      await loadShifts();
    } catch (e) {
      console.error('Failed to delete shift:', e);
      setError(userMessage(e, 'Could not delete the shift. Try again.'));
    }
  }

  return (
    <div className="space-y-5">
      <div className="c-card p-5">
        <div className="flex items-center justify-between mb-2">
          <div>
            <p className="text-sm font-semibold text-ink">Shift templates</p>
            <p className="text-xs text-faint">Create your own shifts (e.g. Opening, Closing). Times are shown as 12-hour.</p>
          </div>
          <button onClick={openNewShift} className="c-btn c-btn--primary">+ New shift</button>
        </div>
        {error && <p className="text-xs text-red-600 mb-2">{error}</p>}
        <div className="flex flex-wrap gap-2">
          {shifts.length === 0 && <span className="text-xs text-faint">None yet.</span>}
          {shifts.map(s => (
            <div key={s.id} className="inline-flex items-center gap-2 rounded-full border border-hair bg-card px-3 py-1.5 text-xs">
              <span className="font-medium text-ink">{s.name}</span>
              <span className="text-faint">{fmtTime(s.startTime)}–{fmtTime(s.endTime)}</span>
              <button onClick={() => openEditShift(s)} className="font-semibold text-accent-text hover:underline">Edit</button>
              <button onClick={() => deleteShift(s.id)} className="text-red-500 hover:text-red-700">×</button>
            </div>
          ))}
        </div>

        {showShiftForm && (
          <div className="mt-3 grid grid-cols-2 md:grid-cols-5 gap-2 items-end border-t border-slate-100 pt-3">
            <Field label="Name" value={shiftForm.name} onChange={v => setShiftForm({ ...shiftForm, name: v })} />
            <Field label="Start" type="time" value={shiftForm.startTime} onChange={v => setShiftForm({ ...shiftForm, startTime: v })} />
            <Field label="End" type="time" value={shiftForm.endTime} onChange={v => setShiftForm({ ...shiftForm, endTime: v })} />
            <Field label="Break (min)" value={String(shiftForm.breakMinutes)} onChange={v => setShiftForm({ ...shiftForm, breakMinutes: Number(v) || 0 })} />
            <button onClick={saveShift} className="c-btn c-btn--primary">{editingShift ? 'Update' : 'Add'}</button>
          </div>
        )}
      </div>

      <div className="flex items-center justify-between flex-wrap gap-2">
        <h2 className="text-base font-bold">Weekly schedule</h2>
        <div className="flex items-center gap-2">
          <button onClick={() => setWeekStart(addDays(weekStart, -7))} className="c-btn c-btn--ghost h-9">‹ Prev</button>
          <span className="text-sm text-muted">{iso(weekStart)} — {iso(addDays(weekStart, 6))}</span>
          <button onClick={() => setWeekStart(addDays(weekStart, 7))} className="c-btn c-btn--ghost h-9">Next ›</button>
        </div>
      </div>

      <div className="c-card overflow-x-auto">
        <table className="c-table">
          <thead>
            <tr className="border-b border-slate-100">
              <th className="text-left p-3">Staff</th>
              {weekDays.map(d => <th key={d.toISOString()} className="text-center p-3 font-medium text-muted">{dayName(d)}<br /><span className="text-xs text-faint">{d.getMonth()+1}/{d.getDate()}</span></th>)}
            </tr>
          </thead>
          <tbody>
            {staff.map(s => (
              <tr key={s.id} className="border-b border-slate-50">
                <td className="p-3 font-medium text-ink">{s.name}{s.position ? <span className="text-xs text-faint block">{s.position}</span> : null}</td>
                {weekDays.map(d => {
                  const ds = daySchedules(d, s.id);
                  return (
                    <td key={d.toISOString()} className="p-2 text-center">
                      <div className="space-y-1">
                        {ds.map(sc => (
                          <div key={sc.id} className="inline-flex items-center gap-1 rounded-full bg-accent-soft px-2 py-0.5 text-[11px] font-semibold text-accent-text">
                            {sc.shift.name}
                            <button onClick={() => unassign(sc)} className="text-accent-text hover:text-red-600">×</button>
                          </div>
                        ))}
                        <select onChange={e => { if (e.target.value) { assign(s.id, Number(e.target.value), d); e.target.value = ''; } }} className="block w-full rounded-lg border border-dashed border-hair bg-transparent px-1.5 py-1 text-[11px] text-muted">
                          <option value="">+ shift</option>
                          {shifts.map(sh => <option key={sh.id} value={sh.id}>{sh.name}</option>)}
                        </select>
                      </div>
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="c-card p-5">
        <p className="text-sm font-semibold text-ink">Holidays {new Date().getFullYear()}</p>
        <p className="mb-3 text-xs text-faint">Payroll pays 200% on regular holidays and 130% on special days worked. Add holidays proclaimed for this year (for example Eid al-Fitr, Chinese New Year).</p>
        <div className="mb-3 flex flex-wrap gap-1.5">
          {holidays.map((h) => (
            <span key={h.id} className={`inline-flex items-center gap-2 rounded-full px-3 py-1 text-xs ${h.type === 'REGULAR_HOLIDAY' ? 'bg-accent-soft text-accent-text' : 'bg-tile-sand text-warn'}`}>
              <b className="tabular-nums">{new Date(h.date + 'T00:00:00').toLocaleDateString([], { month: 'short', day: 'numeric' })}</b> {h.name}
              <button onClick={() => deleteHoliday(h.id)} className="opacity-60 hover:opacity-100" aria-label={`Remove ${h.name}`}>×</button>
            </span>
          ))}
        </div>
        <div className="flex flex-wrap items-end gap-2">
          <input type="date" value={holidayForm.date} onChange={e => setHolidayForm({ ...holidayForm, date: e.target.value })} className="h-10 rounded-xl border border-hair bg-card px-3 text-sm outline-none focus:border-accent" aria-label="Holiday date" />
          <input value={holidayForm.name} onChange={e => setHolidayForm({ ...holidayForm, name: e.target.value })} placeholder="Name" className="h-10 rounded-xl border border-hair bg-card px-3 text-sm outline-none focus:border-accent" aria-label="Holiday name" />
          <select value={holidayForm.type} onChange={e => setHolidayForm({ ...holidayForm, type: e.target.value })} className="h-10 rounded-xl border border-hair bg-card px-3 text-sm outline-none focus:border-accent" aria-label="Holiday type">
            <option value="REGULAR_HOLIDAY">Regular holiday (200%)</option>
            <option value="SPECIAL_HOLIDAY">Special day (130%)</option>
          </select>
          <button onClick={addHoliday} disabled={!holidayForm.date || holidayForm.name.trim().length < 2} className="c-btn c-btn--ghost disabled:opacity-50">Add holiday</button>
        </div>
        {holidayMsg && <p className="mt-2 text-sm text-danger">{holidayMsg}</p>}
      </div>
    </div>
  );
}
