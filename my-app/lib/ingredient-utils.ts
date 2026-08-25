// Ingredient inventory utilities: unit conversion, cost calculation, formatting
// All quantities are stored in base units (g, ml, pcs) per the Ingredient.baseUnit field.

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

/** Format a number as Philippine Peso: ₱1,500.00 */
export function formatPeso(amount: number | null | undefined): string {
  const val = amount ?? 0;
  return `₱${val.toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

/**
 * Get a human-readable display of cost per unit.
 * Converts from base-unit cost to purchase-unit or a more natural display unit.
 * e.g. if baseUnit=g and costPerUnit=0.60, display "₱0.60/g" or "₱600.00/kg"
 */
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
