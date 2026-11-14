'use client';

import { useState, useEffect, useCallback } from 'react';
import { Loading, Panel, Pill, Segmented, StatTile } from '@/components/pebot-ui';

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

  if (loading) return <Loading label="Loading rewards…" />;

  const when = (d: string) => new Date(d).toLocaleString([], { month: 'short', day: 'numeric', year: '2-digit', hour: '2-digit', minute: '2-digit' });

  return (
    <div className="space-y-4 px-6 pb-8">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-muted">Loyalty rewards issued to members, and when they were used.</p>
        <button onClick={fetchVouchers} className="c-btn c-btn--ghost">Refresh</button>
      </div>

      {stats && (
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-5">
          <StatTile tone="plain" label="Issued" value={stats.totalIssued} note="Rewards earned" />
          <StatTile tone="sage" label="Used" value={stats.totalRedeemed} note="Redeemed on an order" />
          <StatTile tone="peach" label="Use rate" value={`${(stats.conversionRate * 100).toFixed(1)}%`} note="Issued → used" />
          <StatTile tone="sky" label="Days to use" value={stats.averageDaysToRedeem.toFixed(1)} note="On average" />
          <StatTile tone="sand" label="Waiting to be used" value={stats.pendingVouchers} note="Still active" />
        </div>
      )}

      <Panel
        padded={false}
        title="Rewards"
        subtitle={`Showing ${sortedVouchers.length} of ${vouchers.length}`}
        actions={
          <>
            <input
              type="search"
              placeholder="Search code or customer"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="h-9 w-60 rounded-[10px] border border-hair bg-card px-3 text-sm outline-none focus:border-accent"
              aria-label="Search rewards"
            />
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as typeof sortBy)}
              className="h-9 rounded-[10px] border border-hair bg-card px-2.5 text-sm outline-none focus:border-accent"
              aria-label="Sort rewards"
            >
              <option value="issued-desc">Newest issued</option>
              <option value="issued-asc">Oldest issued</option>
              <option value="redeemed-desc">Newest used</option>
            </select>
          </>
        }
      >
        <div className="px-5 pb-3">
          <Segmented
            size="sm"
            value={statusFilter}
            onChange={setStatusFilter}
            options={[{ key: 'ALL', label: 'All' }, { key: 'ACTIVE', label: 'Waiting' }, { key: 'REDEEMED', label: 'Used' }]}
          />
        </div>
        {sortedVouchers.length > 0 ? (
          <div className="max-h-[560px] overflow-auto">
            <table className="c-table">
              <thead>
                <tr>
                  <th>Code</th>
                  <th>Customer</th>
                  <th>Status</th>
                  <th>Issued</th>
                  <th>Used</th>
                  <th>Order</th>
                </tr>
              </thead>
              <tbody>
                {sortedVouchers.map((v) => (
                  <tr key={v.id} className="hover:bg-page">
                    <td className="font-semibold tabular-nums text-accent-text">{v.code}</td>
                    <td>{v.customerName}</td>
                    <td><Pill tone={v.status === 'REDEEMED' ? 'good' : 'warn'}>{v.status === 'REDEEMED' ? 'Used' : 'Waiting'}</Pill></td>
                    <td className="text-muted">{when(v.issuedDate)}</td>
                    <td className="text-muted">{v.redeemedDate ? when(v.redeemedDate) : '—'}</td>
                    <td className="tabular-nums">{v.orderNumber ?? <span className="text-faint">—</span>}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="px-5 pb-8 pt-2 text-center text-sm text-faint">No rewards match.</p>
        )}
      </Panel>
    </div>
  );
}
