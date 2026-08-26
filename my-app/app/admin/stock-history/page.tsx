'use client';

import { useState, useEffect, useMemo } from 'react';

interface StockTx {
  id: number;
  ingredientId: number;
  ingredient: { id: number; name: string; baseUnit: string };
  type: string;
  quantity: number;
  purchaseCost: number | null;
  unitCost: number | null;
  usageCost?: number | null;
  purchaseUnit: string | null;
  referenceId: number | null;
  referenceType: string | null;
  notes: string | null;
  createdAt: string;
}

type Filter = 'ALL' | 'PURCHASE' | 'USAGE';

const TYPE_LABELS: Record<string, { label: string; cls: string }> = {
  PURCHASE: { label: 'Purchase', cls: 'bg-green-50 text-green-700 border-green-200' },
  USAGE: { label: 'Used', cls: 'bg-gray-100 text-gray-600 border-gray-200' },
  ADJUSTMENT: { label: 'Correction', cls: 'bg-amber-50 text-amber-700 border-amber-200' },
  OPENING: { label: 'Opening', cls: 'bg-blue-50 text-blue-700 border-blue-200' },
};

export default function StockHistoryPage() {
  const [txs, setTxs] = useState<StockTx[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<Filter>('ALL');
  const [search, setSearch] = useState('');

  useEffect(() => {
    fetch('/api/ingredients/transactions?limit=1000')
      .then((r) => r.json())
      .then((data) => setTxs(Array.isArray(data) ? data : []))
      .catch(() => setTxs([]))
      .finally(() => setLoading(false));
  }, []);

  const visible = useMemo(() => {
    const q = search.trim().toLowerCase();
    return txs
      .filter((t) => filter === 'ALL' || t.type === filter)
      .filter(
        (t) =>
          !q ||
          [t.ingredient?.name, t.notes, t.referenceType === 'order' ? `order ${t.referenceId}` : '']
            .some((v) => v && String(v).toLowerCase().includes(q))
      );
  }, [txs, filter, search]);

  const totalPurchased = txs
    .filter((t) => t.type === 'PURCHASE')
    .reduce((s, t) => s + (t.purchaseCost || 0), 0);

  const now = new Date();
  const monthKey = `${now.getFullYear()}-${now.getMonth()}`;
  const monthPurchased = txs
    .filter(
      (t) =>
        t.type === 'PURCHASE' &&
        new Date(t.createdAt).getFullYear() === now.getFullYear() &&
        new Date(t.createdAt).getMonth() === now.getMonth()
    )
    .reduce((s, t) => s + (t.purchaseCost || 0), 0);

  return (
    <div className="flex-1 overflow-y-auto bg-gray-50 min-h-screen">
      <div className="p-4 md:p-6 max-w-6xl mx-auto space-y-5">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Stock History</h1>
        <p className="text-xs text-gray-500">Every ingredient movement — purchases in, orders out</p>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-white/80 backdrop-blur-xl rounded-2xl border border-gray-200/50 p-5 shadow-sm">
          <p className="text-gray-400 text-xs font-semibold uppercase tracking-wide">Total Purchased</p>
          <p className="text-2xl font-bold text-green-600 mt-1">
            ₱{totalPurchased.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </p>
        </div>
        <div className="bg-white/80 backdrop-blur-xl rounded-2xl border border-gray-200/50 p-5 shadow-sm">
          <p className="text-gray-400 text-xs font-semibold uppercase tracking-wide">This Month&apos;s Purchases</p>
          <p className="text-2xl font-bold text-gray-900 mt-1">
            ₱{monthPurchased.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </p>
        </div>
        <div className="bg-white/80 backdrop-blur-xl rounded-2xl border border-gray-200/50 p-5 shadow-sm">
          <p className="text-gray-400 text-xs font-semibold uppercase tracking-wide">Ledger Entries</p>
          <p className="text-2xl font-bold text-gray-900 mt-1">{txs.length}</p>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex gap-2">
          {([
            ['ALL', 'All'],
            ['PURCHASE', 'Purchases'],
            ['USAGE', 'Used by orders'],
          ] as [Filter, string][]).map(([value, label]) => (
            <button
              key={value}
              onClick={() => setFilter(value)}
              className={`px-4 py-2 rounded-xl text-sm font-medium transition-colors ${
                filter === value
                  ? 'bg-black text-white'
                  : 'bg-white hover:bg-gray-50 text-gray-600 border border-gray-200'
              }`}
            >
              {label}
            </button>
          ))}
        </div>
        <input
          type="text"
          placeholder="Search ingredient or notes..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full sm:w-64 px-4 py-2 bg-white border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-black/10"
        />
      </div>

      {/* Ledger Table */}
      {loading ? (
        <div className="flex items-center justify-center py-16 text-gray-400">Loading history...</div>
      ) : visible.length === 0 ? (
        <div className="bg-white/60 backdrop-blur-xl rounded-3xl border border-gray-200/50 p-12 text-center">
          <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <span className="text-3xl">📜</span>
          </div>
          <p className="text-gray-500 font-medium">No stock movements found</p>
          <p className="text-gray-400 text-sm mt-1">Recorded purchases and order usage will appear here.</p>
        </div>
      ) : (
        <div className="bg-white/80 backdrop-blur-xl rounded-2xl overflow-hidden border border-gray-200/50 shadow-sm">
          <table className="w-full">
            <thead className="bg-gray-50/80">
              <tr>
                <th className="text-left px-5 py-4 text-gray-500 text-xs font-semibold uppercase tracking-wide">Date</th>
                <th className="text-left px-5 py-4 text-gray-500 text-xs font-semibold uppercase tracking-wide">Ingredient</th>
                <th className="text-left px-5 py-4 text-gray-500 text-xs font-semibold uppercase tracking-wide">Movement</th>
                <th className="text-center px-5 py-4 text-gray-500 text-xs font-semibold uppercase tracking-wide">Amount</th>
                <th className="text-right px-5 py-4 text-gray-500 text-xs font-semibold uppercase tracking-wide">Cost</th>
                <th className="text-left px-5 py-4 text-gray-500 text-xs font-semibold uppercase tracking-wide">Notes</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {visible.map((t) => {
                const meta = TYPE_LABELS[t.type] ?? { label: t.type, cls: 'bg-gray-100 text-gray-600 border-gray-200' };
                const isIn = t.quantity > 0;
                return (
                  <tr key={t.id} className="hover:bg-gray-50/50 transition-colors">
                    <td className="px-5 py-3.5 text-gray-500 text-sm whitespace-nowrap">
                      {new Date(t.createdAt).toLocaleDateString('en-PH', { month: 'short', day: 'numeric' })}
                      <span className="text-gray-300 text-xs ml-1">
                        {new Date(t.createdAt).toLocaleTimeString('en-PH', { hour: 'numeric', minute: '2-digit' })}
                      </span>
                    </td>
                    <td className="px-5 py-3.5">
                      <p className="text-gray-900 font-medium text-sm">{t.ingredient?.name}</p>
                    </td>
                    <td className="px-5 py-3.5">
                      <span className={`inline-flex px-2.5 py-1 rounded-full text-xs font-semibold border ${meta.cls}`}>
                        {meta.label}
                      </span>
                    </td>
                    <td className="px-5 py-3.5 text-center">
                      <span className={`font-semibold text-sm ${isIn ? 'text-green-600' : 'text-red-500'}`}>
                        {isIn ? '+' : ''}
                        {t.quantity.toLocaleString()} {t.ingredient?.baseUnit}
                      </span>
                    </td>
                    <td className="px-5 py-3.5 text-right">
                      {t.purchaseCost != null ? (
                        <span className="text-gray-900 font-medium text-sm">
                          ₱{t.purchaseCost.toFixed(2)}
                        </span>
                      ) : t.usageCost != null ? (
                        <span className="text-gray-400 text-sm italic" title="Estimated from average unit cost">
                          ~₱{t.usageCost.toFixed(2)}
                        </span>
                      ) : (
                        <span className="text-gray-300 text-sm">—</span>
                      )}
                    </td>
                    <td className="px-5 py-3.5">
                      <p className="text-gray-500 text-xs line-clamp-1">
                        {t.notes || (t.referenceType === 'order' && t.referenceId ? `Order #${t.referenceId}` : '—')}
                      </p>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
      </div>
    </div>
  );
}
