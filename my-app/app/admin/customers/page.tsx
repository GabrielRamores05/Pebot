'use client';

import { useState, useEffect, useCallback } from 'react';
import {
  BarChart, Bar, PieChart, Pie, Cell, XAxis, YAxis, 
  CartesianGrid, Tooltip, Legend, ResponsiveContainer,
} from 'recharts';

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
  VIP: { color: '#f59e0b', label: '⭐ VIP', bg: 'bg-amber-100', text: 'text-amber-700' },
  REGULAR: { color: '#10b981', label: '✓ Regular', bg: 'bg-emerald-100', text: 'text-emerald-700' },
  CASUAL: { color: '#6b7280', label: '○ Casual', bg: 'bg-slate-100', text: 'text-slate-600' },
  AT_RISK: { color: '#ef4444', label: '⚠ At Risk', bg: 'bg-red-100', text: 'text-red-700' },
};

const COLORS = ['#f59e0b', '#10b981', '#6b7280', '#ef4444'];

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

  if (loading || !stats) {
    return (
      <div className="flex-1 flex items-center justify-center bg-white">
        <div className="text-slate-400">Loading customer data...</div>
      </div>
    );
  }

  return (
    <div className="w-full h-auto bg-slate-50 text-slate-900 min-h-screen">
      {/* Sticky Header - Apple Style */}
      <div className="sticky top-0 z-30 bg-white/80 backdrop-blur-xl border-b border-gray-200/50 px-6 py-4 -mx-6 -mt-4 mb-6">
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div>
            <h1 className="text-2xl font-bold text-slate-900">Customer Loyalty Tiers</h1>
            <p className="text-slate-500 text-sm mt-0.5">Track and segment customers by engagement and value</p>
          </div>
          <button
            onClick={fetchData}
            className="px-5 py-2.5 bg-slate-900 hover:bg-slate-800 rounded-2xl text-white text-sm font-semibold transition-all shadow-lg hover:shadow-xl"
          >
            Refresh
          </button>
        </div>
      </div>

      <div className="p-6 space-y-6">
        {/* Tier Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
          <div className="bg-white rounded-xl p-5 border border-slate-200 shadow-sm">
            <div className="text-slate-500 text-sm font-medium">VIP Customers</div>
            <div className="text-3xl font-bold mt-2 text-amber-600">{stats.vipCount}</div>
            <div className="text-xs text-slate-400 mt-2">Top spenders</div>
          </div>

          <div className="bg-white rounded-xl p-5 border border-slate-200 shadow-sm">
            <div className="text-slate-500 text-sm font-medium">Regular</div>
            <div className="text-3xl font-bold mt-2 text-emerald-600">{stats.regularCount}</div>
            <div className="text-xs text-slate-400 mt-2">Consistent visitors</div>
          </div>

          <div className="bg-white rounded-xl p-5 border border-slate-200 shadow-sm">
            <div className="text-slate-500 text-sm font-medium">Casual</div>
            <div className="text-3xl font-bold mt-2 text-slate-600">{stats.casualCount}</div>
            <div className="text-xs text-slate-400 mt-2">Occasional buyers</div>
          </div>

          <div className="bg-white rounded-xl p-5 border border-slate-200 shadow-sm">
            <div className="text-slate-500 text-sm font-medium">At Risk</div>
            <div className="text-3xl font-bold mt-2 text-red-600">{stats.atRiskCount}</div>
            <div className="text-xs text-slate-400 mt-2">No recent visits</div>
          </div>

          <div className="bg-white rounded-xl p-5 border border-slate-200 shadow-sm">
            <div className="text-slate-500 text-sm font-medium">Retention Rate</div>
            <div className="text-3xl font-bold mt-2 text-slate-900">{(stats.retentionRate * 100).toFixed(1)}%</div>
            <div className="text-xs text-slate-400 mt-2">Active customers</div>
          </div>
        </div>

        {/* Charts */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Tier Distribution */}
          <div className="bg-white rounded-xl p-5 border border-slate-200 shadow-sm">
            <h3 className="text-lg font-semibold mb-4 text-slate-800">Customer Distribution</h3>
            {stats.tierDistribution.length > 0 ? (
              <ResponsiveContainer width="100%" height={300}>
                <PieChart>
                  <Pie
                    data={stats.tierDistribution}
                    dataKey="count"
                    nameKey="name"
                    cx="50%"
                    cy="50%"
                    outerRadius={100}
                    label={({ name, value }) => `${name} ${value}`}
                  >
                    {stats.tierDistribution.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip
                    contentStyle={{ backgroundColor: '#ffffff', border: '1px solid #e2e8f0', borderRadius: 8 }}
                  />
                </PieChart>
              </ResponsiveContainer>
            ) : (
              <div className="text-slate-400 py-8 text-center">No data</div>
            )}
          </div>

          {/* Lifetime Value by Tier */}
          <div className="bg-white rounded-xl p-5 border border-slate-200 shadow-sm">
            <h3 className="text-lg font-semibold mb-4 text-slate-800">Avg Lifetime Value</h3>
            {stats.tierDistribution.length > 0 ? (
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={stats.tierDistribution}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
                  <XAxis dataKey="name" stroke="#6b7280" />
                  <YAxis stroke="#6b7280" />
                  <Tooltip 
                    contentStyle={{ backgroundColor: '#ffffff', border: '1px solid #e2e8f0', borderRadius: 8 }}
                    formatter={(value) => `₱${(value as number).toFixed(2)}`}
                  />
                  <Bar dataKey="value" fill="#f59e0b" name="Lifetime Value" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="text-slate-400 py-8 text-center">No data</div>
            )}
          </div>
        </div>

        {/* Filters and Search */}
        <div className="bg-white rounded-xl p-5 border border-slate-200 shadow-sm space-y-4">
          <div className="flex gap-4 flex-wrap items-end">
            {/* Search */}
            <div className="flex-1 min-w-64">
              <label className="block text-sm font-medium text-slate-600 mb-2">Search</label>
              <input
                type="text"
                placeholder="Search by customer name..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-slate-400/30"
              />
            </div>

            {/* Tier Filter */}
            <div>
              <label className="block text-sm font-medium text-slate-600 mb-2">Tier</label>
              <select
                value={tierFilter}
                onChange={(e) => setTierFilter(e.target.value as any)}
                className="bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-slate-900 focus:outline-none focus:ring-2 focus:ring-slate-400/30"
              >
                <option value="ALL">All Tiers</option>
                <option value="VIP">VIP</option>
                <option value="REGULAR">Regular</option>
                <option value="CASUAL">Casual</option>
                <option value="AT_RISK">At Risk</option>
              </select>
            </div>

            {/* Sort */}
            <div>
              <label className="block text-sm font-medium text-slate-600 mb-2">Sort</label>
              <select
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value as any)}
                className="bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-slate-900 focus:outline-none focus:ring-2 focus:ring-slate-400/30"
              >
                <option value="lifetime-value">Highest Value</option>
                <option value="recent-visit">Recent Visit</option>
                <option value="frequency">Visit Frequency</option>
              </select>
            </div>
          </div>

          <div className="text-sm text-slate-500">
            Showing {sortedCustomers.length} of {customers.length} customers
          </div>
        </div>

        {/* Customer List */}
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
          {sortedCustomers.length > 0 ? (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-slate-50 border-b border-slate-200">
                  <tr>
                    <th className="px-4 py-3 text-left font-semibold text-slate-600">Customer</th>
                    <th className="px-4 py-3 text-left font-semibold text-slate-600">Tier</th>
                    <th className="px-4 py-3 text-right font-semibold text-slate-600">Lifetime Value</th>
                    <th className="px-4 py-3 text-right font-semibold text-slate-600">Orders</th>
                    <th className="px-4 py-3 text-right font-semibold text-slate-600">Avg Order</th>
                    <th className="px-4 py-3 text-left font-semibold text-slate-600">Frequency</th>
                    <th className="px-4 py-3 text-left font-semibold text-slate-600">Last Order</th>
                    <th className="px-4 py-3 text-center font-semibold text-slate-600">Loyalty</th>
                  </tr>
                </thead>
                <tbody>
                  {sortedCustomers.map((customer) => {
                    const tierInfo = tierConfig[customer.tier];
                    return (
                      <tr key={customer.customerName} className="border-b border-slate-100 hover:bg-slate-50 transition-colors">
                        <td className="px-4 py-3 font-medium text-slate-900">{customer.customerName}</td>
                        <td className="px-4 py-3">
                          <span className={`px-2 py-1 rounded-lg text-xs font-medium ${tierInfo.bg} ${tierInfo.text}`}>
                            {tierInfo.label}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-right font-bold text-slate-900">₱{customer.lifetimeValue.toFixed(2)}</td>
                        <td className="px-4 py-3 text-right text-slate-700">{customer.totalOrders}</td>
                        <td className="px-4 py-3 text-right text-slate-500">₱{customer.averageOrderValue.toFixed(2)}</td>
                        <td className="px-4 py-3">
                          <span className={`px-2 py-1 rounded text-xs ${
                            customer.visitFrequency === 'HIGH' ? 'bg-emerald-100 text-emerald-700' :
                            customer.visitFrequency === 'MEDIUM' ? 'bg-yellow-100 text-yellow-700' :
                            'bg-slate-100 text-slate-600'
                          }`}>
                            {customer.visitFrequency}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-slate-500 text-sm">
                          {customer.lastOrderDate 
                            ? `${customer.daysSinceLastOrder}d ago`
                            : '—'
                          }
                        </td>
                        <td className="px-4 py-3 text-center text-sm text-slate-600">
                          <div className="inline-flex gap-1">
                            <span title="Coffee Progress">{customer.coffeeProgress}/9 ☕</span>
                            <span title="Vouchers Redeemed">({customer.vouchersRedeemed}/{customer.vouchersIssued} 🎁)</span>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="p-8 text-center text-slate-400">
              No customers found matching your criteria
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
