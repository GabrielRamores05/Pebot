'use client';

import { useState, useEffect, useCallback } from 'react';
import { fetchJson, userMessage } from '@/lib/fetch-json';
import { PERMS, POSITIONS, DEPARTMENTS, Avatar, FormSection, Field, Badge, blankPerms, blankForm } from '../shared';
import type { Permission, StaffMember, StaffForm } from '../shared';

// ─── TEAM ─────────────────────────────────────────────────────────────────────
export function TeamTab({ onChanged }: { onChanged: () => void }) {
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

              <FormSection title="PIN" hint="4 to 6 digits for quick sign-in on the register. Managers and the owner also use it to approve voids and refunds.">
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <Field label={editingId ? 'New PIN (leave blank to keep)' : 'PIN (optional)'} type="password" value={form.pin ?? ''} onChange={v => setForm({ ...form, pin: v.replace(/\D/g, '').slice(0, 6) })} />
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
