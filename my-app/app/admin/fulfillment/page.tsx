'use client';

import { useState, useEffect, useCallback } from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { BarList, CHART, Loading, Panel, Pill, Segmented, StatTile } from '@/components/pebot-ui';

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


const STATUS_LABEL: Record<string, string> = { PENDING: 'Waiting', PREPARING: 'Preparing', COMPLETED: 'Completed', CANCELLED: 'Cancelled' };
const STATUS_TONE: Record<string, 'warn' | 'accent' | 'good' | 'plain'> = { PENDING: 'warn', PREPARING: 'accent', COMPLETED: 'good', CANCELLED: 'plain' };

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

  if (loading || !stats) return <Loading label="Loading kitchen performance…" />;

  const miniChart = (data: object[], x: string, y: string, unit: (v: number) => string, color: string) => (
    <ResponsiveContainer width="100%" height={240}>
      <BarChart data={data} margin={{ left: 0, right: 0, top: 4 }}>
        <CartesianGrid vertical={false} stroke={CHART.grid} />
        <XAxis dataKey={x} stroke={CHART.axis} tickLine={false} axisLine={false} tick={{ fontSize: 11 }} />
        <YAxis stroke={CHART.axis} tickLine={false} axisLine={false} tick={{ fontSize: 11 }} width={36} />
        <Tooltip contentStyle={CHART.tooltip} cursor={{ fill: 'rgba(180,71,42,0.06)' }} formatter={(v) => [unit(Number(v ?? 0)), ''] as [string, string]} />
        <Bar dataKey={y} fill={color} radius={[6, 6, 0, 0]} maxBarSize={36} />
      </BarChart>
    </ResponsiveContainer>
  );
  const none = <div className="flex h-[240px] items-center justify-center text-sm text-faint">No orders in this period yet.</div>;

  return (
    <div className="space-y-4 px-6 pb-8">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-muted">How fast the kitchen turns orders around.</p>
        <div className="flex items-center gap-2">
          <Segmented
            value={timeRange}
            onChange={setTimeRange}
            options={[{ key: 'today', label: 'Today' }, { key: 'week', label: 'This week' }, { key: 'month', label: 'This month' }]}
          />
          <button onClick={fetchData} className="c-btn c-btn--ghost">Refresh</button>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-5">
        <StatTile tone="plain" label="Orders" value={stats.totalOrders} note="All statuses" />
        <StatTile tone={stats.averagePrepTimeMinutes <= 15 ? 'sage' : 'sand'} label="Average prep time" value={`${stats.averagePrepTimeMinutes.toFixed(1)} min`} note="Target under 15 min" />
        <StatTile tone={stats.onTimePercentage >= 80 ? 'sage' : 'sand'} label="On time" value={`${stats.onTimePercentage.toFixed(1)}%`} note="Faster than average" />
        <StatTile tone={stats.completionRate >= 90 ? 'sage' : 'sand'} label="Completed" value={`${stats.completionRate.toFixed(1)}%`} note="Of all orders" />
        <StatTile tone="peach" label="Busiest hour" value={stats.peakHour} note={`${stats.averageItemsPerOrder.toFixed(1)} items per order`} />
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Panel title="Average prep time by hour" subtitle="Minutes from order to ready">
          {stats.prepTimeByHour.length > 0 ? miniChart(stats.prepTimeByHour, 'hour', 'avgTime', (v) => `${v.toFixed(1)} min`, CHART.accent) : none}
        </Panel>
        <Panel title="Orders by hour">
          {stats.ordersPerHour.length > 0 ? miniChart(stats.ordersPerHour, 'hour', 'count', (v) => `${v} orders`, CHART.second) : none}
        </Panel>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Panel title="Prep time spread" subtitle="How many orders took how long">
          <BarList
            color="bg-[#2F5B9A]"
            empty="No completed orders yet."
            rows={stats.prepTimeDistribution.map((d) => ({ key: d.range, label: d.range, value: d.count, display: <span className="font-semibold text-ink">{d.count}</span> }))}
          />
        </Panel>
        <Panel title="Order status">
          <BarList
            empty="No orders yet."
            rows={stats.statusBreakdown.map((d) => ({ key: d.status, label: STATUS_LABEL[d.status] ?? d.status, value: d.count, display: <>{(d.percentage <= 1 ? d.percentage * 100 : d.percentage).toFixed(0)}% · <span className="font-semibold text-ink">{d.count}</span></> }))}
          />
        </Panel>
      </div>

      <Panel
        padded={false}
        title="Recent orders"
        subtitle="Latest 20"
        actions={
          <Segmented
            size="sm"
            value={statusFilter}
            onChange={setStatusFilter}
            options={[
              { key: 'ALL', label: 'All' },
              { key: 'PENDING', label: 'Waiting' },
              { key: 'PREPARING', label: 'Preparing' },
              { key: 'COMPLETED', label: 'Completed' },
              { key: 'CANCELLED', label: 'Cancelled' },
            ]}
          />
        }
      >
        {filteredOrders.length > 0 ? (
          <div className="max-h-[480px] overflow-auto">
            <table className="c-table">
              <thead>
                <tr>
                  <th>Order</th>
                  <th>Customer</th>
                  <th>Status</th>
                  <th className="c-num">Items</th>
                  <th className="c-num">Prep time</th>
                  <th>On time</th>
                  <th>Ordered</th>
                </tr>
              </thead>
              <tbody>
                {filteredOrders.slice(0, 20).map((order) => (
                  <tr key={order.orderNumber} className="hover:bg-page">
                    <td className="font-semibold tabular-nums">{order.orderNumber}</td>
                    <td>{order.customerName}</td>
                    <td><Pill tone={STATUS_TONE[order.status] ?? 'plain'}>{STATUS_LABEL[order.status] ?? order.status}</Pill></td>
                    <td className="c-num">{order.itemCount}</td>
                    <td className="c-num font-semibold">{order.prepTimeMinutes > 0 ? `${order.prepTimeMinutes} min` : '—'}</td>
                    <td>{order.prepTimeMinutes > 0 ? <Pill tone={order.isOnTime ? 'good' : 'danger'}>{order.isOnTime ? 'On time' : 'Slow'}</Pill> : <span className="text-faint">—</span>}</td>
                    <td className="text-muted">{new Date(order.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="px-5 pb-8 pt-2 text-center text-sm text-faint">No orders match.</p>
        )}
      </Panel>
    </div>
  );
}
