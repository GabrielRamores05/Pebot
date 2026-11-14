'use client';

// Shared building blocks for the Pebot design system (spec 018).
// Pages compose these so every screen has the same rhythm: header, tiles, panels.

import type { ReactNode } from 'react';

export const CHART = {
  accent: '#B4472A',
  second: '#C9A35B',
  third: '#2F6B45',
  fourth: '#2F5B9A',
  grid: '#E7E1D8',
  axis: '#7B7369',
  palette: ['#B4472A', '#C9A35B', '#2F6B45', '#2F5B9A', '#D07E5F', '#7B7369', '#963A22'],
  tooltip: {
    backgroundColor: '#FFFDFA',
    border: '1px solid #E7E1D8',
    borderRadius: 12,
    boxShadow: '0 12px 30px -16px rgba(45,30,20,0.35)',
  },
};

/** Page header: big title, one-line summary, actions on the right. */
export function PageHeader({ title, summary, actions }: { title: string; summary?: ReactNode; actions?: ReactNode }) {
  return (
    <header className="flex flex-wrap items-end justify-between gap-4 px-6 pb-4 pt-6">
      <div className="min-w-0">
        <h1 className="c-title">{title}</h1>
        {summary && <p className="mt-1.5 text-sm text-muted">{summary}</p>}
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
    </header>
  );
}

export type Tone = 'peach' | 'sage' | 'sand' | 'sky' | 'danger' | 'plain';
const TONES: Record<Tone, string> = {
  peach: 'bg-tile-peach',
  sage: 'bg-tile-sage',
  sand: 'bg-tile-sand',
  sky: 'bg-tile-sky',
  danger: 'bg-danger-bg',
  plain: 'bg-card border border-hair',
};

/** Pastel headline number. */
export function StatTile({ label, value, note, tone = 'plain' }: { label: string; value: ReactNode; note?: ReactNode; tone?: Tone }) {
  return (
    <div className={`min-w-0 rounded-[20px] px-5 py-4 ${TONES[tone]}`}>
      <p className="text-[13px] font-semibold text-muted">{label}</p>
      <p className="mt-1 truncate text-[26px] font-bold leading-tight tabular-nums tracking-[-0.03em]">{value}</p>
      {note && <p className="truncate text-xs text-muted">{note}</p>}
    </div>
  );
}

export function StatRow({ children }: { children: ReactNode }) {
  return <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">{children}</div>;
}

/** White panel with a title row. */
export function Panel({
  title,
  subtitle,
  actions,
  children,
  className = '',
  id,
  padded = true,
}: {
  title?: ReactNode;
  subtitle?: ReactNode;
  actions?: ReactNode;
  children: ReactNode;
  className?: string;
  id?: string;
  padded?: boolean;
}) {
  return (
    <section id={id} className={`c-card min-w-0 ${padded ? 'p-5' : ''} ${className}`}>
      {(title || actions) && (
        <div className={`mb-3 flex flex-wrap items-start justify-between gap-3 ${padded ? '' : 'px-5 pt-5'}`}>
          <div className="min-w-0">
            {title && <h3 className="text-base font-bold">{title}</h3>}
            {subtitle && <p className="text-xs text-faint">{subtitle}</p>}
          </div>
          {actions && <div className="flex items-center gap-2">{actions}</div>}
        </div>
      )}
      {children}
    </section>
  );
}

