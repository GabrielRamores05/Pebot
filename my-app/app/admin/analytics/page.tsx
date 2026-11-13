'use client';

import { useState, useEffect } from 'react';
import dynamic from 'next/dynamic';

type TabType = 'overview' | 'revenue' | 'customers' | 'fulfillment' | 'vouchers';

const TABS: { id: TabType; label: string }[] = [
  { id: 'overview', label: '📊 Overview' },
  { id: 'revenue', label: '💰 Revenue' },
  { id: 'customers', label: '👥 Customers' },
  { id: 'fulfillment', label: '⚡ Fulfillment' },
  { id: 'vouchers', label: '🎟️ Vouchers' },
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
    <div className="w-full h-full flex flex-col bg-gradient-to-br from-gray-100 to-gray-200">
      {/* Sticky Tab Navigation */}
      <div className="sticky top-0 z-20 bg-white/80 backdrop-blur-xl border-b border-gray-200/50 px-6 flex-shrink-0" style={{ scrollBehavior: 'smooth' }}>
        <div className="flex items-center gap-0.5 overflow-x-auto scrollbar-thin scrollbar-thumb-gray-300 scrollbar-track-gray-100">
          {TABS.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`px-4 py-4 font-medium text-sm border-b-2 transition-all whitespace-nowrap ${
                activeTab === tab.id
                  ? 'border-amber-500 text-accent-text'
                  : 'border-transparent text-gray-500 hover:text-gray-900'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* Tab Content - Scrollable */}
      <div className="flex-1 w-full overflow-y-auto scrollbar-thin scrollbar-thumb-gray-300 scrollbar-track-gray-100">
        {activeTab === 'overview' && <OverviewDashboard />}
        {activeTab === 'revenue' && <RevenueDashboard />}
        {activeTab === 'customers' && <CustomersDashboard />}
        {activeTab === 'fulfillment' && <FulfillmentDashboard />}
        {activeTab === 'vouchers' && <VouchersDashboard />}
      </div>
    </div>
  );
}
