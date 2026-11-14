'use client';

import { useState, useEffect, useCallback } from 'react';
import { formatPeso } from '@/lib/format';
import { BarList, Loading, Panel, Pill, Segmented, StatTile } from '@/components/pebot-ui';

interface CustomerTier {
  customerName: string;
  tier: 'VIP' | 'REGULAR' | 'CASUAL' | 'AT_RISK';
  lifetimeValue: number;
  totalOrders: number;
  averageOrderValue: number;
  vouchersIssued: number;
  vouchersRedeemed: number;
  coffeeProgress: number;
  coffeesClaimed: number;
  lastOrderDate: string | null;
  firstOrderDate: string;
  daysSinceLastOrder: number;
  visitFrequency: 'HIGH' | 'MEDIUM' | 'LOW';
}

interface TierStats {
  vipCount: number;
  regularCount: number;
  casualCount: number;
  atRiskCount: number;
  totalCustomers: number;
  avgLifetimeValue: number;
  retentionRate: number;
  churnRate: number;
  tierDistribution: { name: string; value: number; count: number }[];
}

const tierConfig = {
  VIP: { label: 'VIP', tone: 'accent' as const },
  REGULAR: { label: 'Regular', tone: 'good' as const },
  CASUAL: { label: 'Casual', tone: 'plain' as const },
  AT_RISK: { label: 'At risk', tone: 'danger' as const },
};

const FREQ_LABEL = { HIGH: 'Often', MEDIUM: 'Sometimes', LOW: 'Rarely' };

export default function CustomerLoyaltyTiers() {
  const [customers, setCustomers] = useState<CustomerTier[]>([]);
  const [stats, setStats] = useState<TierStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [tierFilter, setTierFilter] = useState<'ALL' | 'VIP' | 'REGULAR' | 'CASUAL' | 'AT_RISK'>('ALL');
  const [sortBy, setSortBy] = useState<'lifetime-value' | 'recent-visit' | 'frequency'>('lifetime-value');

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/loyalty/customers');
      if (!res.ok) throw new Error('Failed to fetch customer data');
      const data = await res.json();
      setCustomers(data.customers || []);
      setStats(data.stats || null);
    } catch (e) {
      console.error('Failed to load customer data:', e);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
    const interval = setInterval(fetchData, 10000); // Auto-refresh every 10s
    return () => clearInterval(interval);
  }, [fetchData]);

  // Filter and search
  const filteredCustomers = customers
    .filter(c => tierFilter === 'ALL' || c.tier === tierFilter)
    .filter(c => c.customerName.toLowerCase().includes(searchTerm.toLowerCase()));

  // Sort
  const sortedCustomers = [...filteredCustomers].sort((a, b) => {
    if (sortBy === 'lifetime-value') return b.lifetimeValue - a.lifetimeValue;
    if (sortBy === 'recent-visit') {
      const aDate = a.lastOrderDate ? new Date(a.lastOrderDate).getTime() : 0;
      const bDate = b.lastOrderDate ? new Date(b.lastOrderDate).getTime() : 0;
      return bDate - aDate;
    }
    if (sortBy === 'frequency') {
      const freqMap = { HIGH: 3, MEDIUM: 2, LOW: 1 };
      return freqMap[b.visitFrequency] - freqMap[a.visitFrequency];
    }
    return 0;
  });

  if (loading || !stats) return <Loading label="Loading customers…" />;

  return (
    <div className="space-y-4 px-6 pb-8">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-muted">
          {stats.totalCustomers} loyalty customers · average lifetime value <span className="font-semibold text-ink">{formatPeso(stats.avgLifetimeValue)}</span>
        </p>
        <button onClick={fetchData} className="c-btn c-btn--ghost">Refresh</button>
      </div>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-5">
        <StatTile tone="peach" label="VIP" value={stats.vipCount} note="Top spenders" />
        <StatTile tone="sage" label="Regular" value={stats.regularCount} note="Come back consistently" />
        <StatTile tone="sand" label="Casual" value={stats.casualCount} note="Now and then" />
        <StatTile tone={stats.atRiskCount > 0 ? 'danger' : 'plain'} label="At risk" value={stats.atRiskCount} note="No recent visits" />
        <StatTile tone="sky" label="Retention" value={`${(stats.retentionRate * 100).toFixed(1)}%`} note="Still active" />
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Panel title="Customers by tier">
          <BarList
            empty="No customers yet."
            rows={stats.tierDistribution.map((t) => ({ key: t.name, label: t.name, value: t.count, display: <span className="font-semibold text-ink">{t.count}</span> }))}
          />
        </Panel>
        <Panel title="Average lifetime value by tier">
          <BarList
            color="bg-[#C9A35B]"
            empty="No customers yet."
            rows={stats.tierDistribution.map((t) => ({ key: t.name, label: t.name, value: t.value, display: <span className="font-semibold text-ink">{formatPeso(t.value)}</span> }))}
          />
        </Panel>
      </div>

      <Panel
        padded={false}
        title="Customers"
        subtitle={`Showing ${sortedCustomers.length} of ${customers.length}`}
        actions={
          <>
            <input
              type="search"
              placeholder="Search by name"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="h-9 w-56 rounded-[10px] border border-hair bg-card px-3 text-sm outline-none focus:border-accent"
              aria-label="Search customers"
            />
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as typeof sortBy)}
              className="h-9 rounded-[10px] border border-hair bg-card px-2.5 text-sm outline-none focus:border-accent"
              aria-label="Sort customers"
            >
              <option value="lifetime-value">Highest value</option>
              <option value="recent-visit">Most recent visit</option>
              <option value="frequency">Visit frequency</option>
            </select>
          </>
        }
      >
        <div className="px-5 pb-3">
          <Segmented
            size="sm"
            value={tierFilter}
            onChange={setTierFilter}
            options={[
              { key: 'ALL', label: 'All' },
              { key: 'VIP', label: 'VIP' },
              { key: 'REGULAR', label: 'Regular' },
              { key: 'CASUAL', label: 'Casual' },
              { key: 'AT_RISK', label: 'At risk' },
            ]}
          />
        </div>
        {sortedCustomers.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="c-table">
              <thead>
                <tr>
                  <th>Customer</th>
                  <th>Tier</th>
                  <th className="c-num">Lifetime value</th>
                  <th className="c-num">Orders</th>
                  <th className="c-num">Average order</th>
                  <th>Visits</th>
                  <th>Last order</th>
                  <th>Loyalty</th>
                </tr>
              </thead>
              <tbody>
                {sortedCustomers.map((c) => (
                  <tr key={c.customerName} className="hover:bg-page">
                    <td className="font-semibold">{c.customerName}</td>
                    <td><Pill tone={tierConfig[c.tier].tone}>{tierConfig[c.tier].label}</Pill></td>
                    <td className="c-num font-bold">{formatPeso(c.lifetimeValue)}</td>
                    <td className="c-num">{c.totalOrders}</td>
                    <td className="c-num text-muted">{formatPeso(c.averageOrderValue)}</td>
                    <td className="text-muted">{FREQ_LABEL[c.visitFrequency]}</td>
                    <td className="text-muted">{c.lastOrderDate ? `${c.daysSinceLastOrder} days ago` : '—'}</td>
                    <td className="text-muted">{c.coffeeProgress}/9 stamps · {c.vouchersRedeemed}/{c.vouchersIssued} rewards used</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="px-5 pb-8 pt-4 text-center text-sm text-faint">No customers match.</p>
        )}
      </Panel>
    </div>
  );
}
