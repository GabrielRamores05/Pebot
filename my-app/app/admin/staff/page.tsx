'use client';

import { useState, useEffect, useCallback, Fragment, useRef } from 'react';
import { fetchJson, userMessage } from '@/lib/fetch-json';

// Pebot — Staff & HR (Philippine-friendly)
// Tabs: Team · Schedule · Time Clock · Time Off · Payroll · Reviews · Documents · Training
// Plus a plain-language Overview so the numbers make sense at a glance.

type Permission = {
  liveOrders: boolean; terminal: boolean; tables: boolean; analytics: boolean;
  products: boolean; inventory: boolean; kitchen: boolean; loyalty: boolean;
  staff: boolean; settings: boolean;
};

type StaffMember = {
  id: number; name: string; email: string; role: 'ADMIN' | 'STAFF' | 'KITCHEN';
  permissions: Permission; active: boolean; createdAt: string; hireDate?: string | null;
  position?: string | null; department?: string | null; phone?: string | null;
  address?: string | null; dateOfBirth?: string | null; hourlyRate?: number | null;
  monthlySalary?: number | null; paymentType?: string | null;
  emergencyContactName?: string | null; emergencyContactPhone?: string | null;
};

type Tab = 'Team' | 'Schedule' | 'Time Clock' | 'Time Off' | 'Payroll' | 'Reviews' | 'Documents' | 'Training';
const TABS: { key: Tab; label: string; hint: string }[] = [
  { key: 'Team', label: 'Team', hint: 'Who works here and what they do' },
  { key: 'Schedule', label: 'Schedule', hint: 'Weekly rota and shift templates' },
  { key: 'Time Clock', label: 'Time Clock', hint: 'Who is in, clock in / out' },
  { key: 'Time Off', label: 'Time Off', hint: 'Leave requests and approvals' },
  { key: 'Payroll', label: 'Payroll', hint: 'Pay runs with SSS / PhilHealth / Pag-IBIG' },
  { key: 'Reviews', label: 'Reviews', hint: 'Performance notes' },
  { key: 'Documents', label: 'Documents', hint: 'Contracts and certificates' },
  { key: 'Training', label: 'Training', hint: 'Courses and certifications' },
];

const PERMS: { key: keyof Permission; label: string; desc: string }[] = [
  { key: 'liveOrders', label: 'Live Orders', desc: 'View the live order board' },
  { key: 'terminal', label: 'POS Terminal', desc: 'Create and manage orders' },
  { key: 'tables', label: 'Tables', desc: 'Manage restaurant tables' },
  { key: 'analytics', label: 'Analytics', desc: 'View reports & metrics' },
  { key: 'products', label: 'Products', desc: 'Manage product catalog' },
  { key: 'inventory', label: 'Inventory', desc: 'Manage stock levels' },
  { key: 'kitchen', label: 'Kitchen', desc: 'View & prepare orders' },
  { key: 'loyalty', label: 'Loyalty', desc: 'Manage loyalty program' },
  { key: 'staff', label: 'Staff', desc: 'Manage staff & users' },
  { key: 'settings', label: 'Settings', desc: 'System configuration' },
];

const POSITIONS = ['Cashier', 'Server', 'Cook', 'Kitchen Staff', 'Barista', 'Shift Supervisor', 'Manager'];
const DEPARTMENTS = ['Front of House', 'Back of House', 'Management'];

