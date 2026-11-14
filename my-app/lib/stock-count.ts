/**
 * Stock counts and waste (spec 022). Pure: turns what staff typed into the
 * adjustment rows the bulk-adjust endpoint saves, and values the difference.
 */

export interface CountableIngredient {
  id: number;
  name: string;
  currentStock: number;
  costPerUnit: number;
  baseUnit: string;
}

export const WASTE_REASONS = ['Spoiled', 'Expired', 'Dropped or spilled', 'Wrong order remade', 'Staff meal'] as const;

type Result =
  | { ok: true; rows: { ingredientId: number; adjustment: number }[]; value: number; lines: { name: string; change: number; unit: string; value: number }[] }
  | { ok: false; error: string };

const round = (n: number, d = 2) => Math.round((n + Number.EPSILON) * 10 ** d) / 10 ** d;

/** Counted quantities → corrections. Blank means "not counted"; value is the peso difference (negative = missing stock). */
export function countAdjustments(ingredients: CountableIngredient[], counted: Record<number, string>): Result {
  const rows: { ingredientId: number; adjustment: number }[] = [];
  const lines: { name: string; change: number; unit: string; value: number }[] = [];
  for (const ing of ingredients) {
    const text = (counted[ing.id] ?? '').trim();
    if (!text) continue;
    const n = Number(text);
    if (!Number.isFinite(n) || n < 0) return { ok: false, error: `Enter a count of zero or more for ${ing.name}.` };
    const change = round(n - ing.currentStock, 4);
    if (change === 0) continue;
    rows.push({ ingredientId: ing.id, adjustment: change });
    lines.push({ name: ing.name, change, unit: ing.baseUnit, value: round(change * ing.costPerUnit) });
  }
  if (rows.length === 0) return { ok: false, error: 'Every count matches what Pebot expected. Nothing to save.' };
  return { ok: true, rows, lines, value: round(lines.reduce((s, l) => s + l.value, 0)) };
}

/** Wasted amounts → negative corrections. Cannot waste more than is in stock. */
export function wasteAdjustments(ingredients: CountableIngredient[], wasted: Record<number, string>): Result {
  const rows: { ingredientId: number; adjustment: number }[] = [];
  const lines: { name: string; change: number; unit: string; value: number }[] = [];
  for (const ing of ingredients) {
    const text = (wasted[ing.id] ?? '').trim();
    if (!text) continue;
    const n = Number(text);
    if (!Number.isFinite(n) || n <= 0) return { ok: false, error: `Enter how much ${ing.name} was wasted (more than zero).` };
    if (n > ing.currentStock) return { ok: false, error: `Only ${ing.currentStock} ${ing.baseUnit} of ${ing.name} is in stock.` };
    rows.push({ ingredientId: ing.id, adjustment: -n });
    lines.push({ name: ing.name, change: -n, unit: ing.baseUnit, value: round(-n * ing.costPerUnit) });
  }
  if (rows.length === 0) return { ok: false, error: 'Enter at least one wasted amount.' };
  return { ok: true, rows, lines, value: round(lines.reduce((s, l) => s + l.value, 0)) };
}

/** Notes saved on waste rows; the profit report finds waste by this prefix. */
export const wasteNote = (reason: string, extra?: string) => `Waste: ${reason}${extra && extra.trim() ? ` — ${extra.trim()}` : ''}`;
export const isWasteNote = (notes: string | null | undefined) => Boolean(notes && notes.startsWith('Waste:'));
export const countNote = (extra?: string) => `Stock count${extra && extra.trim() ? ` — ${extra.trim()}` : ''}`;
