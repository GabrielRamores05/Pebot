'use client';

import { useCallback, useEffect, useState } from 'react';
import { formatPeso } from '@/lib/format';

// Cash drawer count for one shift (spec 017, US4): open, cash in/out, count and close.

interface Movement {
  id: number;
  kind: 'IN' | 'OUT';
  amount: number;
  reason: string;
  userName: string;
  createdAt: string;
}

interface Drawer {
  id: number;
  openedAt: string;
  openedByName: string;
  closedAt: string | null;
  closedByName: string | null;
  countedCash: number | null;
  movements: Movement[];
  totals: { openingCash: number; cashSales: number; cashIn: number; cashOut: number; expectedCash: number; overShort?: number };
}

type Mode = 'view' | 'open' | 'move' | 'close';

const field =
  'w-full rounded-[var(--radius-sm)] border border-[var(--pos-border)] bg-[var(--pos-surface)] px-2 py-1.5 text-sm text-[var(--pos-ink)] focus:border-[var(--pos-accent)] focus:outline-none';
const primary =
  'rounded-[var(--radius-md)] bg-[var(--pos-accent)] px-3 py-2 text-xs font-semibold text-white disabled:opacity-50';
const secondary =
  'rounded-[var(--radius-md)] border border-[var(--pos-border)] bg-[var(--pos-surface)] px-3 py-2 text-xs font-semibold text-[var(--pos-ink-soft)] hover:bg-[var(--pos-muted)]';

function escapeHtml(s: string) {
  return s.replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);
}

/** Printable shift report for a closed drawer. */
function printShiftReport(d: Drawer, businessName: string) {
  const w = window.open('', '_blank', 'width=360,height=640');
  if (!w) return;
  const t = d.totals;
  const row = (label: string, value: string) => `<div class="row"><span>${escapeHtml(label)}</span><span>${value}</span></div>`;
  const moves = d.movements
    .map((m) => row(`${m.kind === 'IN' ? 'In' : 'Out'}: ${m.reason}`, `${m.kind === 'IN' ? '' : '−'}${formatPeso(m.amount)}`))
    .join('');
  w.document.write(`<!DOCTYPE html><html><head><title>Shift report #${d.id}</title><style>
    body{font-family:ui-monospace,Menlo,Consolas,monospace;font-size:12px;width:72mm;margin:0 auto;padding:8px;color:#111}
    h1{font-size:14px;text-align:center;margin:0 0 4px} p{margin:2px 0;text-align:center}
    .row{display:flex;justify-content:space-between;gap:8px;margin:2px 0} hr{border:0;border-top:1px dashed #999;margin:6px 0}
    .strong{font-weight:700} .note{font-size:10px;text-align:center;margin-top:8px}
  </style></head><body>
    <h1>${escapeHtml(businessName)}</h1><p>Shift report #${d.id}</p>
    <p>${new Date(d.openedAt).toLocaleString()} – ${d.closedAt ? new Date(d.closedAt).toLocaleString() : 'open'}</p>
    <hr/>${row('Opened by', escapeHtml(d.openedByName))}${d.closedByName ? row('Closed by', escapeHtml(d.closedByName)) : ''}<hr/>
    ${row('Starting cash', formatPeso(t.openingCash))}${row('Cash sales', formatPeso(t.cashSales))}
    ${row('Cash in', formatPeso(t.cashIn))}${row('Cash out', '−' + formatPeso(t.cashOut))}${moves ? '<hr/>' + moves : ''}<hr/>
    <div class="row strong"><span>Expected cash</span><span>${formatPeso(t.expectedCash)}</span></div>
    ${d.countedCash != null ? row('Counted cash', formatPeso(d.countedCash)) : ''}
    ${t.overShort != null ? `<div class="row strong"><span>${t.overShort < 0 ? 'Short' : t.overShort > 0 ? 'Over' : 'Balanced'}</span><span>${formatPeso(Math.abs(t.overShort))}</span></div>` : ''}
    <p class="note">Management report. Not an official BIR reading.</p>
  </body></html>`);
  w.document.close();
  w.focus();
  w.print();
}

