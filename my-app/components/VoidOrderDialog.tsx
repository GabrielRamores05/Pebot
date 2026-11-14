'use client';

import { useState } from 'react';
import { formatPeso } from '@/lib/format';

// Spec 020: void or refund an order with a reason and a manager's PIN.

const REASONS = ['Wrong order', 'Customer changed their mind', 'Kitchen mistake', 'Duplicate order', 'Took too long'];
const METHODS: Record<string, string> = { CASH: 'cash', GCASH: 'GCash', PAYMAYA: 'Maya', MAYA: 'Maya', CARD: 'card' };

export interface VoidableOrder {
  id: number;
  orderNumber: string;
  totalAmount: number;
  paymentMethod?: string | null;
  paidAt?: string | Date | null;
  status?: string;
}

export default function VoidOrderDialog({
  order,
  onClose,
  onVoided,
}: {
  order: VoidableOrder;
  onClose: () => void;
  onVoided: (updated: Record<string, unknown>) => void;
}) {
  const [reason, setReason] = useState('');
  const [pin, setPin] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const paid = Boolean(order.paidAt) || order.status === 'COMPLETED';
  const method = METHODS[order.paymentMethod ?? ''] ?? 'the original method';

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (reason.trim().length < 3 || pin.length < 4) return;
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/orders/${order.id}/void`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reason: reason.trim(), pin }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error || 'Could not void the order.');
        setPin('');
        return;
      }
      onVoided(data);
    } catch {
      setError('Network error. Try again.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/35 p-4" role="dialog" aria-modal="true" aria-label="Void or refund order">
      <form onSubmit={submit} className="w-full max-w-md space-y-4 rounded-[20px] border border-hair bg-card p-5 shadow-pop">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h2 className="text-lg font-bold tracking-[-0.02em]">{paid ? 'Refund' : 'Void'} order #{order.orderNumber.split('-').pop()}</h2>
            <p className="text-sm text-muted">
              {paid
                ? <>Refund <span className="font-semibold text-ink">{formatPeso(order.totalAmount)}</span> in {method}. Stock and loyalty stamps are put back.</>
                : 'The order is cancelled and its stock is put back.'}
            </p>
          </div>
          <button type="button" onClick={onClose} className="flex h-8 w-8 items-center justify-center rounded-lg text-muted hover:bg-panel" aria-label="Close">×</button>
        </div>

        <div>
          <p className="mb-1.5 text-xs font-semibold text-muted">Reason</p>
          <div className="mb-2 flex flex-wrap gap-1.5">
            {REASONS.map((r) => (
              <button
                key={r}
                type="button"
                onClick={() => setReason(r)}
                className={`h-8 rounded-full border px-3 text-xs font-semibold transition ${reason === r ? 'border-accent bg-accent-soft text-accent-text' : 'border-hair text-muted hover:text-ink'}`}
              >
                {r}
              </button>
            ))}
          </div>
          <input
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder="Or type a reason"
            maxLength={200}
            className="h-10 w-full rounded-xl border border-hair bg-card px-3 text-sm outline-none focus:border-accent"
          />
        </div>

        <label className="block text-xs font-semibold text-muted">
          Manager PIN
          <input
            type="password"
            inputMode="numeric"
            autoComplete="off"
            value={pin}
            onChange={(e) => setPin(e.target.value.replace(/\D/g, '').slice(0, 6))}
            placeholder="••••"
            className="mt-1 h-11 w-full rounded-xl border border-hair bg-card px-3 text-center text-lg tracking-[0.4em] outline-none focus:border-accent"
          />
          <span className="mt-1 block font-normal text-faint">The owner, a manager or a shift supervisor approves with their own PIN.</span>
        </label>

        {error && <p className="rounded-xl bg-danger-bg px-3 py-2 text-sm text-danger" role="alert">{error}</p>}

        <div className="flex justify-end gap-2">
          <button type="button" onClick={onClose} className="c-btn c-btn--ghost">Keep order</button>
          <button
            type="submit"
            disabled={busy || reason.trim().length < 3 || pin.length < 4}
            className="c-btn border-danger bg-danger text-white hover:brightness-95 disabled:opacity-50"
          >
            {busy ? 'Working…' : paid ? `Refund ${formatPeso(order.totalAmount)}` : 'Void order'}
          </button>
        </div>
      </form>
    </div>
  );
}
