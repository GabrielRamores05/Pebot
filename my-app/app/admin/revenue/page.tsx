'use client';

import { useState, useEffect, useCallback } from 'react';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { formatPeso } from '@/lib/format';
import { BarList, CHART, Delta, Loading, Panel, Segmented, StatRow, StatTile } from '@/components/pebot-ui';
import ProfitPanel from './ProfitPanel';

interface RevenueMetrics {
  totalRevenue: number;
  totalOrders: number;
  averageOrderValue: number;
  completedOrdersRevenue: number;
  loyaltyRevenueImpact: number;
  paymentMethods: { method: string; amount: number; count: number }[];
  revenueByDay: { date: string; revenue: number; orders: number }[];
  topProductsByRevenue: { name: string; revenue: number; quantity: number }[];
  revenueByCategory: { category: string; revenue: number; percentage: number }[];
  customerSpending: { percentile: string; count: number; revenue: number }[];
}


const FILTERS = [
  { key: 'today', label: 'Today' },
  { key: 'week', label: 'This Week' },
  { key: 'month', label: 'This Month' },
  { key: 'quarter', label: 'This Quarter' },
  { key: 'year', label: 'This Year' },
  { key: 'all', label: 'All Time' },
];

function formatPercent(value: number): string {
  return `${(value * 100).toFixed(1)}%`;
}

function getFilterLabel(filter: string): string {
  const now = new Date();
  if (filter === 'today') return 'Today';
  if (filter === 'week') {
    const start = new Date(now);
    start.setDate(now.getDate() - 6);
    return `Last 7 Days`;
  }
  if (filter === 'month') return now.toLocaleDateString([], { month: 'long', year: 'numeric' });
  if (filter === 'quarter') {
    const q = Math.ceil((now.getMonth() + 1) / 3);
    return `Q${q} ${now.getFullYear()}`;
  }
  if (filter === 'year') return now.getFullYear().toString();
  return 'All Time';
}

