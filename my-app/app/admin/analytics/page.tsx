'use client';

import { useState, useEffect } from 'react';
import dynamic from 'next/dynamic';

type TabType = 'overview' | 'revenue' | 'customers' | 'fulfillment' | 'vouchers';

const TABS: { id: TabType; label: string }[] = [
  { id: 'overview', label: 'Overview' },
  { id: 'revenue', label: 'Revenue' },
  { id: 'customers', label: 'Customers' },
  { id: 'fulfillment', label: 'Fulfillment' },
  { id: 'vouchers', label: 'Vouchers' },
];

// Dynamically import dashboard components to avoid circular dependencies
const RevenueDashboard = dynamic(() => import('../revenue/page'), { ssr: false });
const CustomersDashboard = dynamic(() => import('../customers/page'), { ssr: false });
const FulfillmentDashboard = dynamic(() => import('../fulfillment/page'), { ssr: false });
const VouchersDashboard = dynamic(() => import('../vouchers/page'), { ssr: false });
const OverviewDashboard = dynamic(() => import('./overview'), { ssr: false });

export default function AnalyticsMaster() {
  const [activeTab, setActiveTab] = useState<TabType>('overview');
  const [mounted, setMounted] = useState(false);

  // Simple auth check
  useEffect(() => {
    fetch('/api/auth/me')
      .then((r) => r.ok ? r.json() : null)
      .then((data) => {
        if (!data?.user) {
          window.location.href = '/login';
        }
      })
      .catch(() => {
        window.location.href = '/login';
      });
  });

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) return null;

  return (
    <div className="flex h-full w-full flex-col bg-page">
      <header className="flex flex-wrap items-end justify-between gap-4 px-6 pb-4 pt-6">
        <div>
          <h1 className="c-title">Analytics</h1>
          <p className="mt-1.5 text-sm text-muted">How the restaurant is doing, by period.</p>
        </div>
        <nav className="flex border-b border-hair" aria-label="Analytics sections">
          {TABS.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              aria-current={activeTab === tab.id ? 'page' : undefined}
              className={`-mb-px whitespace-nowrap border-b-2 px-3.5 py-2.5 text-sm font-semibold transition ${activeTab === tab.id ? 'border-accent text-ink' : 'border-transparent text-muted hover:text-ink'}`}
            >
              {tab.label}
            </button>
          ))}
        </nav>
      </header>

      {/* Tab Content - Scrollable */}
      <div className="w-full flex-1 overflow-y-auto">
        {activeTab === 'overview' && <OverviewDashboard />}
        {activeTab === 'revenue' && <RevenueDashboard />}
        {activeTab === 'customers' && <CustomersDashboard />}
        {activeTab === 'fulfillment' && <FulfillmentDashboard />}
        {activeTab === 'vouchers' && <VouchersDashboard />}
      </div>
    </div>
  );
}
