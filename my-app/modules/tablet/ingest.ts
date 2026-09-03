// modules/tablet/ingest.ts — pure helpers for importing a tablet export into
// the PC ledger (spec 014 T025; contracts/bridge-schema.md). No Prisma imports
// here so every rule is unit-testable in isolation.
//
// The tablet export JSON mirrors the tablet's Room schema: ingredients carry
// `lastSupplierId` (web column name: `supplierId`) and transactions carry
// `referenceType`/`referenceId` for supplier-linked purchases plus
// `VOID_PURCHASE` rows. Legacy rows without reference fields import unchanged.

export interface NormalizedTransaction {
  /** Source row id when positive; null lets the DB assign a fresh id. */
  id: number | null;
  ingredientId: number;
  type: string;
  quantity: number;
  referenceId: number | null;
  referenceType: string | null;
  purchaseUnit: string | null;
  purchaseCost: number | null;
  unitCost: number | null;
  notes: string | null;
  createdAt: Date | null;
}

export interface SupplierLinkClearingResult {
  rows: NormalizedTransaction[];
  clearedSupplierLinks: number;
}

function numOrNull(value: unknown): number | null {
  if (value === undefined || value === null || value === '') return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

function positiveId(value: unknown): number | null {
  const n = numOrNull(value);
  return n != null && Number.isInteger(n) && n > 0 ? n : null;
}

function toDate(value: unknown): Date | null {
  if (value === undefined || value === null || value === '') return null;
  if (typeof value === 'number') return Number.isFinite(value) ? new Date(value) : null;
  const d = new Date(String(value));
  return Number.isNaN(d.getTime()) ? null : d;
}

/**
 * Read the supplier link from an exported Ingredient row. The tablet emits
 * `lastSupplierId`; web exports of ingredients use `supplierId`. Absent →
 * undefined (leave the cache alone); explicit null/empty → null (clear it).
 */
export function supplierIdFromExport(row: Record<string, unknown>): number | null | undefined {
  const value = row.lastSupplierId !== undefined ? row.lastSupplierId : row.supplierId;
  if (value === undefined) return undefined;
  if (value === null || value === '') return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

/**
 * Map one exported IngredientTransaction row into web column values. Rows that
 * are unusable (missing ingredientId, non-finite quantity) come back null and
 * the importer counts them as skipped — never silently altered.
 */
export function normalizeTransactionRow(raw: Record<string, unknown>): NormalizedTransaction | null {
  const ingredientId = Number(raw.ingredientId);
  const quantity = Number(raw.quantity);
  const type = typeof raw.type === 'string' && raw.type !== '' ? raw.type : '';
  if (!Number.isInteger(ingredientId) || ingredientId <= 0) return null;
  if (!Number.isFinite(quantity)) return null;
  const referenceType =
    typeof raw.referenceType === 'string' && raw.referenceType !== '' ? raw.referenceType : null;
  const purchaseUnit =
    typeof raw.purchaseUnit === 'string' && raw.purchaseUnit !== '' ? raw.purchaseUnit : null;
  return {
    id: positiveId(raw.id),
    ingredientId,
    type,
    quantity,
    referenceId: numOrNull(raw.referenceId),
    referenceType,
    purchaseUnit,
    purchaseCost: numOrNull(raw.purchaseCost),
    unitCost: numOrNull(raw.unitCost),
    notes: typeof raw.notes === 'string' ? raw.notes : null,
    createdAt: toDate(raw.createdAt),
  };
}

/**
 * Bridge rule (contracts/bridge-schema.md): a purchase row that references an
 * unknown supplier keeps its row but has its supplier link cleared — never
 * dropped as a record. Rows without reference fields pass through unchanged.
 */
export function clearUnknownSupplierLinks(
  rows: NormalizedTransaction[],
  knownSupplierIds: ReadonlySet<number>,
): SupplierLinkClearingResult {
  let clearedSupplierLinks = 0;
  const out = rows.map((row) => {
    if (row.referenceType === 'supplier' && row.referenceId != null && !knownSupplierIds.has(row.referenceId)) {
      clearedSupplierLinks += 1;
      return { ...row, referenceType: null, referenceId: null };
    }
    return row;
  });
  return { rows: out, clearedSupplierLinks };
}

/** Number value from an exported scalar, defaulting when absent/invalid. */
export function numberFromExport(value: unknown, fallback = 0): number {
  const n = numOrNull(value);
  return n ?? fallback;
}
