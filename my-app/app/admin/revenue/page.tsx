'use client';

import { useState, useEffect, useCallback } from 'react';
import {
  LineChart, Line, BarChart, Bar, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
} from 'recharts';
import { useSocket } from '@/hooks/useSocket';
import { formatPeso } from '@/lib/format';

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

const COLORS = ['#d97706', '#b45309', '#92400e', '#78350f', '#f59e0b', '#fbbf24'];

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

  if (loading || !data) {
    return (
      <div className="flex-1 flex items-center justify-center bg-white min-h-screen">
        <div className="text-slate-400 font-medium">Loading revenue data...</div>
      </div>
    );
  }

  // Calculate growth
  const revenueGrowth = previousData 
    ? ((data.totalRevenue - previousData.totalRevenue) / previousData.totalRevenue) 
    : 0;
  const orderGrowth = previousData 
    ? ((data.totalOrders - previousData.totalOrders) / previousData.totalOrders) 
    : 0;

  return (
    <div className="w-full h-auto bg-slate-50 text-slate-900">
      {/* Sticky Header */}
      <div className="sticky top-0 z-10 bg-white/90 backdrop-blur-xl border-b border-slate-200/50 px-6 py-4 shadow-sm">
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div>
            <h1 className="text-2xl font-semibold text-slate-900">Revenue</h1>
            <p className="text-slate-500 text-sm mt-0.5">{getFilterLabel(filter)}</p>
          </div>
          {/* Filter buttons */}
          <div className="flex bg-slate-100 rounded-xl p-1 gap-0.5 flex-wrap">
            {FILTERS.map((f) => (
              <button
                key={f.key}
                onClick={() => setFilter(f.key)}
                className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                  filter === f.key
                    ? 'bg-slate-900 text-white shadow-lg'
                    : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200'
                }`}
              >
                {f.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="p-6 space-y-6">
        {/* KPI Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {/* Total Revenue */}
          <div className="bg-white rounded-2xl p-6 border border-slate-200 shadow-sm hover:shadow-lg transition-all duration-300 hover:-translate-y-1">
            <div className="text-slate-500 text-sm font-medium">Total Revenue</div>
            <div className="text-3xl font-bold mt-2 text-slate-900">{formatPeso(data.totalRevenue)}</div>
            {revenueGrowth !== 0 && (
              <div className={`text-sm mt-2 ${revenueGrowth > 0 ? 'text-emerald-600' : 'text-red-500'}`}>
                {revenueGrowth > 0 ? '↑' : '↓'} {formatPercent(Math.abs(revenueGrowth))} vs previous
              </div>
            )}
          </div>

          {/* Average Order Value */}
          <div className="bg-white rounded-2xl p-6 border border-slate-200 shadow-sm hover:shadow-lg transition-all duration-300 hover:-translate-y-1">
            <div className="text-slate-500 text-sm font-medium">Avg Order Value</div>
            <div className="text-3xl font-bold mt-2 text-slate-900">{formatPeso(data.averageOrderValue)}</div>
            <div className="text-sm text-slate-400 mt-2">{data.totalOrders} orders</div>
          </div>

          {/* Total Orders */}
          <div className="bg-white rounded-2xl p-6 border border-slate-200 shadow-sm hover:shadow-lg transition-all duration-300 hover:-translate-y-1">
            <div className="text-slate-500 text-sm font-medium">Total Orders</div>
            <div className="text-3xl font-bold mt-2 text-slate-900">{data.totalOrders}</div>
            {orderGrowth !== 0 && (
              <div className={`text-sm mt-2 ${orderGrowth > 0 ? 'text-green-600' : 'text-red-500'}`}>
                {orderGrowth > 0 ? '↑' : '↓'} {formatPercent(Math.abs(orderGrowth))} vs previous
              </div>
            )}
          </div>

          {/* Loyalty Impact */}
          <div className="bg-white rounded-2xl p-5 border border-slate-100 shadow-sm hover:shadow-md transition-shadow">
            <div className="text-slate-500 text-sm font-medium">Loyalty Discount Impact</div>
            <div className="text-3xl font-bold mt-2 text-orange-600">{formatPeso(data.loyaltyRevenueImpact)}</div>
            <div className="text-sm text-slate-400 mt-2">Discounts given</div>
          </div>
        </div>

        {/* Charts Row 1 */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Revenue Trend */}
          <div className="bg-white rounded-2xl p-5 border border-slate-100 shadow-sm">
            <h3 className="text-lg font-semibold mb-4 text-slate-700">Revenue Trend</h3>
            <ResponsiveContainer width="100%" height={300}>
              <LineChart data={data.revenueByDay}>
                <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
                <XAxis dataKey="date" stroke="#6b7280" />
                <YAxis stroke="#6b7280" />
                <Tooltip 
                  contentStyle={{ backgroundColor: '#ffffff', border: '1px solid #e5e7eb', borderRadius: 12, boxShadow: '0 4px 12px rgba(0,0,0,0.1)' }}
                  formatter={(value) => formatPeso(value as number)}
                />
                <Legend />
                <Line type="monotone" dataKey="revenue" stroke="#10b981" name="Revenue" strokeWidth={2} />
                <Line type="monotone" dataKey="orders" stroke="#f59e0b" name="Orders" strokeWidth={2} />
              </LineChart>
            </ResponsiveContainer>
          </div>

          {/* Payment Methods */}
          <div className="bg-white rounded-2xl p-5 border border-slate-100 shadow-sm">
            <h3 className="text-lg font-semibold mb-4 text-slate-700">Payment Methods</h3>
            {data.paymentMethods.length > 0 ? (
              <div className="space-y-3">
                {data.paymentMethods.map((pm) => (
                  <div key={pm.method} className="flex items-center justify-between p-3 bg-slate-50 rounded">
                    <div>
                      <div className="font-medium text-slate-900">{pm.method}</div>
                      <div className="text-sm text-slate-500">{pm.count} transactions</div>
                    </div>
                    <div className="text-right">
                      <div className="font-bold text-slate-900">{formatPeso(pm.amount)}</div>
                      <div className="text-sm text-slate-500">
                        {((pm.amount / data.totalRevenue) * 100).toFixed(1)}%
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-slate-400 py-8 text-center">No payment data</div>
            )}
          </div>
        </div>

        {/* Charts Row 2 */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Revenue by Category */}
          <div className="bg-white rounded-2xl p-5 border border-slate-100 shadow-sm">
            <h3 className="text-lg font-semibold mb-4 text-slate-700">Revenue by Category</h3>
            {data.revenueByCategory.length > 0 ? (
              <ResponsiveContainer width="100%" height={300}>
                <PieChart>
                  <Pie
                    data={data.revenueByCategory}
                    dataKey="revenue"
                    nameKey="category"
                    cx="50%"
                    cy="50%"
                    outerRadius={100}
                    label={({ name, percent }) => `${name} ${((percent || 0) * 100).toFixed(0)}%`}
                  >
                    {data.revenueByCategory.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip formatter={(value) => formatPeso(value as number)} />
                </PieChart>
              </ResponsiveContainer>
            ) : (
              <div className="text-slate-400 py-8 text-center">No category data</div>
            )}
          </div>

          {/* Top Products by Revenue */}
          <div className="bg-white rounded-2xl p-5 border border-slate-100 shadow-sm">
            <h3 className="text-lg font-semibold mb-4 text-slate-700">Top Products by Revenue</h3>
            {data.topProductsByRevenue.length > 0 ? (
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={data.topProductsByRevenue}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
                  <XAxis dataKey="name" stroke="#6b7280" angle={-45} textAnchor="end" height={80} />
                  <YAxis stroke="#6b7280" />
                  <Tooltip 
                    contentStyle={{ backgroundColor: '#1f2937', border: '1px solid #374151', borderRadius: 8 }}
                    formatter={(value) => formatPeso(value as number)}
                  />
                  <Bar dataKey="revenue" fill="#f59e0b" name="Revenue" />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="text-slate-400 py-8 text-center">No product data</div>
            )}
          </div>
        </div>

        {/* Customer Spending Distribution */}
        <div className="bg-white rounded-2xl p-5 border border-slate-100 shadow-sm">
          <h3 className="text-lg font-semibold mb-4 text-slate-700">Customer Spending Distribution</h3>
          {data.customerSpending.length > 0 ? (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {data.customerSpending.map((cs) => (
                <div key={cs.percentile} className="p-3 bg-slate-50 rounded">
                  <div className="font-medium text-sm text-slate-600">{cs.percentile}</div>
                  <div className="text-2xl font-bold mt-1 text-slate-900">{cs.count}</div>
                  <div className="text-sm text-slate-500 mt-1">{formatPeso(cs.revenue)} ({formatPercent(cs.revenue / data.totalRevenue)})</div>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-slate-400 py-8 text-center">No customer data</div>
          )}
        </div>
      </div>
    </div>
  );
}
