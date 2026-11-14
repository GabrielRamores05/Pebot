'use client';

import { useState, useEffect, useCallback, Fragment, useRef } from 'react';
import { fetchJson, userMessage } from '@/lib/fetch-json';
import { StatTile } from '@/components/pebot-ui';

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
    <div className="min-h-full bg-page px-6 pb-10 pt-6">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="c-title">Staff &amp; HR</h1>
          <p className="mt-1.5 text-sm text-muted">
            <span className="font-semibold text-ink">{overview.team} active</span> · {overview.inToday} on shift now
            {overview.pendingLeave > 0 && <> · <span className="font-semibold text-danger">{overview.pendingLeave} time-off request{overview.pendingLeave === 1 ? '' : 's'} waiting</span></>}
          </p>
        </div>
      </header>
      {overviewError && <div className="mt-4 rounded-xl bg-danger-bg px-4 py-3 text-sm text-danger">{overviewError}</div>}

      <div className="mt-5 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatTile tone="peach" label="Active team" value={overview.team} note="People with a sign-in" />
        <StatTile tone="sage" label="On shift now" value={overview.inToday} note="Clocked in, not out yet" />
        <StatTile tone={overview.pendingLeave > 0 ? 'danger' : 'sand'} label="Time off to review" value={overview.pendingLeave} note="Pending requests" />
        <StatTile tone="sky" label="Last pay period" value={overview.lastPayroll ?? '—'} note="End date of the latest run" />
      </div>

      <nav className="mt-6 flex gap-1 overflow-x-auto border-b border-hair" aria-label="Staff sections">
        {TABS.map((t) => (
          <button
            key={t.key}
            onClick={() => setActiveTab(t.key)}
            aria-current={activeTab === t.key ? 'page' : undefined}
            className={`-mb-px whitespace-nowrap border-b-2 px-3.5 py-2.5 text-sm font-semibold transition ${
              activeTab === t.key ? 'border-accent text-ink' : 'border-transparent text-muted hover:text-ink'
            }`}
          >
            {t.label}
            {t.key === 'Time Off' && overview.pendingLeave > 0 && (
              <span className="ml-1.5 rounded-full bg-danger px-1.5 text-[11px] font-bold text-white tabular-nums">{overview.pendingLeave}</span>
            )}
          </button>
        ))}
      </nav>
      <p className="mb-5 mt-2 text-xs text-faint">{TABS.find(t => t.key === activeTab)?.hint}</p>

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

