'use client';

import { useState, useEffect, useCallback } from 'react';
import { fetchJson, userMessage } from '@/lib/fetch-json';
import { StatTile } from '@/components/pebot-ui';
import { TABS, iso } from './shared';
import type { StaffMember, Tab } from './shared';
import { TeamTab } from './tabs/TeamTab';
import { ScheduleTab } from './tabs/ScheduleTab';
import { TimeClockTab } from './tabs/TimeClockTab';
import { TimeOffTab } from './tabs/TimeOffTab';
import { PayrollTab } from './tabs/PayrollTab';
import { ReviewsTab } from './tabs/ReviewsTab';
import { DocumentsTab } from './tabs/DocumentsTab';
import { TrainingTab } from './tabs/TrainingTab';

// Pebot — Staff & HR (Philippine-friendly)
// Tabs: Team · Schedule · Time Clock · Time Off · Payroll · Reviews · Documents · Training
// Plus a plain-language Overview so the numbers make sense at a glance.

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
