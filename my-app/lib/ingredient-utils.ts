// Ingredient inventory utilities: unit conversion, cost calculation, formatting
// All quantities are stored in base units (g, ml, pcs) per the Ingredient.baseUnit field.

import { formatPeso } from './format';

export { formatPeso };

export type TransactionType = 'PURCHASE' | 'USAGE' | 'ADJUSTMENT' | 'OPENING';

export interface UnitConversion {
  toBase: number;
  displayUnit: string;
  displayFactor: number;
}

// Conversion table: maps a unit string to how to convert to/from its base unit.
// Weight units convert to grams (g); volume units convert to milliliters (ml).
// Count units (pcs, bottle, pack, box, sachet) are 1:1 with themselves as base.
export const UNIT_CONVERSIONS: Record<string, UnitConversion> = {
  // Weight — base unit is grams (g)
  kg:  { toBase: 1000,       displayUnit: 'kg', displayFactor: 1000 },
  g:   { toBase: 1,          displayUnit: 'g',  displayFactor: 1 },
  mg:  { toBase: 0.001,      displayUnit: 'g',  displayFactor: 0.001 },
  ton: { toBase: 1000000,    displayUnit: 'ton', displayFactor: 1000000 },
  oz:  { toBase: 28.3495,    displayUnit: 'oz', displayFactor: 28.3495 },
  lb:  { toBase: 453.592,    displayUnit: 'lb', displayFactor: 453.592 },

  // Volume — base unit is milliliters (ml)
  L:   { toBase: 1000,       displayUnit: 'L',  displayFactor: 1000 },
  ml:  { toBase: 1,          displayUnit: 'ml', displayFactor: 1 },
  l:   { toBase: 1000,       displayUnit: 'L',  displayFactor: 1000 }, // lowercase alias

  // Count units — base is themselves, no conversion
  pcs:   { toBase: 1, displayUnit: 'pcs', displayFactor: 1 },
  bottle: { toBase: 1, displayUnit: 'bottle', displayFactor: 1 },
  pack:  { toBase: 1, displayUnit: 'pack', displayFactor: 1 },
  box:   { toBase: 1, displayUnit: 'box', displayFactor: 1 },
  sachet: { toBase: 1, displayUnit: 'sachet', displayFactor: 1 },
  can:   { toBase: 1, displayUnit: 'can', displayFactor: 1 },
  slice: { toBase: 1, displayUnit: 'slice', displayFactor: 1 },
  scoop: { toBase: 1, displayUnit: 'scoop', displayFactor: 1 },
  cup:   { toBase: 1, displayUnit: 'cup', displayFactor: 1 },
  piece: { toBase: 1, displayUnit: 'piece', displayFactor: 1 },
};

// All supported purchase/base units for UI dropdowns
export const ALL_UNITS = Object.keys(UNIT_CONVERSIONS);

// Categories for ingredients (from spec section 2)
export const INGREDIENT_CATEGORIES = [
  'Coffee',
  'Dairy',
  'Syrup',
  'Powder',
  'Food',
  'Packaging',
  'General',
];

// Common purchase units (what you buy in): kg, g, L, ml, pcs, bottle, pack, box, sachet
export const PURCHASE_UNITS = ['kg', 'g', 'L', 'ml', 'pcs', 'bottle', 'pack', 'box', 'sachet'];

/** Convert a quantity from `fromUnit` to the base unit of that unit type. */
export function convertToBase(quantity: number, fromUnit: string): number {
  const conv = UNIT_CONVERSIONS[fromUnit];
  if (!conv) return quantity; // unknown unit — assume already base, pass through
  return Math.round(quantity * conv.toBase * 1e6) / 1e6; // 6 decimal places to avoid floating drift
}

/** Convert from base units back to a display unit. */
export function convertFromBase(baseQty: number, toUnit: string): number {
  const conv = UNIT_CONVERSIONS[toUnit];
  if (!conv) return baseQty;
  if (conv.toBase === 0) return 0;
  return Math.round((baseQty / conv.toBase) * 1e6) / 1e6;
}