const AVATAR_TONES = ['bg-tile-peach text-accent-text', 'bg-tile-sage text-good', 'bg-tile-sand text-warn', 'bg-tile-sky text-info'];
function Avatar({ name, id }: { name: string; id: number }) {
  const initials = name.split(/\s+/).filter(Boolean).slice(0, 2).map((p) => p[0]!.toUpperCase()).join('') || '?';
  return (
    <span className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-sm font-bold ${AVATAR_TONES[id % AVATAR_TONES.length]}`}>
      {initials}
    </span>
  );
}

function FormSection({ title, hint, children }: { title: string; hint?: string; children: React.ReactNode }) {
  return (
    <section className="border-t border-hair pt-5 first:border-0 first:pt-0">
      <h4 className="text-sm font-bold">{title}</h4>
      {hint && <p className="mb-3 text-xs text-faint">{hint}</p>}
      <div className={hint ? '' : 'mt-3'}>{children}</div>
    </section>
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

  const accessCount = (p: Permission) => Object.values(p ?? {}).filter(Boolean).length;
  const payLabel = (m: StaffMember) =>
    m.paymentType === 'HOURLY' && m.hourlyRate ? `₱${Number(m.hourlyRate).toLocaleString('en-PH')}/hr`
      : m.paymentType === 'SALARIED' && m.monthlySalary ? `₱${Number(m.monthlySalary).toLocaleString('en-PH')}/mo`
      : '—';

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-3">
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search by name or email"
            aria-label="Search staff"
            className="h-10 w-72 rounded-xl border border-hair bg-card px-3 text-sm outline-none focus:border-accent"
          />
          <span className="text-sm text-muted">{filtered.length} people · {active} active · {full} with full access</span>
        </div>
        <button onClick={openCreate} className="c-btn c-btn--primary">Add staff</button>
      </div>

      {error && <div className="rounded-xl bg-danger-bg px-4 py-3 text-sm text-danger">{error}</div>}
      {success && <div className="rounded-xl bg-good-bg px-4 py-3 text-sm text-good">{success}</div>}

      {loading ? (
        <div className="py-16 text-center text-sm text-faint">Loading…</div>
      ) : filtered.length === 0 ? (
        <div className="c-card py-16 text-center">
          <p className="text-sm font-semibold">No staff yet</p>
          <p className="mt-1 text-xs text-faint">Add the people who work here so they can sign in.</p>
        </div>
      ) : (
        <div className="c-card overflow-x-auto">
          <table className="c-table min-w-[860px]">
            <thead>
              <tr>
                <th>Person</th>
                <th>Role</th>
                <th>Pay</th>
                <th>Access</th>
                <th>Status</th>
                <th className="text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map(m => {
                const n = accessCount(m.permissions);
                return (
                  <tr key={m.id} className="hover:bg-page">
                    <td>
                      <div className="flex items-center gap-3">
                        <Avatar name={m.name} id={m.id} />
                        <div className="min-w-0">
                          <p className="truncate font-semibold">{m.name}</p>
                          <p className="truncate text-xs text-faint">{m.email}{m.phone ? ` · ${m.phone}` : ''}</p>
                        </div>
                      </div>
                    </td>
                    <td>
                      <p className="font-medium">{m.position || (m.role === 'ADMIN' ? 'Owner / admin' : m.role === 'KITCHEN' ? 'Kitchen' : 'Staff')}</p>
                      <p className="text-xs text-faint">{m.department || '—'}{m.hireDate ? ` · since ${m.hireDate.slice(0, 10)}` : ''}</p>
                    </td>
                    <td className="tabular-nums">{payLabel(m)}</td>
                    <td>
                      {m.role === 'ADMIN' || n === PERMS.length
                        ? <Badge color="purple">Full access</Badge>
                        : <span className="text-sm text-muted">{n} of {PERMS.length} areas</span>}
                    </td>
                    <td><Badge color={m.active ? 'green' : 'gray'}>{m.active ? 'Active' : 'Inactive'}</Badge></td>
                    <td>
                      <div className="flex justify-end gap-1">
                        <button onClick={() => openEdit(m)} className="h-8 rounded-lg px-2.5 text-xs font-semibold text-ink hover:bg-panel">Edit</button>
                        <button onClick={() => toggleActive(m)} className="h-8 rounded-lg px-2.5 text-xs font-semibold text-muted hover:bg-panel">
                          {m.active ? 'Deactivate' : 'Activate'}
                        </button>
                        <button onClick={() => remove(m)} className="h-8 rounded-lg px-2.5 text-xs font-semibold text-danger hover:bg-danger-bg">Delete</button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Add / edit: side panel */}
      {showForm && (
        <div className="fixed inset-0 z-50 flex" role="dialog" aria-modal="true" aria-label={editingId ? 'Edit staff member' : 'Add staff member'}>
          <div className="absolute inset-0 bg-black/30" onClick={() => setShowForm(false)} />
          <div className="relative ml-auto flex h-full w-full max-w-xl flex-col bg-card shadow-pop">
            <div className="flex items-center justify-between border-b border-hair px-6 py-5">
              <div>
                <h3 className="text-lg font-bold tracking-[-0.02em]">{editingId ? 'Edit staff member' : 'Add staff member'}</h3>
                <p className="text-xs text-faint">They sign in with this email and password.</p>
              </div>
              <button onClick={() => setShowForm(false)} className="flex h-9 w-9 items-center justify-center rounded-xl text-muted hover:bg-panel" aria-label="Close">×</button>
            </div>

            <div className="flex-1 space-y-5 overflow-y-auto px-6 py-5">
              <FormSection title="Profile">
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <Field label="Full name" value={form.name} onChange={v => setForm({ ...form, name: v })} />
                  <Field label="Email" value={form.email} onChange={v => setForm({ ...form, email: v })} />
                  <Field label={editingId ? 'Password (leave blank to keep)' : 'Password'} type="password" value={form.password} onChange={v => setForm({ ...form, password: v })} />
                  <Field label="Phone" value={form.phone} onChange={v => setForm({ ...form, phone: v })} />
                  <div className="sm:col-span-2"><Field label="Address" value={form.address} onChange={v => setForm({ ...form, address: v })} /></div>
                  <Field label="Date of birth" type="date" value={form.dateOfBirth} onChange={v => setForm({ ...form, dateOfBirth: v })} />
                  <Field label="Emergency contact" value={form.emergencyContactName} onChange={v => setForm({ ...form, emergencyContactName: v })} />
                  <Field label="Emergency contact phone" value={form.emergencyContactPhone} onChange={v => setForm({ ...form, emergencyContactPhone: v })} />
                </div>
              </FormSection>

              <FormSection title="Employment and pay">
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <div>
                    <label className="text-xs font-semibold text-muted">Sign-in type</label>
                    <select value={form.role} onChange={e => setForm({ ...form, role: e.target.value as any })} className="mt-1 h-10 w-full rounded-xl border border-hair bg-card px-3 text-sm outline-none focus:border-accent">
                      <option value="STAFF">Staff</option>
                      <option value="KITCHEN">Kitchen</option>
                      <option value="ADMIN">Admin (full access)</option>
                    </select>
                  </div>
                  <Field label="Hire date" type="date" value={form.hireDate} onChange={v => setForm({ ...form, hireDate: v })} />
                  <div>
                    <label className="text-xs font-semibold text-muted">Position</label>
                    <select value={form.position} onChange={e => setForm({ ...form, position: e.target.value })} className="mt-1 h-10 w-full rounded-xl border border-hair bg-card px-3 text-sm outline-none focus:border-accent">
                      <option value="">—</option>
                      {POSITIONS.map(p => <option key={p} value={p}>{p}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="text-xs font-semibold text-muted">Department</label>
                    <select value={form.department} onChange={e => setForm({ ...form, department: e.target.value })} className="mt-1 h-10 w-full rounded-xl border border-hair bg-card px-3 text-sm outline-none focus:border-accent">
                      <option value="">—</option>
                      {DEPARTMENTS.map(d => <option key={d} value={d}>{d}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="text-xs font-semibold text-muted">How they are paid</label>
                    <select value={form.paymentType} onChange={e => setForm({ ...form, paymentType: e.target.value })} className="mt-1 h-10 w-full rounded-xl border border-hair bg-card px-3 text-sm outline-none focus:border-accent">
                      <option value="">—</option>
                      <option value="HOURLY">Hourly wage</option>
                      <option value="SALARIED">Monthly salary</option>
                    </select>
                  </div>
                  {form.paymentType === 'SALARIED'
                    ? <Field label="Monthly salary (₱)" value={form.monthlySalary} onChange={v => setForm({ ...form, monthlySalary: v })} />
                    : <Field label="Hourly rate (₱)" value={form.hourlyRate} onChange={v => setForm({ ...form, hourlyRate: v })} />}
                </div>
              </FormSection>

              <FormSection title="What they can open" hint="Admins can open everything. Pick the areas for everyone else.">
                <div className="mb-2 flex gap-3">
                  <button onClick={() => setPermDraft(blankPerms(true))} className="text-xs font-semibold text-accent-text hover:underline">Select all</button>
                  <button onClick={() => setPermDraft(blankPerms())} className="text-xs font-semibold text-faint hover:underline">Clear</button>
                </div>
                <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                  {PERMS.map(p => (
                    <label key={p.key} className={`flex cursor-pointer items-start gap-3 rounded-xl border p-3 transition ${permDraft[p.key] ? 'border-accent bg-accent-soft/50' : 'border-hair hover:bg-page'}`}>
                      <input type="checkbox" checked={permDraft[p.key]} onChange={e => setPermDraft({ ...permDraft, [p.key]: e.target.checked })} className="mt-0.5 h-4 w-4 accent-[var(--c-accent)]" />
                      <span className="text-sm"><span className="font-semibold">{p.label}</span><br /><span className="text-xs text-faint">{p.desc}</span></span>
                    </label>
                  ))}
                </div>
              </FormSection>
            </div>

            <div className="flex justify-end gap-2 border-t border-hair px-6 py-4">
              <button onClick={() => setShowForm(false)} className="c-btn c-btn--ghost">Cancel</button>
              <button onClick={submit} className="c-btn c-btn--primary">{editingId ? 'Save changes' : 'Add staff member'}</button>
            </div>
          </div>
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
      <div className="rounded-2xl bg-tile-sand px-4 py-3 text-sm text-ink">
        Tip: staff are clocked in automatically when they log in, and clocked out when they log out. Use the buttons below only to fix mistakes.
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
      <div className="rounded-2xl bg-tile-sand px-4 py-3 text-sm text-ink">
        Payslips follow Philippine rules: SSS, PhilHealth and Pag-IBIG employee shares are deducted first, then BIR withholding tax is computed on what remains. This is a calculation guide — you still file and pay the agencies.
      </div>
      <h2 className="text-base font-bold">Payroll</h2>
      {error && <div className="rounded-xl bg-danger-bg px-4 py-3 text-sm text-danger">{error}</div>}
      <div className="c-card p-5 space-y-3">
        <p className="text-sm font-semibold text-ink">Run payroll for a period</p>
        <div className="flex flex-wrap gap-2 items-end">
          <select value={form.userId} onChange={e => setForm({ ...form, userId: e.target.value })} className="h-10 rounded-xl border border-hair bg-card px-3 text-sm outline-none focus:border-accent"><option value="">Staff</option>{staff.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}</select>
          <input type="date" value={form.periodStart} onChange={e => setForm({ ...form, periodStart: e.target.value })} className="h-10 rounded-xl border border-hair bg-card px-3 text-sm outline-none focus:border-accent" />
          <input type="date" value={form.periodEnd} onChange={e => setForm({ ...form, periodEnd: e.target.value })} className="h-10 rounded-xl border border-hair bg-card px-3 text-sm outline-none focus:border-accent" />
          <input placeholder="Other deductions ₱" value={form.deductions} onChange={e => setForm({ ...form, deductions: e.target.value })} className="h-10 rounded-xl border border-hair bg-card px-3 text-sm outline-none focus:border-accent w-40" />
          <button onClick={generate} className="c-btn c-btn--primary">Generate</button>
        </div>
      </div>

      <div className="c-card overflow-hidden">
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
    <div className={`rounded-xl p-3 ${bold ? 'bg-tile-sage' : 'bg-card border border-hair'}`}>
      <p className="text-faint">{label}</p>
      <p className={`tabular-nums ${bold ? 'text-base font-bold' : 'font-semibold'}`}>₱{(value ?? 0).toFixed(2)}</p>
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
      <h2 className="text-base font-bold">Reviews</h2>
      {error && <div className="rounded-xl bg-danger-bg px-4 py-3 text-sm text-danger">{error}</div>}
      <div className="c-card p-5 space-y-3">
        <p className="text-sm font-semibold text-ink">New review</p>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <select value={form.userId} onChange={e => setForm({ ...form, userId: e.target.value })} className="h-10 rounded-xl border border-hair bg-card px-3 text-sm outline-none focus:border-accent"><option value="">Staff</option>{staff.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}</select>
          <input placeholder="Period (e.g. Q3 2026)" value={form.period} onChange={e => setForm({ ...form, period: e.target.value })} className="h-10 rounded-xl border border-hair bg-card px-3 text-sm outline-none focus:border-accent" />
          <select value={form.rating} onChange={e => setForm({ ...form, rating: e.target.value })} className="h-10 rounded-xl border border-hair bg-card px-3 text-sm outline-none focus:border-accent">{[1,2,3,4,5].map(n => <option key={n} value={n}>{n}</option>)}</select>
          <input placeholder="Strengths" value={form.strengths} onChange={e => setForm({ ...form, strengths: e.target.value })} className="h-10 rounded-xl border border-hair bg-card px-3 text-sm outline-none focus:border-accent" />
          <input placeholder="Improvements" value={form.improvements} onChange={e => setForm({ ...form, improvements: e.target.value })} className="h-10 rounded-xl border border-hair bg-card px-3 text-sm outline-none focus:border-accent" />
          <input placeholder="Goals" value={form.goals} onChange={e => setForm({ ...form, goals: e.target.value })} className="h-10 rounded-xl border border-hair bg-card px-3 text-sm outline-none focus:border-accent" />
        </div>
        <button onClick={submit} className="c-btn c-btn--primary">Submit review</button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        {reviews.map(r => (
          <div key={r.id} className="c-card p-4">
            <div className="flex items-center justify-between">
              <p className="font-medium text-ink">{r.user?.name}</p>
              <span className="rounded-full bg-tile-sand px-2 py-0.5 text-xs font-bold text-warn tabular-nums">{r.rating} / 5</span>
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
      <h2 className="text-base font-bold">Documents</h2>
      {error && <div className="rounded-xl bg-danger-bg px-4 py-3 text-sm text-danger">{error}</div>}
      <select value={selectedId} onChange={e => setSelectedId(e.target.value ? Number(e.target.value) : '')} className="rounded-lg border border-hair px-3 py-2 text-sm max-w-xs">
        <option value="">Select staff member…</option>
        {staff.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
      </select>

      {selectedId && (
        <div className="space-y-3">
          <div className="rounded-2xl border border-hair bg-card p-4 shadow-sm space-y-2">
            <p className="text-sm font-semibold text-ink">Add document</p>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
              <input placeholder="Name" value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} className="h-10 rounded-xl border border-hair bg-card px-3 text-sm outline-none focus:border-accent" />
              <select value={form.type} onChange={e => setForm({ ...form, type: e.target.value })} className="h-10 rounded-xl border border-hair bg-card px-3 text-sm outline-none focus:border-accent">
                <option value="CONTRACT">Contract</option><option value="NDA">NDA</option><option value="CERTIFICATION">Certification</option><option value="OTHER">Other</option>
              </select>
              <input placeholder="File URL" value={form.fileUrl} onChange={e => setForm({ ...form, fileUrl: e.target.value })} className="h-10 rounded-xl border border-hair bg-card px-3 text-sm outline-none focus:border-accent" />
              <input type="date" value={form.expiryDate} onChange={e => setForm({ ...form, expiryDate: e.target.value })} className="h-10 rounded-xl border border-hair bg-card px-3 text-sm outline-none focus:border-accent" />
            </div>
            <button onClick={submit} className="c-btn c-btn--primary">Add</button>
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
      <h2 className="text-base font-bold">Training</h2>
      {error && <div className="rounded-xl bg-danger-bg px-4 py-3 text-sm text-danger">{error}</div>}
      <div className="flex gap-2">
        <input value={newName} onChange={e => setNewName(e.target.value)} placeholder="New course name…" className="rounded-lg border border-hair px-3 py-1.5 text-sm flex-1 max-w-xs" />
        <button onClick={addCourse} className="px-4 py-1.5 rounded-lg bg-accent text-white text-sm font-semibold">Add course</button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        {courses.map(c => (
          <div key={c.id} className="c-card p-4">
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
      <label className="text-xs font-semibold text-muted">{label}</label>
      <input type={type} value={value} onChange={e => onChange(e.target.value)} className="mt-1 h-10 w-full rounded-xl border border-hair bg-card px-3 text-sm outline-none focus:border-accent" />
    </div>
  );
}
function Badge({ children, color }: { children: React.ReactNode; color: 'green' | 'red' | 'amber' | 'blue' | 'purple' | 'gray' }) {
  const map = {
    green: 'bg-good-bg text-good',
    red: 'bg-danger-bg text-danger',
    amber: 'bg-warn-bg text-warn',
    blue: 'bg-info-bg text-info',
    purple: 'bg-accent-soft text-accent-text',
    gray: 'bg-panel text-muted',
  };
  return <span className={`inline-flex items-center whitespace-nowrap rounded-full px-2 py-0.5 text-xs font-semibold ${map[color]}`}>{children}</span>;
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
