'use client';

// Shared types, constants and small components for Staff & HR.


export type Permission = {
  liveOrders: boolean; terminal: boolean; tables: boolean; analytics: boolean;
  products: boolean; inventory: boolean; kitchen: boolean; loyalty: boolean;
  staff: boolean; settings: boolean;
};

export type StaffMember = {
  id: number; name: string; email: string; role: 'ADMIN' | 'STAFF' | 'KITCHEN';
  permissions: Permission; active: boolean; createdAt: string; hireDate?: string | null;
  position?: string | null; department?: string | null; phone?: string | null;
  address?: string | null; dateOfBirth?: string | null; hourlyRate?: number | null;
  monthlySalary?: number | null; paymentType?: string | null;
  emergencyContactName?: string | null; emergencyContactPhone?: string | null;
};

export type Tab = 'Team' | 'Schedule' | 'Time Clock' | 'Time Off' | 'Payroll' | 'Reviews' | 'Documents' | 'Training';

export const TABS: { key: Tab; label: string; hint: string }[] = [
  { key: 'Team', label: 'Team', hint: 'Who works here and what they do' },
  { key: 'Schedule', label: 'Schedule', hint: 'Weekly rota and shift templates' },
  { key: 'Time Clock', label: 'Time Clock', hint: 'Who is in, clock in / out' },
  { key: 'Time Off', label: 'Time Off', hint: 'Leave requests and approvals' },
  { key: 'Payroll', label: 'Payroll', hint: 'Pay runs with SSS / PhilHealth / Pag-IBIG' },
  { key: 'Reviews', label: 'Reviews', hint: 'Performance notes' },
  { key: 'Documents', label: 'Documents', hint: 'Contracts and certificates' },
  { key: 'Training', label: 'Training', hint: 'Courses and certifications' },
];

export const PERMS: { key: keyof Permission; label: string; desc: string }[] = [
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

export const POSITIONS = ['Cashier', 'Server', 'Cook', 'Kitchen Staff', 'Barista', 'Shift Supervisor', 'Manager'];

export const DEPARTMENTS = ['Front of House', 'Back of House', 'Management'];

export const AVATAR_TONES = ['bg-tile-peach text-accent-text', 'bg-tile-sage text-good', 'bg-tile-sand text-warn', 'bg-tile-sky text-info'];

export function Avatar({ name, id }: { name: string; id: number }) {
  const initials = name.split(/\s+/).filter(Boolean).slice(0, 2).map((p) => p[0]!.toUpperCase()).join('') || '?';
  return (
    <span className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-sm font-bold ${AVATAR_TONES[id % AVATAR_TONES.length]}`}>
      {initials}
    </span>
  );
}

export function FormSection({ title, hint, children }: { title: string; hint?: string; children: React.ReactNode }) {
  return (
    <section className="border-t border-hair pt-5 first:border-0 first:pt-0">
      <h4 className="text-sm font-bold">{title}</h4>
      {hint && <p className="mb-3 text-xs text-faint">{hint}</p>}
      <div className={hint ? '' : 'mt-3'}>{children}</div>
    </section>
  );
}

export function Line({ label, value, sub, bold }: { label: string; value?: number; sub?: string; bold?: boolean }) {
  return (
    <div className={`rounded-xl p-3 ${bold ? 'bg-tile-sage' : 'bg-card border border-hair'}`}>
      <p className="text-faint">{label}</p>
      <p className={`tabular-nums ${bold ? 'text-base font-bold' : 'font-semibold'}`}>₱{(value ?? 0).toFixed(2)}</p>
      {sub && <p className="text-[10px] text-faint">{sub}</p>}
    </div>
  );
}

// ─── Helpers ─────────────────────────────────────────────────────────────────
export function Field({ label, value, onChange, type = 'text' }: { label: string; value: string; onChange: (v: string) => void; type?: string }) {
  return (
    <div>
      <label className="text-xs font-semibold text-muted">{label}</label>
      <input type={type} value={value} onChange={e => onChange(e.target.value)} className="mt-1 h-10 w-full rounded-xl border border-hair bg-card px-3 text-sm outline-none focus:border-accent" />
    </div>
  );
}

export function Badge({ children, color }: { children: React.ReactNode; color: 'green' | 'red' | 'amber' | 'blue' | 'purple' | 'gray' }) {
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

export function blankPerms(all = false): Permission {
  return { liveOrders: all, terminal: all, tables: all, analytics: all, products: all, inventory: all, kitchen: all, loyalty: all, staff: all, settings: all };
}

export type StaffForm = {
  name: string; email: string; role: 'ADMIN' | 'STAFF' | 'KITCHEN'; password: string;
  phone: string; address: string; dateOfBirth: string; hireDate: string;
  position: string; department: string; emergencyContactName: string; emergencyContactPhone: string;
  hourlyRate: string; monthlySalary: string; paymentType: string;
  pin?: string;
};

export function blankForm(): StaffForm {
  return { name: '', email: '', role: 'STAFF', password: '', phone: '', address: '', dateOfBirth: '', hireDate: '', position: '', department: '', emergencyContactName: '', emergencyContactPhone: '', hourlyRate: '', monthlySalary: '', paymentType: '' };
}

export function getMonday(d: Date) { const day = (d.getDay() + 6) % 7; return addDays(new Date(d.getFullYear(), d.getMonth(), d.getDate()), -day); }

export function addDays(d: Date, n: number) { const r = new Date(d); r.setDate(r.getDate() + n); return r; }

export function iso(d: Date) { return d.toISOString().slice(0, 10); }

export function dayName(d: Date) { return ['Mon','Tue','Wed','Thu','Fri','Sat','Sun'][(d.getDay()+6)%7]; }

export function fmtTime(t?: string | null) {
  if (!t) return '';
  const [h, m] = t.split(':').map(Number);
  const period = h >= 12 ? 'PM' : 'AM';
  const hr = h % 12 === 0 ? 12 : h % 12;
  return `${hr}:${String(m).padStart(2, '0')} ${period}`;
}

export function safeParse(json?: string | null) {
  if (!json) return null;
  try { return JSON.parse(json); } catch { return null; }
}
