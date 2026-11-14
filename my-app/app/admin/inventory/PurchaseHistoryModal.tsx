'use client';

import { useState, useEffect, useCallback } from 'react';
import { fetchJson, userMessage } from '@/lib/fetch-json';
import { formatPeso } from '@/lib/format';
import type { PurchaseHistoryRow, PurchaseHistoryData } from './types';
import { TrendText } from './TrendText';

// ---------------------------------------------------------------------------
// Spec 014 US2 + FR-009: one ingredient's purchase history with supplier,
// entered + base quantity, total, unit cost, ₱/% change vs the previous
// purchase, and the admin Void action.
// ---------------------------------------------------------------------------
export function PurchaseHistoryModal({
  ingredient,
  onClose,
  onChanged,
}: {
  ingredient: { id: number; name: string; baseUnit: string };
  onClose: () => void;
  onChanged: () => void;
}) {
  const [history, setHistory] = useState<PurchaseHistoryData | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [voidingId, setVoidingId] = useState<number | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setLoadError(null);
    try {
      setHistory(await fetchJson<PurchaseHistoryData>(`/api/ingredients/${ingredient.id}/purchases`));
    } catch (e) {
      setLoadError(userMessage(e, 'Could not load purchase history.'));
    } finally {
      setLoading(false);
    }
  }, [ingredient.id]);

  useEffect(() => {
    load();
  }, [load]);

  async function handleVoid(row: PurchaseHistoryRow) {
    const confirmed = window.confirm(
      `Void purchase #${row.id}? The original record is never changed — a compensating VOID entry is appended and stock rolls back. ` +
        `If this was the latest purchase, unit cost and latest supplier also roll back to the previous purchase.`
    );
    if (!confirmed) return;
    setVoidingId(row.id);
    try {
      const res = await fetch(`/api/ingredients/purchases/${row.id}/void`, { method: 'POST' });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        alert(data.error || 'Failed to void purchase');
        return;
      }
      onChanged();
      await load();
    } catch (e) {
      alert(userMessage(e, 'Failed to void purchase'));
    } finally {
      setVoidingId(null);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={onClose}>
      <div
        className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl flex flex-col max-h-[85vh] overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
          <div>
            <h3 className="text-lg font-semibold text-gray-900">{ingredient.name} — Purchase History</h3>
            <p className="text-xs text-gray-400 mt-0.5">
              {history?.ingredient
                ? `Stock ${history.ingredient.currentStock.toLocaleString()} ${history.ingredient.baseUnit} · Latest cost ${formatPeso(history.ingredient.costPerUnit)} / ${history.ingredient.baseUnit}`
                : `Stocked in ${ingredient.baseUnit}`}
            </p>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-gray-100 text-gray-500 hover:bg-gray-200 hover:text-gray-700 flex items-center justify-center transition-all"
          >
            ✕
          </button>
        </div>

        <div className="p-5 space-y-3 overflow-y-auto flex-1 min-h-0">
          {loadError && (
            <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{loadError}</div>
          )}
          {loading ? (
            <div className="py-12 text-center text-gray-400">Loading purchase history...</div>
          ) : !history || history.purchases.length === 0 ? (
            <div className="py-12 text-center">
              <p className="text-gray-500 font-medium">No purchases recorded yet.</p>
              <p className="text-gray-400 text-sm mt-1">Use “+ Add Purchase” to record the first delivery.</p>
            </div>
          ) : (
            history.purchases.map((row) => (
              <div key={row.id} className="bg-gray-50 rounded-xl border border-gray-100 p-4">
                <div className="flex items-start justify-between gap-3 flex-wrap">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-gray-400 text-xs font-medium">
                        {new Date(row.createdAt).toLocaleString('en-PH', {
                          month: 'short',
                          day: 'numeric',
                          year: 'numeric',
                          hour: 'numeric',
                          minute: '2-digit',
                        })}
                      </span>
                      {row.supplierName ? (
                        <span className="inline-flex px-2 py-0.5 rounded-full text-[11px] font-semibold bg-blue-50 text-blue-700">
                          {row.supplierName}
                        </span>
                      ) : (
                        <span className="inline-flex px-2 py-0.5 rounded-full text-[11px] font-medium bg-gray-100 text-gray-500">
                          No supplier
                        </span>
                      )}
                    </div>
                    <p className="text-gray-900 font-medium text-sm mt-1.5">
                      {row.enteredQuantity.toLocaleString()} {row.purchaseUnit || ingredient.baseUnit}
                      <span className="text-gray-400 font-normal"> = {row.quantity.toLocaleString()} {ingredient.baseUnit}</span>
                    </p>
                    <div className="flex items-center gap-4 mt-1 flex-wrap">
                      <span className="text-sm text-gray-700">
                        Total: <span className="font-semibold">{formatPeso(row.purchaseCost)}</span>
                      </span>
                      {row.unitCost != null && (
                        <span className="text-sm text-gray-700">
                          Unit cost: <span className="font-semibold">{formatPeso(row.unitCost)} / {ingredient.baseUnit}</span>
                        </span>
                      )}
                      <TrendText change={row.change} baseUnit={ingredient.baseUnit} />
                    </div>
                  </div>
                  <button
                    onClick={() => handleVoid(row)}
                    disabled={voidingId != null || row.voided}
                    className={`shrink-0 px-3 py-1.5 rounded-xl text-xs font-medium transition-colors disabled:opacity-60 ${
                      row.voided
                        ? 'bg-gray-100 text-gray-400 cursor-not-allowed'
                        : 'bg-red-50 hover:bg-red-100 text-red-600'
                    }`}
                    title={row.voided ? 'This purchase was already voided (compensating VOID entry exists)' : undefined}
                  >
                    {row.voided ? 'Voided' : voidingId === row.id ? 'Voiding...' : 'Void'}
                  </button>
                </div>
              </div>
            ))
          )}
        </div>

        <div className="px-6 py-4 bg-gray-50 flex justify-end">
          <button
            onClick={onClose}
            className="bg-black hover:bg-gray-800 text-white font-semibold py-2 px-5 rounded-xl transition"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
