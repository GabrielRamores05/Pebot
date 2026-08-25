'use client';

import { useState, useEffect, useCallback } from 'react';
import {
  BarChart, Bar, LineChart, Line, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
} from 'recharts';

interface OrderMetric {
  orderNumber: string;
  customerName: string;
  createdAt: string;
  completedAt: string | null;
  status: string;
  prepTimeMinutes: number;
  itemCount: number;
  isOnTime: boolean;
}

interface FulfillmentStats {
  totalOrders: number;
  completedOrders: number;
  averagePrepTimeMinutes: number;
  medianPrepTimeMinutes: number;
  onTimePercentage: number;
  completionRate: number;
  averageItemsPerOrder: number;
  peakHour: string;
  prepTimeByHour: { hour: string; avgTime: number; count: number }[];
  statusBreakdown: { status: string; count: number; percentage: number }[];
  prepTimeDistribution: { range: string; count: number }[];
  ordersPerHour: { hour: string; count: number }[];
}

const statusColors: Record<string, string> = {
  'PENDING': '#ef4444',
  'PREPARING': '#f59e0b',
  'COMPLETED': '#10b981',
  'CANCELLED': '#6b7280',
};

const COLORS = ['#10b981', '#f59e0b', '#ef4444', '#6b7280'];

export default function OrderFulfillmentMetrics() {
  const [stats, setStats] = useState<FulfillmentStats | null>(null);
  const [orders, setOrders] = useState<OrderMetric[]>([]);
  const [loading, setLoading] = useState(true);
  const [timeRange, setTimeRange] = useState<'today' | 'week' | 'month'>('today');
  const [statusFilter, setStatusFilter] = useState<'ALL' | 'COMPLETED' | 'PENDING' | 'PREPARING' | 'CANCELLED'>('ALL');

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/analytics/fulfillment?range=${timeRange}`);
      if (!res.ok) throw new Error('Failed to fetch fulfillment metrics');
      const data = await res.json();
      setStats(data.stats || null);
      setOrders(data.orders || []);
    } catch (e) {
      console.error('Failed to load fulfillment data:', e);
    } finally {
      setLoading(false);
    }
  }, [timeRange]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const filteredOrders = orders.filter(o => statusFilter === 'ALL' || o.status === statusFilter);

  if (loading || !stats) {
    return (
      <div className="flex-1 flex items-center justify-center bg-gradient-to-br from-gray-100 to-gray-200 min-h-screen">
        <div className="text-gray-500 font-medium">Loading fulfillment metrics...</div>
      </div>
    );
  }

  return (
    <div className="w-full h-auto bg-gradient-to-br from-gray-100 to-gray-200 text-gray-900 min-h-screen">
      {/* Sticky Header */}
      <div className="sticky top-0 z-30 bg-white/80 backdrop-blur-xl border-b border-gray-200/50 px-6 py-4 -mx-6 -mt-4 mb-6">
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Order Fulfillment Metrics</h1>
            <p className="text-gray-500 text-sm mt-0.5">Kitchen efficiency and order completion tracking</p>
          </div>
          <div className="flex gap-3">
            <select
              value={timeRange}
              onChange={(e) => setTimeRange(e.target.value as any)}
              className="bg-gray-100 border-0 rounded-2xl px-4 py-2.5 text-gray-700 font-medium focus:outline-none focus:ring-2 focus:ring-blue-500/30 shadow-sm"
            >
              <option value="today">Today</option>
              <option value="week">This Week</option>
              <option value="month">This Month</option>
            </select>
            <button
              onClick={fetchData}
              className="px-5 py-2.5 bg-gray-900 hover:bg-gray-800 rounded-2xl text-white text-sm font-semibold transition-all shadow-lg hover:shadow-xl"
            >
              Refresh
            </button>
          </div>
        </div>
      </div>

      <div className="p-6 space-y-6">
        {/* Key Metrics */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
          <div className="bg-white rounded-3xl p-5 border border-gray-100 shadow-sm hover:shadow-md transition-shadow">
            <div className="text-gray-500 text-sm font-medium">Total Orders</div>
            <div className="text-3xl font-bold mt-2 text-gray-900">{stats.totalOrders}</div>
            <div className="text-xs text-gray-400 mt-2">completed & pending</div>
          </div>

          <div className="bg-white rounded-3xl p-5 border border-gray-100 shadow-sm hover:shadow-md transition-shadow">
            <div className="text-gray-500 text-sm font-medium">Avg Prep Time</div>
            <div className="text-3xl font-bold mt-2 text-amber-600">{stats.averagePrepTimeMinutes.toFixed(1)}m</div>
            <div className="text-xs text-gray-400 mt-2">target: &lt; 15 min</div>
          </div>

          <div className="bg-white rounded-3xl p-5 border border-gray-100 shadow-sm hover:shadow-md transition-shadow">
            <div className="text-gray-500 text-sm font-medium">On-Time Rate</div>
            <div className={`text-3xl font-bold mt-2 ${stats.onTimePercentage >= 80 ? 'text-green-600' : 'text-yellow-600'}`}>
              {(stats.onTimePercentage).toFixed(1)}%
            </div>
            <div className="text-xs text-gray-400 mt-2">faster than avg</div>
          </div>

          <div className="bg-white rounded-3xl p-5 border border-gray-100 shadow-sm hover:shadow-md transition-shadow">
            <div className="text-gray-500 text-sm font-medium">Completion Rate</div>
            <div className={`text-3xl font-bold mt-2 ${stats.completionRate >= 90 ? 'text-green-600' : 'text-yellow-600'}`}>
              {(stats.completionRate).toFixed(1)}%
            </div>
            <div className="text-xs text-gray-400 mt-2">orders completed</div>
          </div>

          <div className="bg-white rounded-3xl p-5 border border-gray-100 shadow-sm hover:shadow-md transition-shadow">
            <div className="text-gray-500 text-sm font-medium">Peak Hour</div>
            <div className="text-3xl font-bold mt-2 text-gray-900">{stats.peakHour}</div>
            <div className="text-xs text-gray-400 mt-2">busiest time</div>
          </div>
        </div>

        {/* Charts Row 1 */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Prep Time by Hour */}
          <div className="bg-white rounded-3xl p-5 border border-gray-100 shadow-sm">
            <h3 className="text-lg font-bold mb-4 text-gray-900">Average Prep Time by Hour</h3>
            {stats.prepTimeByHour.length > 0 ? (
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={stats.prepTimeByHour}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
                  <XAxis dataKey="hour" stroke="#6b7280" />
                  <YAxis stroke="#6b7280" label={{ value: 'Minutes', angle: -90, position: 'insideLeft' }} />
                  <Tooltip
                    contentStyle={{ backgroundColor: '#ffffff', border: '1px solid #e5e7eb', borderRadius: 12, boxShadow: '0 4px 12px rgba(0,0,0,0.1)' }}
                    formatter={(value) => `${(value as number).toFixed(1)}m`}
                  />
                  <Legend />
                  <Bar dataKey="avgTime" fill="#f59e0b" name="Avg Prep Time" />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="text-gray-400 py-8 text-center">No data</div>
            )}
          </div>

          {/* Order Status Breakdown */}
          <div className="bg-white rounded-3xl p-5 border border-gray-100 shadow-sm">
            <h3 className="text-lg font-bold mb-4 text-gray-900">Order Status Breakdown</h3>
            {stats.statusBreakdown.length > 0 ? (
              <ResponsiveContainer width="100%" height={300}>
                <PieChart>
                  <Pie
  data={stats.statusBreakdown}
  dataKey="count"
  nameKey="status"
  cx="50%"
  cy="50%"
  outerRadius={100}
  label={({ index, percent }) => {
    const entry = stats.statusBreakdown[index];
    const displayPercent = percent != null ? (percent * 100).toFixed(0) : '0';
    return `${entry.status} ${displayPercent}%`;
  }}
>
  {stats.statusBreakdown.map((entry, index) => (
    <Cell key={`cell-${index}`} fill={statusColors[entry.status] || '#6b7280'} />
  ))}
</Pie>
                  <Tooltip />
                </PieChart>
              </ResponsiveContainer>
            ) : (
              <div className="text-gray-400 py-8 text-center">No data</div>
            )}
          </div>
        </div>

        {/* Charts Row 2 */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Orders Per Hour */}
          <div className="bg-white rounded-3xl p-5 border border-gray-100 shadow-sm">
            <h3 className="text-lg font-bold mb-4 text-gray-900">Order Volume by Hour</h3>
            {stats.ordersPerHour.length > 0 ? (
              <ResponsiveContainer width="100%" height={300}>
                <LineChart data={stats.ordersPerHour}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
                  <XAxis dataKey="hour" stroke="#6b7280" />
                  <YAxis stroke="#6b7280" />
                  <Tooltip contentStyle={{ backgroundColor: '#ffffff', border: '1px solid #e5e7eb', borderRadius: 12, boxShadow: '0 4px 12px rgba(0,0,0,0.1)' }} />
                  <Legend />
                  <Line type="monotone" dataKey="count" stroke="#10b981" strokeWidth={2} name="Orders" />
                </LineChart>
              </ResponsiveContainer>
            ) : (
              <div className="text-gray-400 py-8 text-center">No data</div>
            )}
          </div>

          {/* Prep Time Distribution */}
          <div className="bg-white rounded-3xl p-5 border border-gray-100 shadow-sm">
            <h3 className="text-lg font-bold mb-4 text-gray-900">Prep Time Distribution</h3>
            {stats.prepTimeDistribution.length > 0 ? (
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={stats.prepTimeDistribution}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
                  <XAxis dataKey="range" stroke="#6b7280" />
                  <YAxis stroke="#6b7280" />
                  <Tooltip contentStyle={{ backgroundColor: '#ffffff', border: '1px solid #e5e7eb', borderRadius: 12, boxShadow: '0 4px 12px rgba(0,0,0,0.1)' }} />
                  <Bar dataKey="count" fill="#6b7280" name="Orders" />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="text-gray-400 py-8 text-center">No data</div>
            )}
          </div>
        </div>

        {/* Orders Table */}
        <div className="bg-white rounded-3xl border border-gray-100 shadow-sm max-h-[500px] flex flex-col">
          <div className="p-4 border-b border-gray-100 flex gap-4 flex-shrink-0 bg-gray-50 rounded-t-3xl">
            <h3 className="text-lg font-bold flex-1">Recent Orders</h3>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value as any)}
              className="bg-gray-100 border-0 rounded-2xl px-4 py-2.5 text-gray-700 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-blue-500/30 shadow-sm"
            >
              <option value="ALL">All Status</option>
              <option value="PENDING">Pending</option>
              <option value="PREPARING">Preparing</option>
              <option value="COMPLETED">Completed</option>
              <option value="CANCELLED">Cancelled</option>
            </select>
          </div>

          {filteredOrders.length > 0 ? (
            <div className="overflow-x-auto overflow-y-auto scrollbar-thin scrollbar-thumb-gray-300 scrollbar-track-gray-100 flex-1">
              <table className="w-full text-sm">
                <thead className="bg-gray-50 border-b border-gray-200">
                  <tr>
                    <th className="px-4 py-3 text-left font-semibold text-gray-600">Order #</th>
                    <th className="px-4 py-3 text-left font-semibold text-gray-600">Customer</th>
                    <th className="px-4 py-3 text-left font-semibold text-gray-600">Status</th>
                    <th className="px-4 py-3 text-right font-semibold text-gray-600">Items</th>
                    <th className="px-4 py-3 text-right font-semibold text-gray-600">Prep Time</th>
                    <th className="px-4 py-3 text-center font-semibold text-gray-600">On-Time?</th>
                    <th className="px-4 py-3 text-left font-semibold text-gray-600">Ordered At</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredOrders.slice(0, 20).map((order) => (
                    <tr key={order.orderNumber} className="border-b border-gray-100 hover:bg-amber-50/50 transition-colors">
                      <td className="px-4 py-3 font-mono text-amber-600 font-semibold">{order.orderNumber}</td>
                      <td className="px-4 py-3">{order.customerName}</td>
                      <td className="px-4 py-3">
                        <span
                          className={`px-2.5 py-1 rounded-full text-xs font-medium ${
                            order.status === 'COMPLETED'
                              ? 'bg-green-100 text-green-700'
                              : order.status === 'PREPARING'
                                ? 'bg-yellow-100 text-yellow-700'
                                : order.status === 'PENDING'
                                  ? 'bg-red-100 text-red-700'
                                  : 'bg-gray-100 text-gray-600'
                          }`}
                        >
                          {order.status}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-right">{order.itemCount}</td>
                      <td className="px-4 py-3 text-right font-semibold text-amber-600">
                        {order.prepTimeMinutes > 0 ? `${order.prepTimeMinutes}m` : '—'}
                      </td>
                      <td className="px-4 py-3 text-center">
                        {order.prepTimeMinutes > 0 ? (
                          <span className={order.isOnTime ? 'text-green-600' : 'text-red-500'}>
                            {order.isOnTime ? '✓' : '✗'}
                          </span>
                        ) : (
                          <span className="text-gray-400">—</span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-gray-500 text-sm">
                        {new Date(order.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="p-8 text-center text-gray-400 bg-gray-50 rounded-b-3xl">No orders found</div>
          )}
        </div>
      </div>
    </div>
  );
}