/**
 * Calculate Price Per Unit = Purchase Cost / Quantity (in purchase unit).
 * Returns the cost per SINGLE purchase unit (e.g. per kg, per bottle).
 * Returns null if quantity is 0 or invalid.
 */
export function calcPricePerUnit(purchaseCost: number, quantity: number, purchaseUnit: string): number | null {
  if (quantity <= 0 || purchaseCost < 0 || !purchaseUnit) return null;
  return Math.round((purchaseCost / quantity) * 100) / 100;
}

/**
 * Calculate weighted average cost per BASE unit.
 * newCostPerUnit = (oldCostPerUnit * oldStock + purchaseCost) / (oldStock + purchaseQtyInBase)
 */
export function calcWeightedAverage(
  oldCostPerUnit: number,
  oldStock: number,
  purchaseCost: number,
  purchaseQtyInBase: number,
): number {
  const oldTotalCost = oldCostPerUnit * oldStock;
  const totalCost = oldTotalCost + purchaseCost;
  const totalQty = oldStock + purchaseQtyInBase;
  if (totalQty <= 0) return 0;
  return Math.round((totalCost / totalQty) * 100) / 100;
}

/** Calculate the cost of a recipe ingredient: qty (base) × costPerUnit (per base). */
export function calcIngredientCost(quantityInBase: number, costPerUnit: number): number {
  return Math.round(quantityInBase * costPerUnit * 100) / 100;
}

/** Total inventory value for an ingredient: currentStock × costPerUnit. */
export function calcInventoryValue(currentStock: number, costPerUnit: number): number {
  return Math.round(currentStock * costPerUnit * 100) / 100;
}

/**
 * Get a human-readable display of cost per unit.
 * Converts from base-unit cost to purchase-unit or a more natural display unit.
 * e.g. if baseUnit=g and costPerUnit=0.60, display "₱0.60/g" or "₱600.00/kg"
 */

/**
 * Price change vs the previous purchase (spec 014): delta in ₱ and percent,
 * both rounded to 2dp. Returns null when there is no previous price to compare.
 * Percent is 0 when the previous price was 0 (undefined ratio).
 */
export function calcPriceChange(
  previousUnitCost: number | null | undefined,
  latestUnitCost: number,
): { delta: number; percent: number } | null {
  if (previousUnitCost == null) return null;
  const delta = Math.round((latestUnitCost - previousUnitCost) * 100) / 100;
  const percent = previousUnitCost === 0 ? 0 : Math.round((delta / previousUnitCost) * 10000) / 100;
  return { delta, percent };
}

export function formatUnitCost(costPerUnit: number, baseUnit: string): string {
  if (baseUnit === 'g') {
    const perKg = costPerUnit * 1000;
    return `${formatPeso(costPerUnit)}/g (${formatPeso(perKg)}/kg)`;
  }
  if (baseUnit === 'ml') {
    const perL = costPerUnit * 1000;
    return `${formatPeso(costPerUnit)}/ml (${formatPeso(perL)}/L)`;
  }
  return `${formatPeso(costPerUnit)}/${baseUnit}`;
}

/** Format a stock quantity with its unit, converting to a friendlier unit if large. */
export function formatStock(qty: number, baseUnit: string): string {
  if (baseUnit === 'g' && qty >= 1000) {
    const kg = convertFromBase(qty, 'kg');
    return `${formatNumber(kg, 2)} kg`;
  }
  if (baseUnit === 'ml' && qty >= 1000) {
    const L = convertFromBase(qty, 'L');
    return `${formatNumber(L, 2)} L`;
  }
  return `${formatNumber(qty, 1)} ${baseUnit}`;
}

function formatNumber(num: number, decimals: number): string {
  return num.toLocaleString('en-PH', { minimumFractionDigits: 0, maximumFractionDigits: decimals });
}

