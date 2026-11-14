'use client';

import { useState } from 'react';
import { countAdjustments, wasteAdjustments, wasteNote, countNote, WASTE_REASONS } from '@/lib/stock-count';
import { fetchJson, userMessage } from '@/lib/fetch-json';
import type { IngredientItem } from './types';

// ---------------------------------------------------------------------------
// Spec 014 US4: bulk stock corrections — one action saves the whole batch.
// Mirrors the tablet dialog: enter +/− amounts, nothing below zero, stock only.
// ---------------------------------------------------------------------------
export function BulkAdjustModal({
  ingredients,
  initialMode = 'count',
  onClose,
  onApplied,
}: {
  ingredients: IngredientItem[];
  initialMode?: 'count' | 'waste' | 'adjust';
  onClose: () => void;
  onApplied: () => void;
}) {
  const [mode, setMode] = useState<'count' | 'waste' | 'adjust'>(initialMode);
  const [values, setValues] = useState<Record<number, string>>({});
  const [notes, setNotes] = useState('');
  const [reason, setReason] = useState<string>(WASTE_REASONS[0]);
  const [search, setSearch] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const switchMode = (m: 'count' | 'waste' | 'adjust') => { setMode(m); setValues({}); setError(null); };
  const shown = ingredients.filter((i) => i.name.toLowerCase().includes(search.trim().toLowerCase()));

  // Live preview of the peso difference for counts and waste.
  const preview = mode === 'count' ? countAdjustments(ingredients, values) : mode === 'waste' ? wasteAdjustments(ingredients, values) : null;

  async function apply() {
    setError(null);
    let rows: { ingredientId: number; adjustment: number }[] = [];
    let note: string | null = notes;
    if (mode === 'adjust') {
      for (const ing of ingredients) {
        const text = (values[ing.id] ?? '').trim();
        if (!text) continue;
        const delta = parseFloat(text);
        if (!Number.isFinite(delta)) { setError(`Enter a valid number for ${ing.name}.`); return; }
        if (delta === 0) continue;
        if (ing.currentStock + delta < 0) { setError(`${ing.name} would drop below zero (only ${ing.currentStock} ${ing.baseUnit} left). Nothing was changed.`); return; }
        rows.push({ ingredientId: ing.id, adjustment: delta });
      }
      if (rows.length === 0) { setError('Enter at least one adjustment.'); return; }
    } else {
      if (!preview || !preview.ok) { setError(preview && !preview.ok ? preview.error : 'Nothing to save.'); return; }
      rows = preview.rows;
      note = mode === 'waste' ? wasteNote(reason, notes) : countNote(notes);
    }

    setSaving(true);
    try {
      await fetchJson('/api/ingredients/bulk-adjust', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ rows, notes: note }),
      });
      onApplied();
    } catch (e) {
      setError(userMessage(e, 'Could not save. Nothing was changed.'));
    } finally {
      setSaving(false);
    }
  }

  const TITLES = {
    count: ['Stock count', 'Type what is on the shelf. Pebot corrects the stock and shows the peso difference. Leave blank what you did not count.'],
    waste: ['Log waste', 'Record ingredients thrown away. Waste shows on the profit report.'],
    adjust: ['Adjust stock', 'Enter + to receive, − to correct down. Stock only: never touches cost or supplier.'],
  } as const;
  const placeholder = mode === 'count' ? 'Counted' : mode === 'waste' ? 'Wasted' : '±';
  const peso = (n: number) => `${n < 0 ? '−' : ''}₱${Math.abs(n).toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={onClose}>
      <div
        className="flex max-h-[88vh] w-full max-w-2xl flex-col overflow-hidden rounded-2xl bg-card shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-3 border-b border-hair px-6 py-4">
          <div>
            <h3 className="text-lg font-semibold text-ink">{TITLES[mode][0]}</h3>
            <p className="mt-0.5 text-xs text-faint">{TITLES[mode][1]}</p>
          </div>
          <button onClick={onClose} aria-label="Close" className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-panel text-muted hover:text-ink">✕</button>
        </div>

        <div className="flex flex-wrap items-center gap-2 border-b border-hair px-5 py-3">
          {(['count', 'waste', 'adjust'] as const).map((m) => (
            <button key={m} onClick={() => switchMode(m)}
              className={`rounded-full px-3.5 py-1.5 text-sm font-semibold ${mode === m ? 'bg-ink text-white' : 'bg-panel text-muted hover:text-ink'}`}>
              {TITLES[m][0]}
            </button>
          ))}
          <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Find ingredient"
            className="ml-auto h-9 w-44 rounded-xl border border-hair bg-card px-3 text-sm outline-none focus:border-accent" />
        </div>

        <div className="min-h-0 flex-1 space-y-2 overflow-y-auto p-5">
          {mode === 'waste' && (
            <div className="flex flex-wrap gap-1.5 pb-1">
              {WASTE_REASONS.map((r) => (
                <button key={r} onClick={() => setReason(r)}
                  className={`rounded-full border px-3 py-1 text-xs font-semibold ${reason === r ? 'border-accent bg-accent-soft text-accent-text' : 'border-hair text-muted'}`}>{r}</button>
              ))}
            </div>
          )}
          <input type="text" placeholder={mode === 'adjust' ? 'Reason (optional, shared by the whole batch)' : 'Note (optional)'} value={notes}
            onChange={(e) => setNotes(e.target.value)}
            className="w-full rounded-xl border border-hair bg-card px-4 py-2.5 text-sm outline-none focus:border-accent" />
          {shown.length === 0 ? (
            <p className="py-10 text-center text-sm text-faint">No ingredients match.</p>
          ) : (
            shown.map((ing) => {
              const isOut = ing.currentStock <= 0;
              return (
                <div key={ing.id} className="flex items-center gap-3 rounded-xl bg-panel px-4 py-2.5">
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium text-ink">{ing.name}</p>
                    <p className={`text-xs ${isOut ? 'font-medium text-danger' : 'text-faint'}`}>
                      {mode === 'count' ? 'Pebot expects ' : ''}{ing.currentStock.toLocaleString()} {ing.baseUnit}{mode === 'count' ? '' : ' in stock'}{isOut ? ' · out of stock' : ''}
                    </p>
                  </div>
                  <input type="number" step="0.01" min={mode === 'adjust' ? undefined : 0} placeholder={placeholder}
                    aria-label={`${placeholder} ${ing.name}`}
                    value={values[ing.id] ?? ''}
                    onChange={(e) => setValues((prev) => ({ ...prev, [ing.id]: e.target.value }))}
                    className="w-28 rounded-xl border border-hair bg-card px-3 py-2 text-center text-sm text-ink outline-none focus:border-accent" />
                  <span className="w-8 text-xs text-faint">{ing.baseUnit}</span>
                </div>
              );
            })
          )}
          {error && <div className="rounded-xl border border-danger/30 bg-danger-bg px-4 py-3 text-sm text-danger">{error}</div>}
        </div>

        <div className="flex flex-wrap items-center gap-3 border-t border-hair bg-panel px-6 py-4">
          {preview && preview.ok && (
            <p className="mr-auto text-sm text-muted">
              {preview.rows.length} ingredient{preview.rows.length === 1 ? '' : 's'} · <b className={preview.value < 0 ? 'text-danger' : 'text-good'}>{peso(preview.value)}</b>
              {mode === 'count' ? (preview.value < 0 ? ' missing' : ' extra') : ' wasted'}
            </p>
          )}
          <button onClick={onClose} className="c-btn c-btn--ghost ml-auto">Cancel</button>
          <button onClick={apply} disabled={saving || ingredients.length === 0} className="c-btn c-btn--primary disabled:opacity-50">
            {saving ? 'Saving…' : mode === 'count' ? 'Save count' : mode === 'waste' ? 'Log waste' : 'Apply all'}
          </button>
        </div>
      </div>
    </div>
  );
}
