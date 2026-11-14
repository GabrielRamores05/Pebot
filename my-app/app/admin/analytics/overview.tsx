'use client';

import { useState, useEffect, useCallback } from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { formatPeso } from '@/lib/format';
import { useSocket } from '@/hooks/useSocket';
import html2canvas from 'html2canvas';

interface AnalyticsData {
  totalSales: number;
  totalOrders: number;
  completedOrders: number;
  pendingOrders: number;
  preparingOrders: number;
  cancelledOrders: number;
  avgOrderValue: number;
  topItems: { name: string; count: number; revenue: number }[];
  salesByHour: { hour: number; label: string; sales: number; orders: number }[];
  salesByDay: { date: string; label: string; sales: number }[];
  salesByCategory: { name: string; sales: number }[];
}

// Spec 014 US5 — inventory health derived from the same low/out rule as the
// ingredient page: healthy = stock > min; low = 0 < stock <= min; out = stock <= 0.
interface InventorySummaryData {
  totalIngredients: number;
  healthy: number;
  low: number;
  out: number;
  totalStockValue: number;
}

const ACCENT = '#B4472A';
const GRID = '#E7E1D8';
const AXIS = '#7B7369';

const FILTERS = [
  { key: 'today',     label: 'Today' },
  { key: 'yesterday', label: 'Yesterday' },
  { key: 'week',      label: '7 Days' },
  { key: 'month',     label: 'This Month' },
  { key: 'year',      label: 'This Year' },
];

function getFilterSubtitle(filter: string): string {
  const now = new Date();
  if (filter === 'today')     return now.toLocaleDateString([], { weekday: 'long', month: 'long', day: 'numeric' });
  if (filter === 'yesterday') {
    const y = new Date(now); y.setDate(now.getDate() - 1);
    return y.toLocaleDateString([], { weekday: 'long', month: 'long', day: 'numeric' });
  }
  if (filter === 'week') {
    const s = new Date(now); s.setDate(now.getDate() - 6);
    return `${s.toLocaleDateString([], { month: 'short', day: 'numeric' })} – ${now.toLocaleDateString([], { month: 'short', day: 'numeric' })}`;
  }
  if (filter === 'month') return now.toLocaleDateString([], { month: 'long', year: 'numeric' });
  if (filter === 'year')  return `Jan – Dec ${now.getFullYear()}`;
  return '';
}

const tooltipStyle = { backgroundColor: '#FFFDFA', border: '1px solid #E7E1D8', borderRadius: 12, boxShadow: '0 12px 30px -16px rgba(45,30,20,0.35)' };