/** Determine stock status: 'IN_STOCK' | 'LOW_STOCK' | 'OUT_OF_STOCK' */
export function getStockStatus(currentStock: number, minStock: number): 'IN_STOCK' | 'LOW_STOCK' | 'OUT_OF_STOCK' {
  if (currentStock <= 0) return 'OUT_OF_STOCK';
  if (currentStock <= minStock) return 'LOW_STOCK';
  return 'IN_STOCK';
}

/** Validate a purchase input. Returns error message or null if valid. */
export function validatePurchase(
  quantity: number,
  purchaseCost: number,
  purchaseUnit: string,
): string | null {
  if (quantity <= 0) return 'Quantity must be greater than 0';
  if (purchaseCost < 0) return 'Purchase cost cannot be negative';
  if (!purchaseUnit) return 'Unit is required';
  if (!UNIT_CONVERSIONS[purchaseUnit]) return `Unknown unit: ${purchaseUnit}`;
  return null;
}

// ---------------------------------------------------------------------------
// Purchase-unit families (spec 014 US1): only units of the same family as the
// ingredient's base unit are convertible. Mirrors the tablet's PurchaseUnits.
// ---------------------------------------------------------------------------

const WEIGHT_UNITS = ['kg', 'g', 'mg', 'ton', 'oz', 'lb'];
const VOLUME_UNITS = ['L', 'l', 'ml'];
export const COUNT_UNITS = ['pcs', 'bottle', 'pack', 'box', 'sachet', 'can', 'slice', 'scoop', 'cup', 'piece'];

export type UnitFamily = 'weight' | 'volume' | 'count';

/** Which family a unit belongs to (weight → g, volume → ml, count → itself). */
export function unitFamily(unit: string): UnitFamily | null {
  if (!unit) return null;
  if (WEIGHT_UNITS.includes(unit)) return 'weight';
  if (VOLUME_UNITS.includes(unit)) return 'volume';
  if (UNIT_CONVERSIONS[unit]) return 'count';
  return null;
}

/** The real-world units a purchase may be entered in for a stocked base unit. */
export function purchaseUnitOptions(baseUnit: string): string[] {
  switch (unitFamily(baseUnit)) {
    case 'weight':
      return ['kg', 'g', 'mg', 'ton', 'oz', 'lb'];
    case 'volume':
      return ['L', 'ml'];
    case 'count':
      return COUNT_UNITS;
    default:
      return [];
  }
}

/** Whether a purchase unit can be expressed in the ingredient's base unit. */
export function canConvertUnit(baseUnit: string, purchaseUnit: string): boolean {
  const base = unitFamily(baseUnit);
  const unit = unitFamily(purchaseUnit);
  return base != null && base === unit;
}

/**
 * Convert a purchase quantity expressed in `purchaseUnit` into the ingredient's
 * base-unit quantity. Returns null when the quantity is not positive or the
 * unit pair is not convertible (spec 014: reject before any write).
 */
export function toBaseQuantity(baseUnit: string, purchaseUnit: string, quantity: number): number | null {
  if (!Number.isFinite(quantity) || quantity <= 0) return null;
  if (!canConvertUnit(baseUnit, purchaseUnit)) return null;
  const converted = convertToBase(quantity, purchaseUnit);
  return Number.isFinite(converted) ? converted : null;
}

export interface PurchaseCostBreakdown {
  /** Quantity in the ingredient's base unit. */
  quantityInBase: number;
  /** Total ÷ converted base quantity, rounded the same way the server stores it. */
  unitCostBase: number;
  /** Total ÷ entered purchase-unit quantity (per kg/L/pcs, etc.). */
  pricePerUnit: number | null;
}

/**
 * Auto unit-cost preview for a purchase entry (spec 014 US1). Pure so the UI
 * preview and the persisted math use the same conversion.
 */
