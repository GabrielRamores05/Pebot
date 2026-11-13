'use client';

import type { CheckoutDiscount } from '@/lib/checkout';

// Discount chosen at the POS terminal (spec 017): none, Senior Citizen / PWD, or Student.

export interface DiscountHolderDraft {
  type: 'SENIOR' | 'PWD';
  name: string;
  idNumber: string;
}

export type TerminalDiscount =
  | { kind: 'NONE' }
  | { kind: 'STUDENT' }
  | { kind: 'STATUTORY'; diners: number; holders: DiscountHolderDraft[] };

/** What the bill calculation needs. */
export function toCheckoutDiscount(d: TerminalDiscount, studentRate: number): CheckoutDiscount | null {
  if (d.kind === 'STUDENT') return { kind: 'STUDENT', rate: studentRate };
  if (d.kind === 'STATUTORY') {
    const allPwd = d.holders.every((h) => h.type === 'PWD');
    return { kind: allPwd ? 'PWD' : 'SENIOR', holders: d.holders.length, diners: d.diners };
  }
  return null;
}

/** What /api/orders expects; the server derives every amount itself. */
export function toOrderDiscount(d: TerminalDiscount) {
  if (d.kind === 'STUDENT') return { kind: 'STUDENT' as const };
  if (d.kind === 'STATUTORY') {
    return {
      kind: 'STATUTORY' as const,
      diners: d.diners,
      holders: d.holders.map((h) => ({ type: h.type, name: h.name.trim(), idNumber: h.idNumber.trim() })),
    };
  }
  return undefined;
}

/** A message for the cashier when the Senior/PWD details are incomplete, else null. */
export function discountProblem(d: TerminalDiscount): string | null {
  if (d.kind !== 'STATUTORY') return null;
  if (d.holders.some((h) => !h.name.trim() || !h.idNumber.trim())) {
    return "Enter each Senior Citizen or PWD holder's name and ID number.";
  }
  if (d.holders.length > d.diners) return 'There are more ID holders than diners.';
  return null;
}

const emptyHolder = (): DiscountHolderDraft => ({ type: 'SENIOR', name: '', idNumber: '' });

const chip = (active: boolean) =>
  `min-h-[32px] rounded-[var(--radius-sm)] border px-1.5 text-[10px] font-semibold transition ${
    active
      ? 'border-[var(--pos-accent)] bg-[var(--pos-accent)] text-white'
      : 'border-[var(--pos-border)] bg-[var(--pos-surface)] text-[var(--pos-ink-soft)] hover:bg-[var(--pos-muted)]'
  }`;

const input =
  'w-full rounded-[var(--radius-sm)] border border-[var(--pos-border)] bg-[var(--pos-surface)] px-1.5 py-1 text-[11px] text-[var(--pos-ink)] focus:border-[var(--pos-accent)] focus:outline-none';

export default function DiscountPicker({
  value,
  onChange,
  studentRate,
}: {
  value: TerminalDiscount;
  onChange: (d: TerminalDiscount) => void;
  studentRate: number;
}) {
  const setHolder = (i: number, patch: Partial<DiscountHolderDraft>) => {
    if (value.kind !== 'STATUTORY') return;
    onChange({ ...value, holders: value.holders.map((h, j) => (j === i ? { ...h, ...patch } : h)) });
  };

  return (
    <div className="mb-1.5">
      <div className="mb-1 text-[10px] font-semibold uppercase tracking-[0.14em] text-[var(--pos-ink-soft)]">Discount</div>
      <div className="grid grid-cols-3 gap-1">
        <button type="button" className={chip(value.kind === 'NONE')} onClick={() => onChange({ kind: 'NONE' })}>
          None
        </button>
        <button
          type="button"
          className={chip(value.kind === 'STATUTORY')}
          onClick={() => value.kind !== 'STATUTORY' && onChange({ kind: 'STATUTORY', diners: 1, holders: [emptyHolder()] })}
        >
          Senior / PWD
        </button>
        <button type="button" className={chip(value.kind === 'STUDENT')} onClick={() => onChange({ kind: 'STUDENT' })}>
          Student {studentRate}%
        </button>
      </div>

      {value.kind === 'STATUTORY' && (
        <div className="mt-1.5 space-y-1.5 rounded-[var(--radius-md)] border border-[var(--pos-border)] bg-[var(--pos-paper)] p-1.5">
          <label className="flex items-center justify-between gap-2 text-[10px] text-[var(--pos-ink-soft)]">
            Diners at this bill
            <input
              type="number"
              min={value.holders.length}
              step={1}
              value={value.diners}
              onChange={(e) => onChange({ ...value, diners: Math.max(1, Math.floor(Number(e.target.value) || 1)) })}
              className={`${input} w-14 text-right`}
            />
          </label>
          {value.holders.map((h, i) => (
            <div key={i} className="space-y-1 border-t border-[var(--pos-border)] pt-1.5">
              <div className="flex gap-1">
                <select
                  value={h.type}
                  onChange={(e) => setHolder(i, { type: e.target.value as 'SENIOR' | 'PWD' })}
                  className={`${input} w-auto`}
                  aria-label="ID type"
                >
                  <option value="SENIOR">Senior</option>
                  <option value="PWD">PWD</option>
                </select>
                <input
                  value={h.name}
                  onChange={(e) => setHolder(i, { name: e.target.value })}
                  placeholder="Name on ID"
                  className={input}
                />
              </div>
              <div className="flex gap-1">
                <input
                  value={h.idNumber}
                  onChange={(e) => setHolder(i, { idNumber: e.target.value })}
                  placeholder="ID number"
                  className={input}
                />
                {value.holders.length > 1 && (
                  <button
                    type="button"
                    onClick={() => onChange({ ...value, holders: value.holders.filter((_, j) => j !== i) })}
                    className="rounded-[var(--radius-sm)] border border-[var(--pos-border)] px-1.5 text-[10px] text-[var(--pos-ink-soft)] hover:bg-[var(--pos-muted)]"
                    aria-label="Remove ID holder"
                  >
                    Remove
                  </button>
                )}
              </div>
            </div>
          ))}
          <button
            type="button"
            onClick={() =>
              onChange({ ...value, holders: [...value.holders, emptyHolder()], diners: Math.max(value.diners, value.holders.length + 1) })
            }
            className="w-full rounded-[var(--radius-sm)] border border-dashed border-[var(--pos-border)] py-1 text-[10px] font-semibold text-[var(--pos-ink-soft)] hover:bg-[var(--pos-muted)]"
          >
            Add another ID holder
          </button>
          <p className="text-[9px] leading-snug text-[var(--pos-ink-soft)]">
            20% off after VAT is removed, on the holders&apos; share of the bill. Check the ID before applying.
          </p>
        </div>
      )}
    </div>
  );
}
