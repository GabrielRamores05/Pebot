'use client';

import { useState, useEffect, useCallback } from 'react';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, Legend,
} from 'recharts';
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

const COLORS = ['#d97706', '#b45309', '#92400e', '#78350f', '#f59e0b', '#fbbf24', '#fcd34d'];
const STATUS_COLORS = ['#f59e0b', '#3b82f6', '#22c55e', '#ef4444'];

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

const tooltipStyle = { backgroundColor: '#ffffff', border: '1px solid #e5e7eb', borderRadius: 12, boxShadow: '0 4px 12px rgba(0,0,0,0.1)' };

export default function OverviewDashboard() {
  const [data, setData] = useState<AnalyticsData | null>(null);
  const [filter, setFilter] = useState('today');
  const [loading, setLoading] = useState(true);
  const [inventory, setInventory] = useState<InventorySummaryData | null>(null);
  const [inventoryLoaded, setInventoryLoaded] = useState(false);

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

  return (
    <div className="w-full h-auto bg-gradient-to-br from-gray-100 to-gray-200 text-gray-900 min-h-screen">
      {/* Header with filters - Apple Style */}
      <div className="sticky top-0 z-30 bg-white/90 backdrop-blur-xl border-b border-gray-100 px-6 py-4 flex-shrink-0 -mx-6 -mt-4 mb-4">
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div>
            <h2 className="text-xl font-bold text-gray-900">Sales Overview</h2>
            <p className="text-gray-500 text-sm mt-0.5">{getFilterSubtitle(filter)}</p>
          </div>
          {/* Segmented filter */}
          <div className="flex bg-gray-100 rounded-xl p-1 gap-0.5 flex-wrap">
            {FILTERS.map((f) => (
              <button
                key={f.key}
                onClick={() => setFilter(f.key)}
                className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-all ${
                  filter === f.key
                    ? 'bg-gray-900 text-white shadow-sm'
                    : 'text-gray-500 hover:text-gray-700'
                }`}
              >
                {f.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="p-6 space-y-4">
        {loading ? (
          <div className="flex items-center justify-center py-24 text-gray-500">Loading...</div>
        ) : (
          <>
            {/* KPI Cards */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
              {[
                { label: 'Total Sales',  value: `₱${(data?.totalSales ?? 0).toLocaleString('en-PH', { minimumFractionDigits: 2 })}`, icon: '💰', accent: 'text-amber-500' },
                { label: 'Total Orders', value: data?.totalOrders ?? 0,       icon: '📋', accent: 'text-blue-500' },
                { label: 'Completed',    value: data?.completedOrders ?? 0,   icon: '✅', accent: 'text-green-500' },
                { label: 'Avg Order',    value: `₱${(data?.avgOrderValue ?? 0).toFixed(2)}`, icon: '📈', accent: 'text-purple-500' },
              ].map((kpi) => (
                <div key={kpi.label} className="bg-white rounded-3xl p-5 border border-gray-100 shadow-sm hover:shadow-md transition-shadow">
                  <div className="flex items-center justify-between mb-2">
                    <span className={`text-2xl ${kpi.accent}`}>{kpi.icon}</span>
                  </div>
                  <p className="text-3xl font-bold tabular-nums text-gray-900">{kpi.value}</p>
                  <p className="text-gray-500 text-xs font-medium">{kpi.label}</p>
                </div>
              ))}
            </div>

            {/* Spec 014 US5 — Inventory health summary (threshold-driven) */}
            <div className="bg-white rounded-3xl p-5 border border-gray-100 shadow-sm">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-bold text-gray-900">Inventory Summary</h3>
                <span className="text-gray-400 text-xs">
                  {inventory != null ? `${inventory.totalIngredients} ingredients · thresholds` : '—'}
                </span>
              </div>
              {inventory == null && !inventoryLoaded ? (
                <p className="text-gray-400 text-sm py-2">Loading inventory health…</p>
              ) : inventory == null ? (
                <p className="text-gray-400 text-sm py-2">Inventory summary is unavailable right now.</p>
              ) : (
                <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                  <div className="bg-green-50 rounded-2xl p-4">
                    <p className="text-2xl font-bold text-green-600 tabular-nums">{inventory.healthy}</p>
                    <p className="text-gray-500 text-xs font-medium mt-0.5">Healthy</p>
                  </div>
                  <div className="bg-orange-50 rounded-2xl p-4">
                    <p className="text-2xl font-bold text-orange-500 tabular-nums">{inventory.low}</p>
                    <p className="text-gray-500 text-xs font-medium mt-0.5">Low Stock</p>
                  </div>
                  <div className="bg-red-50 rounded-2xl p-4">
                    <p className="text-2xl font-bold text-red-500 tabular-nums">{inventory.out}</p>
                    <p className="text-gray-500 text-xs font-medium mt-0.5">Out of Stock</p>
                  </div>
                  <div className="bg-amber-50 rounded-2xl p-4">
                    <p className="text-2xl font-bold text-gray-900 tabular-nums">
                      ₱{inventory.totalStockValue.toLocaleString('en-PH', { minimumFractionDigits: 2 })}
                    </p>
                    <p className="text-gray-500 text-xs font-medium mt-0.5">Total Stock Value</p>
                  </div>
                </div>
              )}
            </div>

            {/* Sales trend chart */}
            <div id="chart-sales-trend" className="bg-white rounded-3xl p-5 border border-gray-100 shadow-sm">
              <h3 className="text-lg font-bold mb-4 text-gray-900 flex items-center justify-between">
                <span>{showDailyChart ? 'Sales by Day' : 'Sales by Hour'}</span>
                <button onClick={() => downloadChart('chart-sales-trend', 'sales-trend.png')} className="text-gray-400 hover:text-gray-700 text-sm">📥 Download</button>
              </h3>
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={showDailyChart
                  ? (data?.salesByDay ?? [])
                  : (data?.salesByHour?.filter((h) => h.sales > 0) ?? [])
                }>
                  <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
                  <XAxis dataKey="label" stroke="#6b7280" tick={{ fontSize: 11 }} />
                  <YAxis stroke="#6b7280" tick={{ fontSize: 11 }} tickFormatter={(v) => `₱${v}`} />
                  <Tooltip
                    contentStyle={tooltipStyle}
                    labelStyle={{ color: '#6b7280' }}
                    formatter={(v) => [`₱${Number(v ?? 0).toFixed(2)}`, 'Sales'] as [string, string]}
                    cursor={{ fill: 'rgba(251, 191, 36, 0.1)' }}
                  />
                  <Bar dataKey="sales" fill="#d97706" radius={[4, 4, 0, 0]} maxBarSize={48} />
                </BarChart>
              </ResponsiveContainer>
            </div>

            {/* Second Row - 3 Columns */}
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
              {/* Order Status Breakdown */}
              <div id="chart-order-status" className="bg-white rounded-3xl p-5 border border-gray-100 shadow-sm">
                <h3 className="text-lg font-bold mb-4 text-gray-900 flex items-center justify-between">
                  <span>Order Status</span>
                  <button onClick={() => downloadChart('chart-order-status', 'order-status.png')} className="text-gray-400 hover:text-gray-700 text-sm">📥 Download</button>
                </h3>
                {data && (data.pendingOrders || data.preparingOrders || data.completedOrders || data.cancelledOrders) ? (
                  <>
                    <ResponsiveContainer width="100%" height={300}>
                      <PieChart>
                        <Pie
                          data={[
                            { name: 'Pending', value: data.pendingOrders || 0 },
                            { name: 'Preparing', value: data.preparingOrders || 0 },
                            { name: 'Completed', value: data.completedOrders || 0 },
                            { name: 'Cancelled', value: data.cancelledOrders || 0 },
                          ].filter(d => d.value > 0)}
                          cx="50%" cy="50%"
                          innerRadius={50}
                          outerRadius={70}
                          dataKey="value"
                          nameKey="name"
                          label={({ name, percent }) => `${((percent ?? 0) * 100).toFixed(0)}%`}
                          labelLine={false}
                        >
                          {[
                            { name: 'Pending', value: data.pendingOrders || 0 },
                            { name: 'Preparing', value: data.preparingOrders || 0 },
                            { name: 'Completed', value: data.completedOrders || 0 },
                            { name: 'Cancelled', value: data.cancelledOrders || 0 },
                          ].filter(d => d.value > 0).map((_, idx) => (
                            <Cell key={idx} fill={STATUS_COLORS[idx % STATUS_COLORS.length]} />
                          ))}
                        </Pie>
                        <Tooltip contentStyle={tooltipStyle} />
                      </PieChart>
                    </ResponsiveContainer>
                    {/* Legend */}
                    <div className="flex flex-wrap justify-center gap-4 mt-2">
                      {[
                        { name: 'Pending', color: STATUS_COLORS[0], count: data.pendingOrders || 0 },
                        { name: 'Preparing', color: STATUS_COLORS[1], count: data.preparingOrders || 0 },
                        { name: 'Completed', color: STATUS_COLORS[2], count: data.completedOrders || 0 },
                        { name: 'Cancelled', color: STATUS_COLORS[3], count: data.cancelledOrders || 0 },
                      ].filter(d => d.count > 0).map((item) => (
                        <div key={item.name} className="flex items-center gap-2">
                          <span className="w-3 h-3 rounded-full" style={{ backgroundColor: item.color }} />
                          <span className="text-sm text-gray-600">{item.name}: {item.count}</span>
                        </div>
                      ))}
                    </div>
                  </>
                ) : (
                  <div className="h-[300px] flex items-center justify-center text-gray-600 text-sm">No orders yet</div>
                )}
              </div>

              {/* Peak Hours */}
              <div id="chart-peak-hours" className="bg-white rounded-3xl p-5 border border-gray-100 shadow-sm">
                <h3 className="text-lg font-bold mb-4 text-gray-900 flex items-center justify-between">
                  <span>Peak Hours</span>
                  <button onClick={() => downloadChart('chart-peak-hours', 'peak-hours.png')} className="text-gray-400 hover:text-gray-700 text-sm">📥 Download</button>
                </h3>
                {data?.salesByHour && data.salesByHour.some(h => h.orders > 0) ? (
                  <ResponsiveContainer width="100%" height={300}>
                    <BarChart data={data.salesByHour.filter(h => h.orders > 0)}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
                      <XAxis dataKey="label" stroke="#6b7280" tick={{ fontSize: 10 }} />
                      <YAxis stroke="#6b7280" tick={{ fontSize: 10 }} width={40} />
                      <Tooltip contentStyle={tooltipStyle} formatter={(v, key) => [key === 'orders' ? v : `₱${Number(v ?? 0).toFixed(0)}`, key === 'orders' ? 'Orders' : 'Sales'] as [string, string]} />
                      <Bar dataKey="orders" fill="#3b82f6" radius={[2, 2, 0, 0]} maxBarSize={24} />
                    </BarChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="h-[300px] flex items-center justify-center text-gray-600 text-sm">No data yet</div>
                )}
              </div>

              {/* Sales by Category */}
              <div id="chart-sales-category" className="bg-white rounded-3xl p-5 border border-gray-100 shadow-sm">
                <h3 className="text-lg font-bold mb-4 text-gray-900 flex items-center justify-between">
                  <span>Sales by Category</span>
                  <button onClick={() => downloadChart('chart-sales-category', 'sales-by-category.png')} className="text-gray-400 hover:text-gray-700 text-sm">📥 Download</button>
                </h3>
                {data?.salesByCategory && data.salesByCategory.length > 0 ? (
                  <ResponsiveContainer width="100%" height={300}>
                    <PieChart>
                      <Pie
                        data={data.salesByCategory}
                        cx="50%" cy="50%"
                        outerRadius={80}
                        dataKey="sales"
                        nameKey="name"
                        label={({ name, percent }) => `${name} ${((percent ?? 0) * 100).toFixed(0)}%`}
                        labelLine={false}
                      >
                        {data.salesByCategory.map((_, idx) => (
                          <Cell key={idx} fill={COLORS[idx % COLORS.length]} />
                        ))}
                      </Pie>
                      <Tooltip contentStyle={tooltipStyle} formatter={(v) => [`₱${Number(v ?? 0).toFixed(2)}`, 'Sales'] as [string, string]} />
                      <Legend />
                    </PieChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="h-[300px] flex items-center justify-center text-gray-600 text-sm">No data yet</div>
                )}
              </div>
            </div>

            {/* Third Row - Top Items */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Top Items */}
              <div id="chart-top-items" className="bg-white rounded-3xl p-5 border border-gray-100 shadow-sm lg:col-span-2">
                <h3 className="text-lg font-bold mb-4 text-gray-900 flex items-center justify-between">
                  <span>Top Selling Items</span>
                  <button onClick={() => downloadChart('chart-top-items', 'top-selling-items.png')} className="text-gray-400 hover:text-gray-700 text-sm">📥 Download</button>
                </h3>
                {data?.topItems && data.topItems.length > 0 ? (
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {data.topItems.slice(0, 6).map((item, idx) => {
                      const maxCount = data.topItems[0]?.count ?? 1;
                      const pct = (item.count / maxCount) * 100;
                      return (
                        <div key={item.name} className="flex items-center gap-3 p-3 bg-gray-50 rounded-xl">
                          <span className="text-gray-400 w-6 h-6 flex items-center justify-center bg-white rounded-full text-xs font-bold">{idx + 1}</span>
                          <div className="flex-1 min-w-0">
                            <div className="flex justify-between text-sm mb-1 gap-2">
                              <span className="text-gray-900 font-medium truncate">{item.name}</span>
                            </div>
                            <div className="flex justify-between items-center">
                              <div className="flex-1 mr-3">
                                <div className="h-2 bg-gray-200 rounded-full overflow-hidden">
                                  <div className="h-full bg-amber-500 rounded-full transition-all" style={{ width: `${pct}%` }} />
                                </div>
                              </div>
                              <div className="flex gap-3 shrink-0">
                                <span className="text-gray-500 text-xs">{item.count}×</span>
                                <span className="text-amber-600 text-xs font-semibold">₱{item.revenue.toFixed(0)}</span>
                              </div>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <div className="text-center py-8 text-gray-500 text-sm">No orders completed yet</div>
                )}
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