/** Segmented control (period filters, view switches). */
export function Segmented<T extends string>({
  options,
  value,
  onChange,
  size = 'md',
}: {
  options: { key: T; label: string }[];
  value: T;
  onChange: (v: T) => void;
  size?: 'sm' | 'md';
}) {
  return (
    <div className="inline-flex flex-wrap rounded-xl bg-panel p-1">
      {options.map((o) => (
        <button
          key={o.key}
          onClick={() => onChange(o.key)}
          className={`${size === 'sm' ? 'h-8 px-3 text-xs' : 'h-9 px-3.5 text-[13px]'} rounded-[10px] font-semibold transition ${
            value === o.key ? 'bg-card text-ink shadow-card' : 'text-muted hover:text-ink'
          }`}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

/** Underline tabs inside a page. */
export function Tabs<T extends string>({ tabs, value, onChange }: { tabs: { key: T; label: string; count?: number }[]; value: T; onChange: (v: T) => void }) {
  return (
    <nav className="flex gap-1 overflow-x-auto border-b border-hair" aria-label="Sections">
      {tabs.map((t) => (
        <button
          key={t.key}
          onClick={() => onChange(t.key)}
          aria-current={value === t.key ? 'page' : undefined}
          className={`-mb-px flex items-center gap-1.5 whitespace-nowrap border-b-2 px-3.5 py-2.5 text-sm font-semibold transition ${
            value === t.key ? 'border-accent text-ink' : 'border-transparent text-muted hover:text-ink'
          }`}
        >
          {t.label}
          {t.count != null && <span className="rounded-full bg-panel px-1.5 text-[11px] tabular-nums text-muted">{t.count}</span>}
        </button>
      ))}
    </nav>
  );
}

/** Ranked list with proportional bars. */
export function BarList({
  rows,
  color = 'bg-accent',
  ranked = false,
  empty = 'Nothing to show yet.',
}: {
  rows: { label: ReactNode; value: number; display: ReactNode; key?: string }[];
  color?: string;
  ranked?: boolean;
  empty?: string;
}) {
  if (rows.length === 0) return <Empty>{empty}</Empty>;
  const max = Math.max(...rows.map((r) => r.value), 0) || 1;
  return (
    <ol className="space-y-3">
      {rows.map((r, i) => (
        <li key={r.key ?? i} className="flex items-center gap-3">
          {ranked && (
            <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-panel text-xs font-bold tabular-nums text-muted">{i + 1}</span>
          )}
          <div className="min-w-0 flex-1">
            <div className="flex items-baseline justify-between gap-2 text-sm">
              <span className="truncate font-semibold">{r.label}</span>
              <span className="shrink-0 tabular-nums text-muted">{r.display}</span>
            </div>
            <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-panel">
              <div className={`h-full rounded-full ${color}`} style={{ width: `${r.value > 0 ? Math.max(2, (r.value / max) * 100) : 0}%` }} />
            </div>
          </div>
        </li>
      ))}
    </ol>
  );
}

export function Empty({ children }: { children: ReactNode }) {
  return <p className="py-8 text-center text-sm text-faint">{children}</p>;
}

export function Loading({ label = 'Loading…' }: { label?: string }) {
  return <div className="flex items-center justify-center py-24 text-sm text-faint">{label}</div>;
}

/** Small status pill. */
export function Pill({ children, tone = 'plain' }: { children: ReactNode; tone?: 'good' | 'warn' | 'danger' | 'info' | 'accent' | 'plain' }) {
  const map = {
    good: 'bg-good-bg text-good',
    warn: 'bg-warn-bg text-warn',
    danger: 'bg-danger-bg text-danger',
    info: 'bg-info-bg text-info',
    accent: 'bg-accent-soft text-accent-text',
    plain: 'bg-panel text-muted',
  };
  return <span className={`inline-flex items-center gap-1 whitespace-nowrap rounded-full px-2 py-0.5 text-xs font-semibold ${map[tone]}`}>{children}</span>;
}

/** Growth vs previous period, e.g. "▲ 12.0% vs previous". */
export function Delta({ value, suffix = 'vs previous' }: { value: number | null; suffix?: string }) {
  if (value == null || !Number.isFinite(value) || value === 0) return <span className="text-faint">No change {suffix}</span>;
  const up = value > 0;
  return (
    <span className={up ? 'text-good' : 'text-danger'}>
      {up ? '▲' : '▼'} {Math.abs(value * 100).toFixed(1)}% <span className="text-muted">{suffix}</span>
    </span>
  );
}