export default function RevenueDashboard() {
  const [data, setData] = useState<RevenueMetrics | null>(null);
  const [filter, setFilter] = useState('month');
  const [loading, setLoading] = useState(true);
  const [previousData, setPreviousData] = useState<RevenueMetrics | null>(null);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/analytics/revenue?filter=${filter}`);
      if (!res.ok) throw new Error('Failed to fetch revenue data');
      const json = await res.json();
      setData(json);
      
      // Fetch previous period for comparison
      const prevFilter = filter === 'today' ? 'yesterday' : filter;
      const prevRes = await fetch(`/api/analytics/revenue?filter=${prevFilter}&period=previous`);
      if (prevRes.ok) {
        const prevJson = await prevRes.json();
        setPreviousData(prevJson);
      }
    } catch (e) {
      console.error('Failed to load revenue data:', e);
    } finally {
      setLoading(false);
    }
  }, [filter]);

  useEffect(() => { fetchData(); }, [fetchData]);

  // Only refresh on filter change, not on socket events (to prevent excessive API calls)
  // useSocket({ events: { 'analytics-update': () => { fetchData(); } } });

  if (loading || !data) return <Loading label="Loading revenue…" />;

  const growth = (now: number, before?: number) => (before ? (now - before) / before : null);
  const revenueGrowth = growth(data.totalRevenue, previousData?.totalRevenue);
  const orderGrowth = growth(data.totalOrders, previousData?.totalOrders);
  const pct = (part: number) => (data.totalRevenue > 0 ? `${((part / data.totalRevenue) * 100).toFixed(1)}%` : '—');
  const methodLabel = (m: string) => (m === 'GCASH' ? 'GCash' : m === 'PAYMAYA' || m === 'MAYA' ? 'Maya' : m === 'CASH' ? 'Cash' : m === 'CARD' ? 'Card' : m);

  return (
    <div className="space-y-4 px-6 pb-8">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-muted">{getFilterLabel(filter)}</p>
        <Segmented options={FILTERS} value={filter} onChange={setFilter} />
      </div>

      <StatRow>
        <StatTile tone="peach" label="Revenue" value={formatPeso(data.totalRevenue)} note={<Delta value={revenueGrowth} />} />
        <StatTile tone="sand" label="Average order" value={formatPeso(data.averageOrderValue)} note={`${data.totalOrders} orders`} />
        <StatTile tone="sage" label="Orders" value={data.totalOrders} note={<Delta value={orderGrowth} />} />
        <StatTile tone="sky" label="Loyalty rewards given" value={formatPeso(data.loyaltyRevenueImpact)} note="Value of covered items on reward orders" />
      </StatRow>

      <ProfitPanel filter={filter} />

      <div className="grid gap-4 xl:grid-cols-3">
        <Panel title="Revenue trend" subtitle="Revenue per day in the period" className="xl:col-span-2">
          {data.revenueByDay.length > 0 ? (
            <ResponsiveContainer width="100%" height={280}>
              <AreaChart data={data.revenueByDay} margin={{ left: 0, right: 8, top: 4 }}>
                <defs>
                  <linearGradient id="rev-fill" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor={CHART.accent} stopOpacity={0.22} />
                    <stop offset="100%" stopColor={CHART.accent} stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid vertical={false} stroke={CHART.grid} />
                <XAxis dataKey="date" stroke={CHART.axis} tickLine={false} axisLine={false} tick={{ fontSize: 11 }} />
                <YAxis stroke={CHART.axis} tickLine={false} axisLine={false} tick={{ fontSize: 11 }} width={64}
                  tickFormatter={(v) => `₱${Number(v).toLocaleString('en-PH')}`} />
                <Tooltip contentStyle={CHART.tooltip}
                  formatter={(v, key) => (key === 'orders' ? [String(v), 'Orders'] : [formatPeso(Number(v ?? 0)), 'Revenue']) as [string, string]} />
                <Area type="monotone" dataKey="revenue" stroke={CHART.accent} strokeWidth={2.5} fill="url(#rev-fill)" name="Revenue" />
              </AreaChart>
            </ResponsiveContainer>
          ) : (
            <div className="flex h-[280px] items-center justify-center text-sm text-faint">No revenue in this period yet.</div>
          )}
        </Panel>

        <Panel title="How they paid" subtitle="Share of revenue by payment method">
          {data.paymentMethods.length > 0 ? (
            <>
              <div className="mb-4 flex h-2.5 overflow-hidden rounded-full bg-panel">
                {data.paymentMethods.map((pm, i) => (
                  <div key={pm.method} style={{ width: pct(pm.amount), backgroundColor: CHART.palette[i % CHART.palette.length] }} />
                ))}
              </div>
              <ul className="space-y-2.5">
                {data.paymentMethods.map((pm, i) => (
                  <li key={pm.method} className="flex items-center gap-3 text-sm">
                    <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ backgroundColor: CHART.palette[i % CHART.palette.length] }} />
                    <span className="min-w-0 flex-1">
                      <span className="block font-semibold">{methodLabel(pm.method)}</span>
                      <span className="block text-xs text-faint">{pm.count} payment{pm.count === 1 ? '' : 's'} · {pct(pm.amount)}</span>
                    </span>
                    <span className="font-bold tabular-nums">{formatPeso(pm.amount)}</span>
                  </li>
                ))}
              </ul>
            </>
          ) : (
            <p className="py-8 text-center text-sm text-faint">No payments in this period.</p>
          )}
        </Panel>
      </div>

      <div className="grid gap-4 xl:grid-cols-3">
        <Panel title="Top dishes by revenue" subtitle="What earns the most" className="xl:col-span-2">
          <BarList
            ranked
            empty="No sales in this period yet."
            rows={data.topProductsByRevenue.map((p) => ({ key: p.name, label: p.name, value: p.revenue, display: <>{p.quantity}× · <span className="font-semibold text-ink">{formatPeso(p.revenue)}</span></> }))}
          />
        </Panel>
        <Panel title="Revenue by category">
          <BarList
            color="bg-[#C9A35B]"
            empty="No sales in this period yet."
            rows={[...data.revenueByCategory].sort((a, b) => b.revenue - a.revenue).map((c) => ({ key: c.category, label: c.category, value: c.revenue, display: <>{pct(c.revenue)} · <span className="font-semibold text-ink">{formatPeso(c.revenue)}</span></> }))}
          />
        </Panel>
      </div>

      <Panel title="Customer spending" subtitle="How spending is spread across customers">
        {data.customerSpending.length > 0 ? (
          <div className="grid gap-3 md:grid-cols-3">
            {data.customerSpending.map((cs, i) => (
              <StatTile key={cs.percentile} tone={(['peach', 'sand', 'sage'] as const)[i % 3]} label={cs.percentile} value={`${cs.count} customers`} note={`${formatPeso(cs.revenue)} · ${pct(cs.revenue)} of revenue`} />
            ))}
          </div>
        ) : (
          <p className="py-8 text-center text-sm text-faint">No customer data yet.</p>
        )}
      </Panel>
    </div>
  );
}
