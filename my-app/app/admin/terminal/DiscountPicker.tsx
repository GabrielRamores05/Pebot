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
  `h-9 whitespace-nowrap rounded-[10px] px-1.5 text-[13px] font-semibold transition ${
    active
      ? 'bg-[var(--pos-surface)] text-[var(--pos-ink)] shadow-[0_1px_2px_rgba(45,30,20,0.12)]'
      : 'text-[var(--pos-ink-soft)] hover:text-[var(--pos-ink)]'
  }`;

const input =
  'h-9 w-full rounded-[10px] border border-[var(--pos-border)] bg-[var(--pos-surface)] px-2.5 text-sm text-[var(--pos-ink)] focus:border-[var(--pos-accent)] focus:outline-none';

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
    <div>
      <div className="mb-1.5 text-xs font-semibold text-[var(--pos-ink-soft)]">Discount</div>
      <div className="grid grid-cols-3 gap-1 rounded-[12px] bg-[var(--pos-muted)] p-1">
        <button type="button" className={chip(value.kind === 'NONE')} onClick={() => onChange({ kind: 'NONE' })}>
          None
        </button>
        <button
          type="button"
          className={chip(value.kind === 'STATUTORY')}
          onClick={() => value.kind !== 'STATUTORY' && onChange({ kind: 'STATUTORY', diners: 1, holders: [emptyHolder()] })}
        >
          Senior/PWD
        </button>
        <button type="button" className={chip(value.kind === 'STUDENT')} onClick={() => onChange({ kind: 'STUDENT' })}>
          Student
        </button>
      </div>

      {value.kind === 'STATUTORY' && (
        <div className="mt-2 space-y-2 rounded-[14px] bg-[var(--pos-paper)] p-2.5">
          <label className="flex items-center justify-between gap-2 text-xs font-semibold text-[var(--pos-ink-soft)]">
            Diners at this bill
            <input
              type="number"
              min={value.holders.length}
              step={1}
              value={value.diners}
              onChange={(e) => onChange({ ...value, diners: Math.max(1, Math.floor(Number(e.target.value) || 1)) })}
              className={`${input} w-16 text-right`}
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
                    className="h-9 rounded-[10px] border border-[var(--pos-border)] px-2.5 text-xs text-[var(--pos-ink-soft)] hover:bg-[var(--pos-surface)]"
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
            className="h-9 w-full rounded-[10px] border border-dashed border-[var(--pos-border)] text-xs font-semibold text-[var(--pos-ink-soft)] hover:bg-[var(--pos-surface)]"
          >
            Add another ID holder
          </button>
          <p className="text-[11px] leading-snug text-[var(--pos-ink-soft)]">
            20% off after VAT is removed, on the holders&apos; share of the bill. Check the ID before applying.
          </p>
        </div>
      )}
    </div>
  );
}