export default function StaffPage() {
  const [activeTab, setActiveTab] = useState<Tab>('Team');
  const [overview, setOverview] = useState<{ team: number; inToday: number; pendingLeave: number; lastPayroll: string | null }>({ team: 0, inToday: 0, pendingLeave: 0, lastPayroll: null });
  const [overviewError, setOverviewError] = useState<string | null>(null);

  const loadOverview = useCallback(async () => {
    try {
      const today = iso(new Date());
      const [staffArr, attArr, leaveArr, payArr] = await Promise.all([
        fetchJson<StaffMember[]>('/api/staff'),
        fetchJson<{ clockOut?: string | null }[]>(`/api/attendance?from=${today}&to=${today}`),
        fetchJson<{ status?: string }[]>('/api/leave-requests'),
        fetchJson<{ periodEnd: string }[]>('/api/payroll'),
      ]);
      setOverview({
        team: staffArr.filter((x) => x.active).length,
        inToday: attArr.filter((x) => !x.clockOut).length,
        pendingLeave: leaveArr.filter((x) => x.status === 'PENDING').length,
        lastPayroll: payArr.length ? iso(new Date(payArr[0].periodEnd)) : null,
      });
      setOverviewError(null);
    } catch (e) {
      console.error('Failed to load staff overview:', e);
      setOverviewError(userMessage(e, 'Could not load the staff overview. Try again.'));
    }
  }, []);

  useEffect(() => { loadOverview(); }, [loadOverview]);

  return (
    <div className="p-4 sm:p-6 max-w-7xl mx-auto">
      <header className="mb-5">
        <p className="c-eyebrow">People</p>
        <h1 className="c-title mt-1">Staff &amp; HR</h1>
        <p className="text-sm text-muted mt-1">Your team, their schedule, attendance, leave and pay — in one place.</p>
      </header>
      {overviewError && <div className="mb-4 rounded-field bg-danger-bg border border-danger/30 text-danger text-sm p-3">{overviewError}</div>}

      {/* Overview strip */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
        <OverviewCard label="Active team" value={overview.team} icon="👥" />
        <OverviewCard label="Clocked in today" value={overview.inToday} icon="🟢" />
        <OverviewCard label="Pending time off" value={overview.pendingLeave} icon="📝" accent={overview.pendingLeave > 0} />
        <OverviewCard label="Last pay period end" value={overview.lastPayroll ?? '—'} icon="💸" small />
      </div>

      {/* Tab bar */}
      <div className="flex flex-wrap gap-1 mb-1 border-b border-hair">
        {TABS.map((t) => (
          <button
            key={t.key}
            onClick={() => setActiveTab(t.key)}
            className={`px-3 py-2 text-sm rounded-t-lg transition-colors ${
              activeTab === t.key
                ? 'bg-accent-soft text-accent-text font-semibold'
                : 'text-muted hover:bg-panel hover:text-ink'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>
      <p className="text-xs text-faint mb-5">{TABS.find(t => t.key === activeTab)?.hint}</p>

      {activeTab === 'Team' && <TeamTab onChanged={loadOverview} />}
      {activeTab === 'Schedule' && <ScheduleTab />}
      {activeTab === 'Time Clock' && <TimeClockTab onChanged={loadOverview} />}
      {activeTab === 'Time Off' && <TimeOffTab onChanged={loadOverview} />}
      {activeTab === 'Payroll' && <PayrollTab />}
      {activeTab === 'Reviews' && <ReviewsTab />}
      {activeTab === 'Documents' && <DocumentsTab />}
      {activeTab === 'Training' && <TrainingTab />}
    </div>
  );
}

function OverviewCard({ label, value, icon, accent, small }: { label: string; value: string | number; icon: string; accent?: boolean; small?: boolean }) {
  return (
    <div className={`c-card p-4 ${accent ? 'ring-1 ring-danger/30' : ''}`}>
      <div className="text-2xl">{icon}</div>
      <p className={`mt-1 font-bold text-ink tabular-nums ${small ? 'text-lg' : 'text-2xl'}`}>{value}</p>
      <p className="text-xs text-faint">{label}</p>
    </div>
  );
}

// ─── TEAM ─────────────────────────────────────────────────────────────────────
function TeamTab({ onChanged }: { onChanged: () => void }) {
  const [staff, setStaff] = useState<StaffMember[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [search, setSearch] = useState('');
  const [permDraft, setPermDraft] = useState<Permission>(blankPerms());
  const [form, setForm] = useState<StaffForm>(blankForm());

  const load = useCallback(async () => {
    setLoading(true);
    try {
      setStaff(await fetchJson<StaffMember[]>('/api/staff'));
      setError('');
    } catch (e) {
      console.error('Failed to load staff:', e);
      setError(userMessage(e, 'Could not load staff. Try again.'));
    }
    finally { setLoading(false); }
  }, []);
  useEffect(() => { load(); }, [load]);

  function openCreate() {
    setEditingId(null); setForm(blankForm()); setPermDraft(blankPerms()); setShowForm(true); setError(''); setSuccess('');
  }
  function openEdit(s: StaffMember) {
    setEditingId(s.id);
    setForm({
      name: s.name, email: s.email, role: s.role, password: '',
      phone: s.phone ?? '', address: s.address ?? '', dateOfBirth: s.dateOfBirth ? s.dateOfBirth.slice(0, 10) : '',
      hireDate: s.hireDate ? s.hireDate.slice(0, 10) : '', position: s.position ?? '', department: s.department ?? '',
      emergencyContactName: s.emergencyContactName ?? '', emergencyContactPhone: s.emergencyContactPhone ?? '',
      hourlyRate: s.hourlyRate != null ? String(s.hourlyRate) : '', monthlySalary: s.monthlySalary != null ? String(s.monthlySalary) : '', paymentType: s.paymentType ?? '',
    });
    setPermDraft(s.permissions);
    setShowForm(true); setError(''); setSuccess('');
  }

  async function submit() {
    setError(''); setSuccess('');
    const payload: any = {
      ...form,
      permissions: permDraft,
      hourlyRate: form.hourlyRate ? Number(form.hourlyRate) : null,
      monthlySalary: form.monthlySalary ? Number(form.monthlySalary) : null,
    };
    if (editingId) {
      if (!payload.password) delete payload.password;
      try {
        await fetchJson(`/api/staff/${editingId}`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
      } catch (e) {
        console.error('Failed to update staff:', e);
        setError(userMessage(e, 'Update failed'));
        return;
      }
      setSuccess('Staff updated');
    } else {
      if (!payload.password) { setError('Password is required for new staff'); return; }
      try {
        await fetchJson('/api/staff', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
      } catch (e) {
        console.error('Failed to create staff:', e);
        setError(userMessage(e, 'Create failed'));
        return;
      }
      setSuccess('Staff created');
    }
    setShowForm(false); await load(); onChanged();
  }

  async function toggleActive(s: StaffMember) {
    try {
      await fetchJson(`/api/staff/${s.id}`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ active: !s.active }) });
      await load();
      onChanged();
    } catch (e) {
      console.error('Failed to update staff status:', e);
      setError(userMessage(e, 'Could not update staff status. Try again.'));
    }
  }
  async function remove(s: StaffMember) {
    if (!confirm(`Delete ${s.name}? This cannot be undone.`)) return;
    try {
      await fetchJson(`/api/staff/${s.id}`, { method: 'DELETE' });
      await load();
      onChanged();
    } catch (e) {
      console.error('Failed to delete staff:', e);
      setError(userMessage(e, 'Could not delete staff. Try again.'));
    }
  }

  const filtered = staff.filter(s => s.name.toLowerCase().includes(search.toLowerCase()) || s.email.toLowerCase().includes(search.toLowerCase()));
  const active = filtered.filter(s => s.active).length;
  const full = filtered.filter(s => PERMS.every(p => s.permissions[p.key])).length;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold text-ink">Team ({filtered.length})</h2>
          {!showForm && <p className="text-xs text-faint mt-1">{active} active · {full} full access</p>}
        </div>
        {!showForm && (
          <button onClick={openCreate} className="rounded-xl bg-accent hover:bg-accent-soft0 text-white px-4 py-2 text-sm font-semibold">
            + Add staff
          </button>
        )}
      </div>

      {error && <div className="rounded-lg bg-red-50 border border-red-200 text-red-700 text-sm p-3">{error}</div>}
      {success && <div className="rounded-lg bg-green-50 border border-green-200 text-green-700 text-sm p-3">{success}</div>}

      {showForm && (
        <div className="rounded-2xl border border-hair bg-card p-5 shadow-sm space-y-5">
          <h3 className="font-semibold text-ink">{editingId ? 'Edit staff member' : 'Add staff member'}</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Field label="Full name" value={form.name} onChange={v => setForm({ ...form, name: v })} />
            <Field label="Email" value={form.email} onChange={v => setForm({ ...form, email: v })} />
            <Field label="Password (leave blank to keep)" type="password" value={form.password} onChange={v => setForm({ ...form, password: v })} />
            <div>
              <label className="text-xs font-medium text-muted">Role</label>
              <select value={form.role} onChange={e => setForm({ ...form, role: e.target.value as any })} className="mt-1 w-full rounded-lg border border-hair px-3 py-2 text-sm">
                <option value="STAFF">Staff</option>
                <option value="KITCHEN">Kitchen</option>
                <option value="ADMIN">Admin</option>
              </select>
            </div>
            <Field label="Phone" value={form.phone} onChange={v => setForm({ ...form, phone: v })} />
            <Field label="Address" value={form.address} onChange={v => setForm({ ...form, address: v })} />
            <Field label="Date of birth" type="date" value={form.dateOfBirth} onChange={v => setForm({ ...form, dateOfBirth: v })} />
            <Field label="Hire date" type="date" value={form.hireDate} onChange={v => setForm({ ...form, hireDate: v })} />
            <div>
              <label className="text-xs font-medium text-muted">Position</label>
              <select value={form.position} onChange={e => setForm({ ...form, position: e.target.value })} className="mt-1 w-full rounded-lg border border-hair px-3 py-2 text-sm">
                <option value="">—</option>
                {POSITIONS.map(p => <option key={p} value={p}>{p}</option>)}
              </select>
            </div>
            <div>
              <label className="text-xs font-medium text-muted">Department</label>
              <select value={form.department} onChange={e => setForm({ ...form, department: e.target.value })} className="mt-1 w-full rounded-lg border border-hair px-3 py-2 text-sm">
                <option value="">—</option>
                {DEPARTMENTS.map(d => <option key={d} value={d}>{d}</option>)}
              </select>
            </div>
            <Field label="Emergency contact name" value={form.emergencyContactName} onChange={v => setForm({ ...form, emergencyContactName: v })} />
            <Field label="Emergency contact phone" value={form.emergencyContactPhone} onChange={v => setForm({ ...form, emergencyContactPhone: v })} />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 border-t border-slate-100 pt-4">
            <div>
              <label className="text-xs font-medium text-muted">How they are paid</label>
              <select value={form.paymentType} onChange={e => setForm({ ...form, paymentType: e.target.value })} className="mt-1 w-full rounded-lg border border-hair px-3 py-2 text-sm">
                <option value="">—</option>
                <option value="HOURLY">Hourly wage</option>
                <option value="SALARIED">Monthly salary</option>
              </select>
            </div>
            <Field label="Hourly rate (₱)" value={form.hourlyRate} onChange={v => setForm({ ...form, hourlyRate: v })} />
            <Field label="Monthly salary (₱)" value={form.monthlySalary} onChange={v => setForm({ ...form, monthlySalary: v })} />
          </div>

          <div className="border-t border-slate-100 pt-4">
            <div className="flex items-center justify-between mb-2">
              <p className="text-sm font-semibold text-ink">What they can open</p>
              <div className="flex gap-2">
                <button onClick={() => setPermDraft(blankPerms(true))} className="text-xs text-accent-text hover:underline">Select all</button>
                <button onClick={() => setPermDraft(blankPerms())} className="text-xs text-faint hover:underline">Deselect all</button>
              </div>
            </div>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
              {PERMS.map(p => (
                <label key={p.key} className="flex items-start gap-2 p-2 rounded-lg border border-slate-100 hover:bg-page">
                  <input type="checkbox" checked={permDraft[p.key]} onChange={e => setPermDraft({ ...permDraft, [p.key]: e.target.checked })} className="mt-0.5" />
                  <span className="text-xs"><span className="font-medium text-ink">{p.label}</span><br /><span className="text-faint">{p.desc}</span></span>
                </label>
              ))}
            </div>
          </div>

          <div className="flex gap-2 justify-end">
            <button onClick={() => setShowForm(false)} className="px-4 py-2 rounded-lg text-muted hover:bg-panel text-sm">Cancel</button>
            <button onClick={submit} className="px-4 py-2 rounded-lg bg-accent hover:bg-accent-soft0 text-white text-sm font-semibold">Save</button>
          </div>
        </div>
      )}

      {!showForm && (
        <input
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="Search by name or email..."
          className="w-full md:w-80 rounded-xl border border-hair px-3 py-2 text-sm"
        />
      )}

      {loading ? (
        <div className="py-12 text-center text-gray-400">Loading…</div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filtered.map(s => (
            <div key={s.id} className="rounded-2xl border border-hair bg-card p-4 shadow-sm">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-gradient-to-br from-amber-400 to-amber-600 flex items-center justify-center text-white font-bold">
                  {s.name.charAt(0).toUpperCase()}
                </div>
                <div className="min-w-0">
                  <p className="font-semibold text-ink truncate">{s.name}</p>
                  <p className="text-xs text-faint truncate">{s.email}</p>
                </div>
              </div>
              <div className="mt-3 flex flex-wrap gap-1 text-[11px]">
                <Badge color={s.active ? 'green' : 'gray'}>{s.active ? 'Active' : 'Inactive'}</Badge>
                {s.position && <Badge color="blue">{s.position}</Badge>}
                {s.department && <Badge color="purple">{s.department}</Badge>}
                {s.paymentType && <Badge color="amber">{s.paymentType === 'HOURLY' ? `₱${s.hourlyRate}/hr` : `₱${s.monthlySalary}/mo`}</Badge>}
              </div>
              <div className="mt-3 flex gap-2">
                <button onClick={() => toggleActive(s)} className={`flex-1 text-xs rounded-lg py-1.5 ${s.active ? 'bg-gray-100 text-gray-600' : 'bg-green-50 text-green-700'}`}>
                  {s.active ? 'Deactivate' : 'Activate'}
                </button>
                <button onClick={() => openEdit(s)} className="flex-1 text-xs rounded-lg py-1.5 bg-blue-50 text-blue-700">Edit</button>
                <button onClick={() => remove(s)} className="flex-1 text-xs rounded-lg py-1.5 bg-red-50 text-red-600">Delete</button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── SCHEDULE ────────────────────────────────────────────────────────────────
function ScheduleTab() {
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
      <div className="rounded-2xl border border-hair bg-card p-4 shadow-sm">
        <div className="flex items-center justify-between mb-2">
          <div>
            <p className="text-sm font-semibold text-ink">Shift templates</p>
            <p className="text-xs text-faint">Create your own shifts (e.g. Opening, Closing). Times are shown as 12-hour.</p>
          </div>
          <button onClick={openNewShift} className="text-sm rounded-lg bg-accent text-white px-3 py-1.5">+ New shift</button>
        </div>
        {error && <p className="text-xs text-red-600 mb-2">{error}</p>}
        <div className="flex flex-wrap gap-2">
          {shifts.length === 0 && <span className="text-xs text-faint">None yet.</span>}
          {shifts.map(s => (
            <div key={s.id} className="inline-flex items-center gap-2 bg-page border border-hair rounded-full px-3 py-1 text-xs">
              <span className="font-medium text-ink">{s.name}</span>
              <span className="text-faint">{fmtTime(s.startTime)}–{fmtTime(s.endTime)}</span>
              <button onClick={() => openEditShift(s)} className="text-blue-600 hover:underline">edit</button>
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
            <button onClick={saveShift} className="rounded-lg bg-accent text-white px-3 py-2 text-sm font-semibold">{editingShift ? 'Update' : 'Add'}</button>
          </div>
        )}
      </div>

      <div className="flex items-center justify-between flex-wrap gap-2">
        <h2 className="text-lg font-semibold text-ink">Weekly schedule</h2>
        <div className="flex items-center gap-2">
          <button onClick={() => setWeekStart(addDays(weekStart, -7))} className="px-3 py-1.5 rounded-lg bg-panel text-sm">‹ Prev</button>
          <span className="text-sm text-muted">{iso(weekStart)} — {iso(addDays(weekStart, 6))}</span>
          <button onClick={() => setWeekStart(addDays(weekStart, 7))} className="px-3 py-1.5 rounded-lg bg-panel text-sm">Next ›</button>
        </div>
      </div>

      <div className="overflow-x-auto rounded-2xl border border-hair bg-card shadow-sm">
        <table className="w-full text-sm">
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
                          <div key={sc.id} className="inline-flex items-center gap-1 bg-accent-soft text-amber-800 rounded px-1.5 py-0.5 text-[11px]">
                            {sc.shift.name}
                            <button onClick={() => unassign(sc)} className="text-accent-text hover:text-red-600">×</button>
                          </div>
                        ))}
                        <select onChange={e => { if (e.target.value) { assign(s.id, Number(e.target.value), d); e.target.value = ''; } }} className="block w-full text-[11px] rounded border border-hair px-1 py-0.5">
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
    </div>
  );
}

// ─── TIME CLOCK ──────────────────────────────────────────────────────────────
function TimeClockTab({ onChanged }: { onChanged: () => void }) {
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
      <div className="rounded-2xl border border-amber-200 bg-accent-soft p-3 text-sm text-amber-800">
        Tip: staff are clocked in automatically when they log in, and clocked out when they log out. Use the buttons below only to fix mistakes.
      </div>
      <h2 className="text-lg font-semibold text-ink">Time clock</h2>
      <div className="flex gap-2 items-end flex-wrap">
        <div><label className="text-xs text-muted">From</label><input type="date" value={from} onChange={e => setFrom(e.target.value)} className="block rounded-lg border border-hair px-2 py-1 text-sm" /></div>
        <div><label className="text-xs text-muted">To</label><input type="date" value={to} onChange={e => setTo(e.target.value)} className="block rounded-lg border border-hair px-2 py-1 text-sm" /></div>
        <button onClick={loadRecords} className="px-3 py-1.5 rounded-lg bg-accent text-white text-sm">Filter</button>
        <button onClick={clockInScheduledNow} className="px-3 py-1.5 rounded-lg bg-green-600 text-white text-sm">Clock in everyone scheduled now</button>
        <button onClick={clockOutEnded} className="px-3 py-1.5 rounded-lg bg-rose-600 text-white text-sm">Clock out ended shifts</button>
        {msg && <span className="text-sm text-muted">{msg}</span>}
      </div>
      {error && <div className="rounded-lg bg-red-50 border border-red-200 text-red-700 text-sm p-3">{error}</div>}

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
        {staff.map(s => {
          const active = activeByUser.get(s.id);
          return (
            <div key={s.id} className="rounded-xl border border-hair bg-card p-3 flex items-center justify-between">
              <div>
                <p className="font-medium text-ink">{s.name}</p>
                <p className="text-xs text-faint">{active ? 'In since ' + new Date(active.clockIn).toLocaleTimeString() : 'Not clocked in'}</p>
              </div>
              {active
                ? <button onClick={() => clockOut(active.id)} className="px-3 py-1.5 rounded-lg bg-red-50 text-red-600 text-sm">Clock out</button>
                : <button onClick={() => clockIn(s.id)} className="px-3 py-1.5 rounded-lg bg-green-50 text-green-700 text-sm">Clock in</button>}
            </div>
          );
        })}
      </div>

      <div className="rounded-2xl border border-hair bg-card shadow-sm overflow-hidden">
        <table className="w-full text-sm">
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

// ─── TIME OFF ────────────────────────────────────────────────────────────────
function TimeOffTab({ onChanged }: { onChanged: () => void }) {
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
      <h2 className="text-lg font-semibold text-ink">Time off</h2>
      {error && <div className="rounded-lg bg-red-50 border border-red-200 text-red-700 text-sm p-3">{error}</div>}
      <div className="rounded-2xl border border-hair bg-card p-4 shadow-sm space-y-3">
        <p className="text-sm font-semibold text-ink">Request leave</p>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-3">
          <select value={form.userId} onChange={e => setForm({ ...form, userId: e.target.value })} className="rounded-lg border border-hair px-2 py-1.5 text-sm"><option value="">Staff</option>{staff.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}</select>
          <select value={form.leaveTypeId} onChange={e => setForm({ ...form, leaveTypeId: e.target.value })} className="rounded-lg border border-hair px-2 py-1.5 text-sm"><option value="">Type</option>{types.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}</select>
          <input type="date" value={form.startDate} onChange={e => setForm({ ...form, startDate: e.target.value })} className="rounded-lg border border-hair px-2 py-1.5 text-sm" />
          <input type="date" value={form.endDate} onChange={e => setForm({ ...form, endDate: e.target.value })} className="rounded-lg border border-hair px-2 py-1.5 text-sm" />
          <input placeholder="Reason" value={form.reason} onChange={e => setForm({ ...form, reason: e.target.value })} className="rounded-lg border border-hair px-2 py-1.5 text-sm" />
        </div>
        <button onClick={submit} className="px-4 py-2 rounded-lg bg-accent text-white text-sm font-semibold">Submit request</button>
      </div>

      <div className="rounded-2xl border border-hair bg-card shadow-sm overflow-hidden">
        <table className="w-full text-sm">
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
                    <button onClick={() => review(r.id, 'APPROVED')} className="text-xs px-2 py-1 rounded bg-green-50 text-green-700">Approve</button>
                    <button onClick={() => review(r.id, 'REJECTED')} className="text-xs px-2 py-1 rounded bg-red-50 text-red-600">Reject</button>
                  </>}
                </td>
              </tr>
            ))}
            {requests.length === 0 && <tr><td colSpan={5} className="p-6 text-center text-faint">No requests</td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ─── PAYROLL ─────────────────────────────────────────────────────────────────
function PayrollTab() {
  const [staff, setStaff] = useState<StaffMember[]>([]);
  const [records, setRecords] = useState<any[]>([]);
  const [form, setForm] = useState({ userId: '', periodStart: '', periodEnd: '', deductions: '0' });
  const [openId, setOpenId] = useState<number | null>(null);
  const [error, setError] = useState('');

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
      <div className="rounded-2xl border border-amber-200 bg-accent-soft p-3 text-sm text-amber-800">
        Payslips follow Philippine rules: SSS, PhilHealth and Pag-IBIG employee shares are deducted first, then BIR withholding tax is computed on what remains. This is a calculation guide — you still file and pay the agencies.
      </div>
      <h2 className="text-lg font-semibold text-ink">Payroll</h2>
      {error && <div className="rounded-lg bg-red-50 border border-red-200 text-red-700 text-sm p-3">{error}</div>}
      <div className="rounded-2xl border border-hair bg-card p-4 shadow-sm space-y-3">
        <p className="text-sm font-semibold text-ink">Run payroll for a period</p>
        <div className="flex flex-wrap gap-2 items-end">
          <select value={form.userId} onChange={e => setForm({ ...form, userId: e.target.value })} className="rounded-lg border border-hair px-2 py-1.5 text-sm"><option value="">Staff</option>{staff.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}</select>
          <input type="date" value={form.periodStart} onChange={e => setForm({ ...form, periodStart: e.target.value })} className="rounded-lg border border-hair px-2 py-1.5 text-sm" />
          <input type="date" value={form.periodEnd} onChange={e => setForm({ ...form, periodEnd: e.target.value })} className="rounded-lg border border-hair px-2 py-1.5 text-sm" />
          <input placeholder="Other deductions ₱" value={form.deductions} onChange={e => setForm({ ...form, deductions: e.target.value })} className="rounded-lg border border-hair px-2 py-1.5 text-sm w-32" />
          <button onClick={generate} className="px-4 py-2 rounded-lg bg-accent text-white text-sm font-semibold">Generate</button>
        </div>
      </div>

      <div className="rounded-2xl border border-hair bg-card shadow-sm overflow-hidden">
        <table className="w-full text-sm">
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
                    <td className="p-3"><Badge color={r.status === 'PAID' ? 'green' : r.status === 'PROCESSED' ? 'blue' : 'amber'}>{r.status}</Badge>{r.status !== 'PAID' && <button onClick={(e) => { e.stopPropagation(); markPaid(r.id); }} className="ml-2 text-xs text-green-600 hover:underline">Mark paid</button>}</td>
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
    </div>
  );
}

function Line({ label, value, sub, bold }: { label: string; value?: number; sub?: string; bold?: boolean }) {
  return (
    <div className="rounded-lg bg-card border border-slate-100 p-2">
      <p className="text-faint">{label}</p>
      <p className={`${bold ? 'font-bold text-ink' : 'text-ink'}`}>₱{(value ?? 0).toFixed(2)}</p>
      {sub && <p className="text-[10px] text-faint">{sub}</p>}
    </div>
  );
}

// ─── REVIEWS ─────────────────────────────────────────────────────────────────
function ReviewsTab() {
  const [staff, setStaff] = useState<StaffMember[]>([]);
  const [reviews, setReviews] = useState<any[]>([]);
  const [form, setForm] = useState({ userId: '', period: '', rating: '3', strengths: '', improvements: '', goals: '' });
  const [error, setError] = useState('');

  const load = async () => {
    try {
      const [s, r] = await Promise.all([fetchJson<StaffMember[]>('/api/staff'), fetchJson<Record<string, unknown>[]>('/api/performance-reviews')]);
      setStaff(s); setReviews(r); setError('');
    } catch (e) {
      console.error('Failed to load performance reviews:', e);
      setError(userMessage(e, 'Could not load reviews. Try again.'));
    }
  };
  useEffect(() => { load(); }, []);

  async function submit() {
    try {
      await fetchJson('/api/performance-reviews', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ...form, userId: Number(form.userId), rating: Number(form.rating) }) });
      setForm({ userId: '', period: '', rating: '3', strengths: '', improvements: '', goals: '' }); await load();
    } catch (e) {
      console.error('Failed to submit performance review:', e);
      setError(userMessage(e, 'Could not submit the review. Try again.'));
    }
  }

  return (
    <div className="space-y-4">
      <h2 className="text-lg font-semibold text-ink">Reviews</h2>
      {error && <div className="rounded-lg bg-red-50 border border-red-200 text-red-700 text-sm p-3">{error}</div>}
      <div className="rounded-2xl border border-hair bg-card p-4 shadow-sm space-y-3">
        <p className="text-sm font-semibold text-ink">New review</p>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <select value={form.userId} onChange={e => setForm({ ...form, userId: e.target.value })} className="rounded-lg border border-hair px-2 py-1.5 text-sm"><option value="">Staff</option>{staff.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}</select>
          <input placeholder="Period (e.g. Q3 2026)" value={form.period} onChange={e => setForm({ ...form, period: e.target.value })} className="rounded-lg border border-hair px-2 py-1.5 text-sm" />
          <select value={form.rating} onChange={e => setForm({ ...form, rating: e.target.value })} className="rounded-lg border border-hair px-2 py-1.5 text-sm">{[1,2,3,4,5].map(n => <option key={n} value={n}>{n}</option>)}</select>
          <input placeholder="Strengths" value={form.strengths} onChange={e => setForm({ ...form, strengths: e.target.value })} className="rounded-lg border border-hair px-2 py-1.5 text-sm" />
          <input placeholder="Improvements" value={form.improvements} onChange={e => setForm({ ...form, improvements: e.target.value })} className="rounded-lg border border-hair px-2 py-1.5 text-sm" />
          <input placeholder="Goals" value={form.goals} onChange={e => setForm({ ...form, goals: e.target.value })} className="rounded-lg border border-hair px-2 py-1.5 text-sm" />
        </div>
        <button onClick={submit} className="px-4 py-2 rounded-lg bg-accent text-white text-sm font-semibold">Submit review</button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        {reviews.map(r => (
          <div key={r.id} className="rounded-xl border border-hair bg-card p-3">
            <div className="flex items-center justify-between">
              <p className="font-medium text-ink">{r.user?.name}</p>
              <span className="text-amber-500 font-bold">{r.rating}</span>
            </div>
            <p className="text-xs text-faint">{r.period} · by {r.reviewer?.name}</p>
            {r.strengths && <p className="text-xs mt-1"><span className="font-medium">Strengths:</span> {r.strengths}</p>}
            {r.improvements && <p className="text-xs"><span className="font-medium">Improve:</span> {r.improvements}</p>}
            {r.goals && <p className="text-xs"><span className="font-medium">Goals:</span> {r.goals}</p>}
          </div>
        ))}
        {reviews.length === 0 && <p className="text-faint text-sm">No reviews yet.</p>}
      </div>
    </div>
  );
}

// ─── DOCUMENTS ───────────────────────────────────────────────────────────────
function DocumentsTab() {
  const [staff, setStaff] = useState<StaffMember[]>([]);
  const [selectedId, setSelectedId] = useState<number | ''>('');
  const [docs, setDocs] = useState<any[]>([]);
  const [form, setForm] = useState({ name: '', type: 'CONTRACT', fileUrl: '', expiryDate: '', notes: '' });
  const [error, setError] = useState('');

  const load = async () => {
    try { setStaff(await fetchJson<StaffMember[]>('/api/staff')); setError(''); }
    catch (e) { console.error('Failed to load staff for documents:', e); setError(userMessage(e, 'Could not load staff. Try again.')); }
  };
  async function loadDocs(id: number) {
    try { setDocs(await fetchJson<Record<string, unknown>[]>(`/api/staff/${id}/documents`)); setError(''); }
    catch (e) { console.error('Failed to load staff documents:', e); setError(userMessage(e, 'Could not load documents. Try again.')); }
  }
  useEffect(() => { load(); }, []);
  useEffect(() => { if (selectedId) loadDocs(Number(selectedId)); }, [selectedId]);

  async function submit() {
    if (!selectedId) return;
    try {
      await fetchJson(`/api/staff/${selectedId}/documents`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(form) });
      setForm({ name: '', type: 'CONTRACT', fileUrl: '', expiryDate: '', notes: '' }); await loadDocs(Number(selectedId));
    } catch (e) {
      console.error('Failed to add document:', e);
      setError(userMessage(e, 'Could not add the document. Try again.'));
    }
  }
  async function remove(id: number) {
    try {
      await fetchJson(`/api/staff/documents/${id}`, { method: 'DELETE' });
      if (selectedId) await loadDocs(Number(selectedId));
    } catch (e) {
      console.error('Failed to delete document:', e);
      setError(userMessage(e, 'Could not delete the document. Try again.'));
    }
  }

  return (
    <div className="space-y-4">
      <h2 className="text-lg font-semibold text-ink">Documents</h2>
      {error && <div className="rounded-lg bg-red-50 border border-red-200 text-red-700 text-sm p-3">{error}</div>}
      <select value={selectedId} onChange={e => setSelectedId(e.target.value ? Number(e.target.value) : '')} className="rounded-lg border border-hair px-3 py-2 text-sm max-w-xs">
        <option value="">Select staff member…</option>
        {staff.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
      </select>

      {selectedId && (
        <div className="space-y-3">
          <div className="rounded-2xl border border-hair bg-card p-4 shadow-sm space-y-2">
            <p className="text-sm font-semibold text-ink">Add document</p>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
              <input placeholder="Name" value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} className="rounded-lg border border-hair px-2 py-1.5 text-sm" />
              <select value={form.type} onChange={e => setForm({ ...form, type: e.target.value })} className="rounded-lg border border-hair px-2 py-1.5 text-sm">
                <option value="CONTRACT">Contract</option><option value="NDA">NDA</option><option value="CERTIFICATION">Certification</option><option value="OTHER">Other</option>
              </select>
              <input placeholder="File URL" value={form.fileUrl} onChange={e => setForm({ ...form, fileUrl: e.target.value })} className="rounded-lg border border-hair px-2 py-1.5 text-sm" />
              <input type="date" value={form.expiryDate} onChange={e => setForm({ ...form, expiryDate: e.target.value })} className="rounded-lg border border-hair px-2 py-1.5 text-sm" />
            </div>
            <button onClick={submit} className="px-4 py-2 rounded-lg bg-accent text-white text-sm font-semibold">Add</button>
          </div>

          <div className="space-y-2">
            {docs.map(d => (
              <div key={d.id} className="flex items-center justify-between rounded-xl border border-hair bg-card p-3">
                <div>
                  <p className="font-medium text-ink text-sm">{d.name} <Badge color="purple">{d.type}</Badge></p>
                  {d.expiryDate && <p className="text-xs text-faint">Expires {d.expiryDate.slice(0,10)}</p>}
                </div>
                <button onClick={() => remove(d.id)} className="text-xs text-red-600 hover:underline">Delete</button>
              </div>
            ))}
            {docs.length === 0 && <p className="text-faint text-sm">No documents.</p>}
          </div>
        </div>
      )}
    </div>
  );
}

// ─── TRAINING ────────────────────────────────────────────────────────────────
function TrainingTab() {
  const [staff, setStaff] = useState<StaffMember[]>([]);
  const [courses, setCourses] = useState<any[]>([]);
  const [newName, setNewName] = useState('');
  const [error, setError] = useState('');

  const load = async () => {
    try {
      const [s, c] = await Promise.all([fetchJson<StaffMember[]>('/api/staff'), fetchJson<Record<string, unknown>[]>('/api/training')]);
      setStaff(s); setCourses(c); setError('');
    } catch (e) {
      console.error('Failed to load training:', e);
      setError(userMessage(e, 'Could not load training. Try again.'));
    }
  };
  useEffect(() => { load(); }, []);

  async function addCourse() {
    if (!newName.trim()) return;
    try {
      await fetchJson('/api/training', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name: newName }) });
      setNewName(''); await load();
    } catch (e) {
      console.error('Failed to create training course:', e);
      setError(userMessage(e, 'Could not create the course. Try again.'));
    }
  }
  async function enroll(courseId: number, userId: number) {
    try {
      await fetchJson(`/api/training/${courseId}/enroll`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ userId }) });
      await load();
    } catch (e) {
      console.error('Failed to enroll staff in training:', e);
      setError(userMessage(e, 'Could not enroll staff. Try again.'));
    }
  }
  async function complete(courseId: number, userId: number) {
    try {
      await fetchJson(`/api/training/${courseId}/enroll`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ userId, status: 'COMPLETED', completedAt: new Date().toISOString() }) });
      await load();
    } catch (e) {
      console.error('Failed to complete training:', e);
      setError(userMessage(e, 'Could not mark training complete. Try again.'));
    }
  }

  return (
    <div className="space-y-4">
      <h2 className="text-lg font-semibold text-ink">Training</h2>
      {error && <div className="rounded-lg bg-red-50 border border-red-200 text-red-700 text-sm p-3">{error}</div>}
      <div className="flex gap-2">
        <input value={newName} onChange={e => setNewName(e.target.value)} placeholder="New course name…" className="rounded-lg border border-hair px-3 py-1.5 text-sm flex-1 max-w-xs" />
        <button onClick={addCourse} className="px-4 py-1.5 rounded-lg bg-accent text-white text-sm font-semibold">Add course</button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        {courses.map(c => (
          <div key={c.id} className="rounded-xl border border-hair bg-card p-3">
            <p className="font-medium text-ink">{c.name}</p>
            <p className="text-xs text-faint">{c.enrollments?.length ?? 0} enrolled</p>
            <details className="mt-2">
              <summary className="text-xs text-accent-text cursor-pointer">Manage enrollments</summary>
              <div className="mt-2 space-y-1">
                {staff.map(s => {
                  const en = c.enrollments?.find((e: any) => e.userId === s.id);
                  return (
                    <div key={s.id} className="flex items-center justify-between text-xs">
                      <span>{s.name}</span>
                      {!en
                        ? <button onClick={() => enroll(c.id, s.id)} className="text-blue-600 hover:underline">Enroll</button>
                        : en.status === 'COMPLETED'
                          ? <Badge color="green">Completed</Badge>
                          : <button onClick={() => complete(c.id, s.id)} className="text-green-600 hover:underline">Mark done</button>}
                    </div>
                  );
                })}
              </div>
            </details>
          </div>
        ))}
        {courses.length === 0 && <p className="text-faint text-sm">No courses yet.</p>}
      </div>
    </div>
  );
}

// ─── Helpers ─────────────────────────────────────────────────────────────────
function Field({ label, value, onChange, type = 'text' }: { label: string; value: string; onChange: (v: string) => void; type?: string }) {
  return (
    <div>
      <label className="text-xs font-medium text-muted">{label}</label>
      <input type={type} value={value} onChange={e => onChange(e.target.value)} className="mt-1 w-full rounded-lg border border-hair px-3 py-2 text-sm" />
    </div>
  );
}
function Badge({ children, color }: { children: React.ReactNode; color: 'green' | 'red' | 'amber' | 'blue' | 'purple' | 'gray' }) {
  const map: Record<string, string> = {
    green: 'bg-green-50 text-green-700', red: 'bg-red-50 text-red-600', amber: 'bg-accent-soft text-accent-text',
    blue: 'bg-blue-50 text-blue-700', purple: 'bg-purple-50 text-purple-700', gray: 'bg-gray-100 text-gray-500',
  };
  return <span className={`inline-block px-2 py-0.5 rounded-full text-[11px] font-medium ${map[color]}`}>{children}</span>;
}
function blankPerms(all = false): Permission {
  return { liveOrders: all, terminal: all, tables: all, analytics: all, products: all, inventory: all, kitchen: all, loyalty: all, staff: all, settings: all };
}
type StaffForm = {
  name: string; email: string; role: 'ADMIN' | 'STAFF' | 'KITCHEN'; password: string;
  phone: string; address: string; dateOfBirth: string; hireDate: string;
  position: string; department: string; emergencyContactName: string; emergencyContactPhone: string;
  hourlyRate: string; monthlySalary: string; paymentType: string;
};
function blankForm(): StaffForm {
  return { name: '', email: '', role: 'STAFF', password: '', phone: '', address: '', dateOfBirth: '', hireDate: '', position: '', department: '', emergencyContactName: '', emergencyContactPhone: '', hourlyRate: '', monthlySalary: '', paymentType: '' };
}
function getMonday(d: Date) { const day = (d.getDay() + 6) % 7; return addDays(new Date(d.getFullYear(), d.getMonth(), d.getDate()), -day); }
function addDays(d: Date, n: number) { const r = new Date(d); r.setDate(r.getDate() + n); return r; }
function iso(d: Date) { return d.toISOString().slice(0, 10); }
function dayName(d: Date) { return ['Mon','Tue','Wed','Thu','Fri','Sat','Sun'][(d.getDay()+6)%7]; }
function fmtTime(t?: string | null) {
  if (!t) return '';
  const [h, m] = t.split(':').map(Number);
  const period = h >= 12 ? 'PM' : 'AM';
  const hr = h % 12 === 0 ? 12 : h % 12;
  return `${hr}:${String(m).padStart(2, '0')} ${period}`;
}
function safeParse(json?: string | null) {
  if (!json) return null;
  try { return JSON.parse(json); } catch { return null; }
}