export default function OverviewDashboard() {
  const [data, setData] = useState<AnalyticsData | null>(null);
  const [filter, setFilter] = useState('today');
  const [loading, setLoading] = useState(true);
  const [inventory, setInventory] = useState<InventorySummaryData | null>(null);
  const [inventoryLoaded, setInventoryLoaded] = useState(false);
  const [measure, setMeasure] = useState<'sales' | 'orders'>('sales');

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/analytics?filter=${filter}`);
      const json = await res.json();
      setData(json);
    } catch (e) {
      console.error('Failed to load analytics:', e);
    } finally {
      setLoading(false);
    }
  }, [filter]);

  // Spec 014 US5 — inventory summary is separate from the sales numbers so a
  // threshold change or purchase refreshes it without re-running the sales
  // charts. Refetched on stock events so every surface flips at once.
  const fetchInventorySummary = useCallback(async () => {
    try {
      const res = await fetch('/api/analytics/inventory');
      if (res.ok) setInventory(await res.json());
      else setInventory(null);
    } catch (e) {
      console.error('Failed to load inventory summary:', e);
      setInventory(null);
    } finally {
      setInventoryLoaded(true);
    }
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);
  useEffect(() => { fetchInventorySummary(); }, [fetchInventorySummary]);

  useSocket({
    events: {
      'ingredients-update': fetchInventorySummary,
      'inventory-update': fetchInventorySummary,
      'low-stock-alert': fetchInventorySummary,
    },
  });

  // Only refresh on filter change, not on socket events (to prevent excessive API calls)
  // useSocket({ events: { 'analytics-update': () => { fetchData(); } } });

  async function downloadChart(elementId: string, filename: string) {
    try {
      const el = document.getElementById(elementId);
    if (!el) return;
    const canvas = await html2canvas(el, { scale: 2, backgroundColor: '#ffffff' });
    const link = document.createElement('a');
    link.download = filename;
    link.href = canvas.toDataURL('image/png');
    link.click()
    } catch (err) {
      console.error('Download failed: ' + err)
      alert('Download failed. Try again or contact support.')
    };
  }

  const showDailyChart = filter === 'week' || filter === 'month' || filter === 'year';
  const chartData = showDailyChart
    ? (data?.salesByDay ?? [])
    : (data?.salesByHour ?? []).filter((h) => h.sales > 0 || h.orders > 0);
  const chartKey = showDailyChart ? 'sales' : measure;
  const statusRows = [
    { name: 'Waiting', value: data?.pendingOrders ?? 0, color: 'bg-[#C9A35B]' },
    { name: 'Preparing', value: data?.preparingOrders ?? 0, color: 'bg-accent' },
    { name: 'Completed', value: data?.completedOrders ?? 0, color: 'bg-good' },
    { name: 'Cancelled', value: data?.cancelledOrders ?? 0, color: 'bg-hair-strong' },
  ];
  const statusTotal = statusRows.reduce((n, r) => n + r.value, 0);
  const categoryTotal = (data?.salesByCategory ?? []).reduce((n, c) => n + c.sales, 0);
  const saveBtn = (id: string, name: string) => (
    <button onClick={() => downloadChart(id, name)} className="text-xs font-semibold text-faint hover:text-ink" title="Save as image">
      Save image
    </button>
  );

  return (
    <div className="space-y-4 px-6 pb-8">
      {/* Period */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-muted">{getFilterSubtitle(filter)}</p>
        <div className="flex flex-wrap rounded-xl bg-panel p-1">
          {FILTERS.map((f) => (
            <button
              key={f.key}
              onClick={() => setFilter(f.key)}
              className={`h-9 rounded-[10px] px-3.5 text-[13px] font-semibold transition ${filter === f.key ? 'bg-card text-ink shadow-card' : 'text-muted hover:text-ink'}`}
            >
              {f.label}
            </button>
          ))}
        </div>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-24 text-sm text-faint">Loading…</div>
      ) : (
        <>
          {/* Headline tiles */}
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            {[
              { label: 'Sales', value: formatPeso(data?.totalSales ?? 0), note: `From ${data?.completedOrders ?? 0} completed orders`, tile: 'bg-tile-peach' },
              { label: 'Orders', value: String(data?.totalOrders ?? 0), note: `All placed · ${data?.cancelledOrders ?? 0} cancelled`, tile: 'bg-tile-sage' },
              { label: 'Average order', value: formatPeso(data?.avgOrderValue ?? 0), note: 'Per completed order', tile: 'bg-tile-sand' },
              { label: 'Completed', value: String(data?.completedOrders ?? 0), note: `${(data?.pendingOrders ?? 0) + (data?.preparingOrders ?? 0)} still open`, tile: 'bg-tile-sky' },
            ].map((t) => (
              <div key={t.label} className={`rounded-[20px] px-5 py-4 ${t.tile}`}>
                <p className="text-[13px] font-semibold text-muted">{t.label}</p>
                <p className="mt-1 truncate text-[28px] font-bold leading-tight tabular-nums tracking-[-0.03em]">{t.value}</p>
                <p className="text-xs text-muted">{t.note}</p>
              </div>
            ))}
          </div>

          <div className="grid gap-4 xl:grid-cols-3">
            {/* Sales chart */}
            <section id="chart-sales-trend" className="c-card p-5 xl:col-span-2">
              <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
                <div>
                  <h3 className="text-base font-bold">{showDailyChart ? 'Sales by day' : measure === 'sales' ? 'Sales by hour' : 'Orders by hour'}</h3>
                  <p className="text-xs text-faint">{showDailyChart ? 'Each day in the period' : 'Busy hours at a glance'}</p>
                </div>
                <div className="flex items-center gap-3">
                  {!showDailyChart && (
                    <div className="flex rounded-[10px] bg-panel p-0.5">
                      {(['sales', 'orders'] as const).map((m) => (
                        <button
                          key={m}
                          onClick={() => setMeasure(m)}
                          className={`h-8 rounded-[8px] px-3 text-xs font-semibold ${measure === m ? 'bg-card text-ink shadow-card' : 'text-muted'}`}
                        >
                          {m === 'sales' ? 'Sales' : 'Orders'}
                        </button>
                      ))}
                    </div>
                  )}
                  {saveBtn('chart-sales-trend', 'sales-trend.png')}
                </div>
              </div>
              {chartData.length > 0 ? (
                <ResponsiveContainer width="100%" height={280}>
                  <BarChart data={chartData} margin={{ left: 0, right: 0, top: 4 }}>
                    <CartesianGrid vertical={false} stroke={GRID} />
                    <XAxis dataKey="label" stroke={AXIS} tickLine={false} axisLine={false} tick={{ fontSize: 11 }} />
                    <YAxis stroke={AXIS} tickLine={false} axisLine={false} tick={{ fontSize: 11 }} width={56}
                      tickFormatter={(v) => (chartKey === 'orders' ? String(v) : `₱${Number(v).toLocaleString('en-PH')}`)} />
                    <Tooltip
                      contentStyle={tooltipStyle}
                      labelStyle={{ color: AXIS }}
                      cursor={{ fill: 'rgba(180, 71, 42, 0.06)' }}
                      formatter={(v) => (chartKey === 'orders' ? [String(v), 'Orders'] : [formatPeso(Number(v ?? 0)), 'Sales']) as [string, string]}
                    />
                    <Bar dataKey={chartKey} fill={ACCENT} radius={[6, 6, 0, 0]} maxBarSize={44} />
                  </BarChart>
                </ResponsiveContainer>
              ) : (
                <div className="flex h-[280px] items-center justify-center text-sm text-faint">No sales in this period yet.</div>
              )}
            </section>

            {/* Right column */}
            <div className="space-y-4">
              <section id="chart-order-status" className="c-card p-5">
                <div className="mb-3 flex items-center justify-between">
                  <h3 className="text-base font-bold">Order status</h3>
                  {saveBtn('chart-order-status', 'order-status.png')}
                </div>
                {statusTotal > 0 ? (
                  <>
                    <div className="mb-3 flex h-2.5 overflow-hidden rounded-full bg-panel">
                      {statusRows.filter((r) => r.value > 0).map((r) => (
                        <div key={r.name} className={r.color} style={{ width: `${(r.value / statusTotal) * 100}%` }} />
                      ))}
                    </div>
                    <ul className="space-y-1.5 text-sm">
                      {statusRows.map((r) => (
                        <li key={r.name} className="flex items-center gap-2">
                          <span className={`h-2 w-2 rounded-full ${r.color}`} />
                          <span className="flex-1 text-muted">{r.name}</span>
                          <span className="font-semibold tabular-nums">{r.value}</span>
                        </li>
                      ))}
                    </ul>
                  </>
                ) : (
                  <p className="py-4 text-sm text-faint">No orders yet.</p>
                )}
              </section>

              <section className="c-card p-5">
                <div className="mb-3 flex items-center justify-between">
                  <h3 className="text-base font-bold">Stock health</h3>
                  <span className="text-xs text-faint">{inventory != null ? `${inventory.totalIngredients} ingredients` : ''}</span>
                </div>
                {inventory == null && !inventoryLoaded ? (
                  <p className="text-sm text-faint">Loading…</p>
                ) : inventory == null ? (
                  <p className="text-sm text-faint">Stock summary is unavailable right now.</p>
                ) : (
                  <div className="grid grid-cols-3 gap-2">
                    {[
                      { label: 'Healthy', value: inventory.healthy, tile: 'bg-tile-sage text-good' },
                      { label: 'Low', value: inventory.low, tile: 'bg-tile-sand text-warn' },
                      { label: 'Out', value: inventory.out, tile: inventory.out > 0 ? 'bg-danger-bg text-danger' : 'bg-panel text-muted' },
                    ].map((t) => (
                      <div key={t.label} className={`rounded-[14px] px-3 py-2.5 ${t.tile}`}>
                        <p className="text-xl font-bold tabular-nums">{t.value}</p>
                        <p className="text-xs font-semibold opacity-80">{t.label}</p>
                      </div>
                    ))}
                    <div className="col-span-3 flex items-center justify-between rounded-[14px] bg-panel px-3 py-2.5 text-sm">
                      <span className="text-muted">Stock value</span>
                      <span className="font-bold tabular-nums">{formatPeso(inventory.totalStockValue)}</span>
                    </div>
                  </div>
                )}
              </section>
            </div>
          </div>

          <div className="grid gap-4 xl:grid-cols-3">
            {/* Best sellers */}
            <section id="chart-top-items" className="c-card p-5 xl:col-span-2">
              <div className="mb-3 flex items-center justify-between">
                <div>
                  <h3 className="text-base font-bold">Best sellers</h3>
                  <p className="text-xs text-faint">By pieces sold</p>
                </div>
                {saveBtn('chart-top-items', 'top-selling-items.png')}
              </div>
              {data?.topItems && data.topItems.length > 0 ? (
                <ol className="grid gap-x-8 gap-y-3 md:grid-cols-2">
                  {data.topItems.slice(0, 8).map((item, idx) => {
                    const pct = (item.count / (data.topItems[0]?.count || 1)) * 100;
                    return (
                      <li key={item.name} className="flex items-center gap-3">
                        <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-panel text-xs font-bold tabular-nums text-muted">{idx + 1}</span>
                        <div className="min-w-0 flex-1">
                          <div className="flex items-baseline justify-between gap-2 text-sm">
                            <span className="truncate font-semibold">{item.name}</span>
                            <span className="shrink-0 tabular-nums text-muted">{item.count}× · <span className="font-semibold text-ink">{formatPeso(item.revenue)}</span></span>
                          </div>
                          <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-panel">
                            <div className="h-full rounded-full bg-accent" style={{ width: `${pct}%` }} />
                          </div>
                        </div>
                      </li>
                    );
                  })}
                </ol>
              ) : (
                <p className="py-6 text-center text-sm text-faint">No sales in this period yet.</p>
              )}
            </section>

            {/* Categories */}
            <section id="chart-sales-category" className="c-card p-5">
              <div className="mb-3 flex items-center justify-between">
                <h3 className="text-base font-bold">Sales by category</h3>
                {saveBtn('chart-sales-category', 'sales-by-category.png')}
              </div>
              {data?.salesByCategory && data.salesByCategory.length > 0 ? (
                <ul className="space-y-3">
                  {[...data.salesByCategory].sort((a, b) => b.sales - a.sales).map((c) => {
                    const pct = categoryTotal > 0 ? (c.sales / categoryTotal) * 100 : 0;
                    return (
                      <li key={c.name}>
                        <div className="flex items-baseline justify-between gap-2 text-sm">
                          <span className="truncate font-semibold">{c.name}</span>
                          <span className="shrink-0 tabular-nums text-muted">{pct.toFixed(0)}% · <span className="font-semibold text-ink">{formatPeso(c.sales)}</span></span>
                        </div>
                        <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-panel">
                          <div className="h-full rounded-full bg-[#C9A35B]" style={{ width: `${pct}%` }} />
                        </div>
                      </li>
                    );
                  })}
                </ul>
              ) : (
                <p className="py-6 text-center text-sm text-faint">No sales in this period yet.</p>
              )}
            </section>
          </div>
        </>
      )}
    </div>
  );
}