export function computePurchaseCostBreakdown(
  baseUnit: string,
  purchaseUnit: string,
  quantity: number,
  purchaseCost: number,
): PurchaseCostBreakdown | null {
  if (!Number.isFinite(quantity) || quantity <= 0) return null;
  if (!Number.isFinite(purchaseCost) || purchaseCost < 0) return null;
  const quantityInBase = toBaseQuantity(baseUnit, purchaseUnit, quantity);
  if (quantityInBase == null) return null;
  return {
    quantityInBase,
    unitCostBase: Math.round((purchaseCost / quantityInBase) * 100) / 100,
    pricePerUnit: calcPricePerUnit(purchaseCost, quantity, purchaseUnit),
  };
}

// ---------------------------------------------------------------------------
// Purchase history trend rows (spec 014 US2)
// ---------------------------------------------------------------------------

/**
 * Compute the ₱/% change vs the previous priced purchase for each purchase row.
 * Ledger (row-id) order defines "previous", never dates; rows are keyed by id so
 * callers keep their own payloads. Mirrors the tablet history-walk.
 */
export function priceChangeByPurchaseId(
  rows: Array<{ id: number; unitCost: number | null }>,
): Map<number, { delta: number; percent: number } | null> {
  const ordered = [...rows].sort((a, b) => a.id - b.id);
  const changes = new Map<number, { delta: number; percent: number } | null>();
  let previousCost: number | null = null;
  for (const row of ordered) {
    changes.set(row.id, calcPriceChange(previousCost, row.unitCost ?? 0));
    if (row.unitCost != null) previousCost = row.unitCost;
  }
  return changes;
}

// ---------------------------------------------------------------------------
// Void-reversal decision (spec 014 FR-009 / QS-4) — pure so repository and
// tests share one rule; row-id order defines "latest"/"previous".
// ---------------------------------------------------------------------------

export interface PurchaseLedgerRow {
  id: number;
  unitCost: number | null;
  referenceType?: string | null;
  referenceId?: number | null;
}

export interface VoidRollbackDecision {
  /** Whether the voided row is the latest non-void purchase of the ingredient. */
  voidedIsLatest: boolean;
  /** Unit cost to roll the ingredient back to (null → none/0). */
  previousUnitCost: number | null;
  /** Supplier to roll the ingredient back to (null → none). */
  previousSupplierId: number | null;
}

/**
 * Decide how voiding one purchase affects an ingredient (spec 014 FR-009).
 * `purchases` must be the ingredient's non-void PURCHASE rows (VOID_PURCHASE
 * rows are excluded by the caller). Only when the voided row is the latest
 * non-void purchase does cost/latest-supplier roll back — to the previous
 * priced row and the previous supplier-linked row (mirrors the tablet DAO).
 */
export function computeVoidRollback(purchases: PurchaseLedgerRow[], voidedId: number): VoidRollbackDecision {
  const ordered = [...purchases].sort((a, b) => a.id - b.id);
  const idx = ordered.findIndex((row) => row.id === voidedId);
  if (idx === -1 || idx !== ordered.length - 1) {
    return { voidedIsLatest: false, previousUnitCost: null, previousSupplierId: null };
  }
  let previousUnitCost: number | null = null;
  let previousSupplierId: number | null = null;
  for (let i = idx - 1; i >= 0; i -= 1) {
    if (previousUnitCost == null && ordered[i].unitCost != null) previousUnitCost = ordered[i].unitCost;
    const refType = ordered[i].referenceType;
    const refId = ordered[i].referenceId;
    if (previousSupplierId == null && refType === 'supplier' && refId != null) {
      previousSupplierId = refId;
    }
    if (previousUnitCost != null && previousSupplierId != null) break;
  }
  return { voidedIsLatest: true, previousUnitCost, previousSupplierId };
}

// ---------------------------------------------------------------------------
// Supplier price aggregation (spec 014 US3)
// ---------------------------------------------------------------------------

export interface SupplierPurchaseRow {
  id: number;
  supplierId: number;
  ingredientId: number;
  unitCost: number | null;
}