export default function CashDrawerPanel({ businessName }: { businessName: string }) {
  const [drawer, setDrawer] = useState<Drawer | null>(null);
  const [lastClosed, setLastClosed] = useState<Drawer | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [mode, setMode] = useState<Mode | null>(null);
  const [amount, setAmount] = useState('');
  const [reason, setReason] = useState('');
  const [kind, setKind] = useState<'IN' | 'OUT'>('OUT');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    try {
      const res = await fetch('/api/cash-drawer');
      if (res.ok) setDrawer((await res.json()).drawer);
    } finally {
      setLoaded(true);
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const start = (m: Mode) => {
    setMode(m);
    setAmount('');
    setReason('');
    setError(null);
    if (m === 'view') void refresh();
  };

  async function submit(url: string, body: Record<string, unknown>) {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error || 'Something went wrong. Try again.');
        return null;
      }
      return data.drawer as Drawer;
    } catch {
      setError('Network error. Try again.');
      return null;
    } finally {
      setBusy(false);
    }
  }

  const peso = Number.parseFloat(amount);
  const amountOk = Number.isFinite(peso) && peso >= 0;

  async function onOpen() {
    const d = await submit('/api/cash-drawer', { openingCash: peso });
    if (d) {
      setDrawer(d);
      setMode('view');
    }
  }
  async function onMove() {
    const d = await submit('/api/cash-drawer/movements', { kind, amount: peso, reason });
    if (d) {
      setDrawer(d);
      setMode('view');
    }
  }
  async function onClose() {
    const d = await submit('/api/cash-drawer/close', { countedCash: peso });
    if (d) {
      setDrawer(null);
      setLastClosed(d);
      setMode('view');
    }
  }

  if (!loaded) return null;

  return (
    <>
      <button
        type="button"
        onClick={() => start(drawer ? 'view' : 'open')}
        className="mb-1.5 flex w-full items-center justify-between rounded-[var(--radius-md)] border border-[var(--pos-border)] bg-[var(--pos-surface)] px-2 py-1.5 text-[10px] font-semibold text-[var(--pos-ink-soft)] hover:bg-[var(--pos-muted)]"
      >
        <span className="uppercase tracking-[0.12em]">Cash drawer</span>
        <span className={drawer ? 'text-[var(--pos-accent)]' : ''}>{drawer ? `Open · ${formatPeso(drawer.totals.expectedCash)}` : 'Closed — open'}</span>
      </button>

      {mode && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" role="dialog" aria-modal="true" aria-label="Cash drawer">
          <div className="w-full max-w-sm rounded-[var(--radius-lg)] bg-[var(--pos-paper)] p-4 text-[var(--pos-ink)] shadow-[var(--shadow-modal)]">
            <div className="mb-3 flex items-center justify-between">
              <h2 className="text-base font-semibold">Cash drawer</h2>
              <button type="button" onClick={() => setMode(null)} className="text-xs text-[var(--pos-ink-soft)] hover:underline">
                Close window
              </button>
            </div>

            {mode === 'view' && drawer && (
              <div className="space-y-3">
                <p className="text-xs text-[var(--pos-ink-soft)]">
                  Opened {new Date(drawer.openedAt).toLocaleString()} by {drawer.openedByName}
                </p>
                <dl className="space-y-1 text-sm">
                  {[
                    ['Starting cash', drawer.totals.openingCash],
                    ['Cash sales', drawer.totals.cashSales],
                    ['Cash in', drawer.totals.cashIn],
                    ['Cash out', -drawer.totals.cashOut],
                  ].map(([label, v]) => (
                    <div key={label as string} className="flex justify-between">
                      <dt className="text-[var(--pos-ink-soft)]">{label}</dt>
                      <dd>{formatPeso(v as number)}</dd>
                    </div>
                  ))}
                  <div className="flex justify-between border-t border-[var(--pos-border)] pt-1 font-semibold">
                    <dt>Expected in drawer</dt>
                    <dd>{formatPeso(drawer.totals.expectedCash)}</dd>
                  </div>
                </dl>
                {drawer.movements.length > 0 && (
                  <ul className="max-h-28 space-y-0.5 overflow-y-auto text-xs text-[var(--pos-ink-soft)]">
                    {drawer.movements.map((m) => (
                      <li key={m.id} className="flex justify-between gap-2">
                        <span className="truncate">{m.kind === 'IN' ? 'In' : 'Out'}: {m.reason}</span>
                        <span>{m.kind === 'IN' ? '' : '−'}{formatPeso(m.amount)}</span>
                      </li>
                    ))}
                  </ul>
                )}
                <div className="flex gap-2">
                  <button type="button" className={secondary} onClick={() => start('move')}>Cash in / out</button>
                  <button type="button" className={primary} onClick={() => start('close')}>Count and close</button>
                </div>
              </div>
            )}

            {mode === 'view' && !drawer && lastClosed && (
              <div className="space-y-2 text-sm">
                <p className="font-semibold">Drawer closed.</p>
                <div className="flex justify-between"><span>Expected</span><span>{formatPeso(lastClosed.totals.expectedCash)}</span></div>
                <div className="flex justify-between"><span>Counted</span><span>{formatPeso(lastClosed.countedCash ?? 0)}</span></div>
                <div className="flex justify-between font-semibold">
                  <span>{(lastClosed.totals.overShort ?? 0) < 0 ? 'Short' : (lastClosed.totals.overShort ?? 0) > 0 ? 'Over' : 'Balanced'}</span>
                  <span>{formatPeso(Math.abs(lastClosed.totals.overShort ?? 0))}</span>
                </div>
                <div className="flex gap-2 pt-1">
                  <button type="button" className={secondary} onClick={() => printShiftReport(lastClosed, businessName)}>Print shift report</button>
                  <button type="button" className={primary} onClick={() => start('open')}>Open a new drawer</button>
                </div>
              </div>
            )}

            {(mode === 'open' || mode === 'close') && (
              <form
                className="space-y-3"
                onSubmit={(e) => {
                  e.preventDefault();
                  if (amountOk) void (mode === 'open' ? onOpen() : onClose());
                }}
              >
                {mode === 'close' && drawer && (
                  <p className="text-sm">
                    Expected in drawer: <strong>{formatPeso(drawer.totals.expectedCash)}</strong>
                  </p>
                )}
                <label className="block text-xs font-semibold text-[var(--pos-ink-soft)]">
                  {mode === 'open' ? 'Starting cash in the drawer' : 'Cash you counted'}
                  <input autoFocus inputMode="decimal" type="number" min={0} step="0.01" value={amount} onChange={(e) => setAmount(e.target.value)} className={`${field} mt-1`} />
                </label>
                {mode === 'close' && drawer && amountOk && amount !== '' && (
                  <p className="text-sm">
                    {(() => {
                      const diff = Math.round((peso - drawer.totals.expectedCash) * 100) / 100;
                      return diff === 0 ? 'Balanced.' : `${diff < 0 ? 'Short' : 'Over'} by ${formatPeso(Math.abs(diff))}.`;
                    })()}
                  </p>
                )}
                <div className="flex gap-2">
                  <button type="button" className={secondary} onClick={() => setMode(drawer ? 'view' : null)}>Back</button>
                  <button type="submit" className={primary} disabled={busy || !amountOk || amount === ''}>
                    {mode === 'open' ? 'Open drawer' : 'Close drawer'}
                  </button>
                </div>
              </form>
            )}

            {mode === 'move' && (
              <form
                className="space-y-3"
                onSubmit={(e) => {
                  e.preventDefault();
                  if (amountOk && peso > 0 && reason.trim()) void onMove();
                }}
              >
                <div className="grid grid-cols-2 gap-2">
                  {(['OUT', 'IN'] as const).map((k) => (
                    <button key={k} type="button" onClick={() => setKind(k)} className={kind === k ? primary : secondary}>
                      {k === 'OUT' ? 'Cash out' : 'Cash in'}
                    </button>
                  ))}
                </div>
                <label className="block text-xs font-semibold text-[var(--pos-ink-soft)]">
                  Amount
                  <input autoFocus inputMode="decimal" type="number" min={0} step="0.01" value={amount} onChange={(e) => setAmount(e.target.value)} className={`${field} mt-1`} />
                </label>
                <label className="block text-xs font-semibold text-[var(--pos-ink-soft)]">
                  Reason
                  <input value={reason} onChange={(e) => setReason(e.target.value)} placeholder={kind === 'OUT' ? 'e.g. Bought ice' : 'e.g. Added change fund'} className={`${field} mt-1`} />
                </label>
                <div className="flex gap-2">
                  <button type="button" className={secondary} onClick={() => setMode('view')}>Back</button>
                  <button type="submit" className={primary} disabled={busy || !amountOk || !(peso > 0) || !reason.trim()}>Save</button>
                </div>
              </form>
            )}

            {error && <p className="mt-3 text-sm text-[var(--pos-danger,#b42318)]" role="alert">{error}</p>}
          </div>
        </div>
      )}
    </>
  );
}
