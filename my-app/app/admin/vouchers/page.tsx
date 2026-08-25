'use client';

import { useState, useEffect, useCallback } from 'react';

interface VoucherRecord {
  id: number;
  code: string;
  customerName: string;
  status: 'ACTIVE' | 'REDEEMED';
  issuedDate: string;
  redeemedDate: string | null;
  redeemedOrderId: number | null;
  orderNumber: string | null;
}

interface VoucherStats {
  totalIssued: number;
  totalRedeemed: number;
  conversionRate: number;
  averageDaysToRedeem: number;
  pendingVouchers: number;
}

const statusColor = (status: string) => {
  if (status === 'REDEEMED') return 'bg-emerald-100 text-emerald-700 border border-emerald-200';
  if (status === 'ACTIVE') return 'bg-amber-100 text-amber-700 border border-amber-200';
  return 'bg-slate-100 text-slate-600';
};

const statusLabel = (status: string) => {
  if (status === 'REDEEMED') return '✓ Redeemed';
  if (status === 'ACTIVE') return '○ Pending';
  return status;
};

export default function VoucherRedemptionHistory() {
  const [vouchers, setVouchers] = useState<VoucherRecord[]>([]);
  const [stats, setStats] = useState<VoucherStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<'ALL' | 'ACTIVE' | 'REDEEMED'>('ALL');
  const [sortBy, setSortBy] = useState<'issued-desc' | 'issued-asc' | 'redeemed-desc'>('issued-desc');

  const fetchVouchers = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/loyalty/vouchers/history');
      if (!res.ok) throw new Error('Failed to fetch voucher history');
      const data = await res.json();
      setVouchers(data.vouchers || []);
      setStats(data.stats || null);
    } catch (e) {
      console.error('Failed to load voucher history:', e);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchVouchers();
    // Removed auto-refresh - use manual Refresh button instead
  }, [fetchVouchers]);

  // Filter and search
  const filteredVouchers = vouchers
    .filter(v => statusFilter === 'ALL' || v.status === statusFilter)
    .filter(v => 
      v.code.toLowerCase().includes(searchTerm.toLowerCase()) ||
      v.customerName.toLowerCase().includes(searchTerm.toLowerCase())
    );

  // Sort
  const sortedVouchers = [...filteredVouchers].sort((a, b) => {
    if (sortBy === 'issued-desc') return new Date(b.issuedDate).getTime() - new Date(a.issuedDate).getTime();
    if (sortBy === 'issued-asc') return new Date(a.issuedDate).getTime() - new Date(b.issuedDate).getTime();
    if (sortBy === 'redeemed-desc') {
      const aDate = a.redeemedDate ? new Date(a.redeemedDate).getTime() : 0;
      const bDate = b.redeemedDate ? new Date(b.redeemedDate).getTime() : 0;
      return bDate - aDate;
    }
    return 0;
  });

  if (loading) {
    return (
      <div className="flex-1 flex items-center justify-center bg-slate-50">
        <div className="text-slate-400">Loading voucher history...</div>
      </div>
    );
  }

  return (
    <div className="w-full h-auto bg-slate-50 text-slate-900">
      {/* Sticky Header */}
      <div className="sticky top-0 z-10 bg-white/90 backdrop-blur-xl border-b border-slate-200 px-6 py-4">
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div>
            <h1 className="text-2xl font-semibold text-slate-900">Vouchers</h1>
            <p className="text-slate-500 text-sm mt-0.5">Track loyalty voucher redemptions</p>
          </div>
          <button
            onClick={fetchVouchers}
            className="px-4 py-2 bg-slate-900 hover:bg-slate-800 rounded-xl text-sm font-medium transition-all hover:scale-105 active:scale-95 text-white"
          >
            Refresh
          </button>
        </div>
      </div>

      <div className="p-6 space-y-6">
        {/* Stats Cards */}
        {stats && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
            <div className="bg-white rounded-xl p-5 border border-slate-200 shadow-sm hover:shadow-md transition-shadow">
              <div className="text-slate-500 text-sm font-medium">Total Issued</div>
              <div className="text-3xl font-bold mt-2 text-slate-900">{stats.totalIssued}</div>
              <div className="text-xs text-slate-400 mt-2">vouchers</div>
            </div>

            <div className="bg-white rounded-xl p-5 border border-slate-200 shadow-sm hover:shadow-md transition-shadow">
              <div className="text-slate-500 text-sm font-medium">Redeemed</div>
              <div className="text-3xl font-bold mt-2 text-emerald-600">{stats.totalRedeemed}</div>
              <div className="text-xs text-slate-400 mt-2">used</div>
            </div>

            <div className="bg-white rounded-xl p-5 border border-slate-200 shadow-sm hover:shadow-md transition-shadow">
              <div className="text-slate-500 text-sm font-medium">Conversion Rate</div>
              <div className="text-3xl font-bold mt-2 text-slate-900">{(stats.conversionRate * 100).toFixed(1)}%</div>
              <div className="text-xs text-slate-400 mt-2">claimed → redeemed</div>
            </div>

            <div className="bg-white rounded-xl p-5 border border-slate-200 shadow-sm hover:shadow-md transition-shadow">
              <div className="text-slate-500 text-sm font-medium">Avg Days to Redeem</div>
              <div className="text-3xl font-bold mt-2 text-slate-900">{stats.averageDaysToRedeem.toFixed(1)}</div>
              <div className="text-xs text-slate-400 mt-2">days</div>
            </div>

            <div className="bg-white rounded-xl p-5 border border-slate-200 shadow-sm hover:shadow-md transition-shadow">
              <div className="text-slate-500 text-sm font-medium">Pending</div>
              <div className="text-3xl font-bold mt-2 text-amber-600">{stats.pendingVouchers}</div>
              <div className="text-xs text-slate-400 mt-2">not yet redeemed</div>
            </div>
          </div>
        )}

        {/* Filters and Search */}
        <div className="bg-white rounded-xl p-5 border border-slate-200 shadow-sm space-y-4">
          <div className="flex gap-4 flex-wrap items-end">
            {/* Search */}
            <div className="flex-1 min-w-64">
              <label className="block text-sm font-medium text-slate-600 mb-2">Search</label>
              <input
                type="text"
                placeholder="Search by code or customer name..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-slate-400/30"
              />
            </div>

            {/* Status Filter */}
            <div>
              <label className="block text-sm font-medium text-slate-600 mb-2">Status</label>
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value as 'ALL' | 'ACTIVE' | 'REDEEMED')}
                className="bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-slate-900 focus:outline-none focus:ring-2 focus:ring-slate-400/30"
              >
                <option value="ALL">All</option>
                <option value="ACTIVE">Pending</option>
                <option value="REDEEMED">Redeemed</option>
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
                <option value="issued-desc">Newest Issued</option>
                <option value="issued-asc">Oldest Issued</option>
                <option value="redeemed-desc">Newest Redeemed</option>
              </select>
            </div>
          </div>

          {/* Summary */}
          <div className="text-sm text-slate-500">
            Showing {sortedVouchers.length} of {vouchers.length} vouchers
          </div>
        </div>

        {/* Voucher Records Table */}
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden max-h-[500px] flex flex-col">
          {sortedVouchers.length > 0 ? (
            <div className="overflow-x-auto overflow-y-auto scrollbar-thin scrollbar-thumb-slate-300 scrollbar-track-slate-100 flex-1">
              <table className="w-full text-sm">
                <thead className="bg-slate-50 border-b border-slate-200">
                  <tr>
                    <th className="px-4 py-3 text-left font-semibold text-slate-600">Code</th>
                    <th className="px-4 py-3 text-left font-semibold text-slate-600">Customer</th>
                    <th className="px-4 py-3 text-left font-semibold text-slate-600">Status</th>
                    <th className="px-4 py-3 text-left font-semibold text-slate-600">Issued Date</th>
                    <th className="px-4 py-3 text-left font-semibold text-slate-600">Redeemed Date</th>
                    <th className="px-4 py-3 text-left font-semibold text-slate-600">Order</th>
                  </tr>
                </thead>
                <tbody>
                  {sortedVouchers.map((voucher) => (
                    <tr key={voucher.id} className="border-b border-slate-100 hover:bg-slate-50 transition-colors">
                      <td className="px-4 py-3 font-mono text-amber-600 font-semibold">{voucher.code}</td>
                      <td className="px-4 py-3 text-slate-900">{voucher.customerName}</td>
                      <td className="px-4 py-3">
                        <span className={`px-2 py-1 rounded-lg text-xs font-medium ${statusColor(voucher.status)}`}>
                          {statusLabel(voucher.status)}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-slate-500">
                        {new Date(voucher.issuedDate).toLocaleDateString([], { 
                          month: 'short', 
                          day: 'numeric', 
                          year: '2-digit',
                          hour: '2-digit',
                          minute: '2-digit',
                        })}
                      </td>
                      <td className="px-4 py-3 text-slate-500">
                        {voucher.redeemedDate 
                          ? new Date(voucher.redeemedDate).toLocaleDateString([], { 
                              month: 'short', 
                              day: 'numeric', 
                              year: '2-digit',
                              hour: '2-digit',
                              minute: '2-digit',
                            })
                          : '—'
                        }
                      </td>
                      <td className="px-4 py-3">
                        {voucher.orderNumber ? (
                          <span className="font-mono text-blue-600">{voucher.orderNumber}</span>
                        ) : (
                          <span className="text-slate-400">—</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="p-8 text-center text-slate-400">
              No vouchers found matching your criteria
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