export interface SupplierIngredientPrice {
  supplierId: number;
  ingredientId: number;
  ingredientName: string;
  baseUnit: string;
  purchaseCount: number;
  latestUnitCost: number | null;
  previousUnitCost: number | null;
  change: { delta: number; percent: number } | null;
}

/**
 * Per-supplier, per-ingredient latest price and ₱/% change vs the previous
 * price from the SAME supplier (spec 014 US3). "Previous" is the second-most
 * recent priced purchase of that ingredient from that supplier in row-id order.
 */
export function aggregateSupplierPurchasePrices(
  rows: SupplierPurchaseRow[],
  ingredientMeta: Map<number, { name: string; baseUnit: string }>,
): SupplierIngredientPrice[] {
  const groups = new Map<string, { supplierId: number; ingredientId: number; prices: PurchaseLedgerRow[] }>();
  for (const row of rows) {
    const key = `${row.supplierId}:${row.ingredientId}`;
    let group = groups.get(key);
    if (!group) {
      group = { supplierId: row.supplierId, ingredientId: row.ingredientId, prices: [] };
      groups.set(key, group);
    }
    group.prices.push({ id: row.id, unitCost: row.unitCost });
  }

  const out: SupplierIngredientPrice[] = [];
  for (const group of groups.values()) {
    const priced = group.prices.filter((p) => p.unitCost != null).sort((a, b) => a.id - b.id);
    const latest = priced.length > 0 ? priced[priced.length - 1] : null;
    const previousUnitCost = priced.length >= 2 ? priced[priced.length - 2].unitCost : null;
    const meta = ingredientMeta.get(group.ingredientId);
    out.push({
      supplierId: group.supplierId,
      ingredientId: group.ingredientId,
      ingredientName: meta?.name ?? `Ingredient #${group.ingredientId}`,
      baseUnit: meta?.baseUnit ?? '',
      purchaseCount: group.prices.length,
      latestUnitCost: latest?.unitCost ?? null,
      previousUnitCost,
      change: latest ? calcPriceChange(previousUnitCost, latest.unitCost ?? 0) : null,
    });
  }

  out.sort((a, b) => a.supplierId - b.supplierId || a.ingredientName.localeCompare(b.ingredientName));
  return out;
}

// ---------------------------------------------------------------------------
// Inventory analytics summary (spec 014 US5) — reuses the shared low/out rule
// (getStockStatus) and stock-value math (calcInventoryValue) so every surface
// agrees: healthy = stock > min; low = 0 < stock <= min; out = stock <= 0.
// ---------------------------------------------------------------------------

export interface InventoryStockSummary {
  totalIngredients: number;
  healthy: number;
  low: number;
  out: number;
  totalStockValue: number;
}

export function summarizeStockLevels(
  rows: Array<{ currentStock: number; minStock: number; costPerUnit: number }>,
): InventoryStockSummary {
  let healthy = 0;
  let low = 0;
  let out = 0;
  let totalStockValue = 0;
  for (const row of rows) {
    const status = getStockStatus(row.currentStock, row.minStock);
    if (status === 'OUT_OF_STOCK') out += 1;
    else if (status === 'LOW_STOCK') low += 1;
    else healthy += 1;
    totalStockValue += calcInventoryValue(row.currentStock, row.costPerUnit);
  }
  return {
    totalIngredients: rows.length,
    healthy,
    low,
    out,
    totalStockValue: Math.round(totalStockValue * 100) / 100,
  };
}

/** Validate an adjustment input. Returns error message or null if valid. */
export function validateAdjustment(
  quantity: number,
  currentStock: number,
  reason: string,
): string | null {
  if (quantity === 0) return 'Adjustment amount cannot be zero';
  if (reason && !['WASTE', 'SPOILAGE', 'DAMAGED', 'CORRECTION'].includes(reason)) {
    return 'Invalid reason';
  }
  const newStock = currentStock + quantity;
  if (newStock < 0) return 'Insufficient stock for this adjustment';
  return null;
}
