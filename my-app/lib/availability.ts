// Availability Engine — Recipe/BOM inventory model.
// Ingredient.currentStock is the single source of truth. A product's sellable
// quantity is derived from the recipe (ProductIngredient) and current ingredient
// stocks. Inventory.quantity (per-product) is treated purely as a *derived cache*
// of sellable quantity, never as an input.

import type { Prisma } from '@/lib/prisma-client';

export type StockTx = Prisma.TransactionClient;

export interface RecipeItemInfo {
  ingredientId: number;
  name: string;
  baseUnit: string;
  quantity: number; // units consumed per 1 product (base units)
  required: boolean;
  currentStock: number;
  costPerUnit?: number; // price per 1 base unit (for capital-cost derivation)
}

export interface AvailabilityBreakdown {
  ingredientId: number;
  name: string;
  baseUnit: string;
  perProduct: number;
  available: number;
  required: boolean;
  servings: number; // floor(available / perProduct); Infinity when perProduct <= 0
}

export interface SellableResult {
  sellable: number; // finite integer; Infinity when no required ingredients
  limitingIngredientId: number | null;
  breakdown: AvailabilityBreakdown[];
}

export type StockStatus = 'IN_STOCK' | 'LOW_STOCK' | 'OUT_OF_STOCK';

export function calcStatus(sellable: number, capacityThreshold: number): StockStatus {
  if (sellable <= 0) return 'OUT_OF_STOCK';
  if (sellable <= capacityThreshold) return 'LOW_STOCK';
  return 'IN_STOCK';
}

/**
 * Pure calculation of how many of a product can still be made.
 * sellable = floor(min over REQUIRED ingredients of (currentStock / perProduct)).
 * Optional ingredients are reported in the breakdown but do NOT gate availability.
 * A product with no required ingredients => sellable = Infinity (always available).
 */
export function calcSellableQuantity(recipe: RecipeItemInfo[]): SellableResult {
  const breakdown: AvailabilityBreakdown[] = recipe.map((r) => ({
    ingredientId: r.ingredientId,
    name: r.name,
    baseUnit: r.baseUnit,
    perProduct: r.quantity,
    available: r.currentStock,
    required: r.required ?? true,
    servings: r.quantity > 0 ? Math.floor(r.currentStock / r.quantity) : Infinity,
  }));

  const required = breakdown.filter((b) => b.required && b.perProduct > 0);
  if (required.length === 0) {
    return { sellable: Infinity, limitingIngredientId: null, breakdown };
  }

  const sellable = Math.min(...required.map((b) => b.servings));
  const limiting = required.find((b) => b.servings === sellable);
  return { sellable, limitingIngredientId: limiting ? limiting.ingredientId : null, breakdown };
}

/** Fetch a product's recipe (with live ingredient stock) from the DB. */
export async function fetchRecipe(tx: StockTx, productId: number): Promise<RecipeItemInfo[]> {
  const rows = await tx.productIngredient.findMany({
    where: { productId },
    include: { ingredient: true },
  });
  if (!rows) return [];
  return rows.map((pi: any) => ({
    ingredientId: pi.ingredientId,
    name: pi.ingredient.name,
    baseUnit: pi.ingredient.baseUnit,
    quantity: pi.quantity,
    required: pi.required ?? true,
    currentStock: pi.ingredient.currentStock ?? 0,
    costPerUnit: pi.ingredient.costPerUnit ?? 0,
  }));
}

/**
 * Derived capital cost (cost to make one unit) = Σ (ingredient.costPerUnit × quantity)
 * over the product's recipe. Every recipe ingredient is treated as required, so all
 * lines count toward the cost.
 */
export function computeProductCapitalCost(recipe: RecipeItemInfo[]): number {
  return recipe.reduce((sum, r) => sum + (r.quantity || 0) * (r.costPerUnit || 0), 0);
}

/** Sellable quantity for a single product (Infinity => Number.MAX_SAFE_INTEGER for DB use). */
export async function getSellableQuantity(tx: StockTx, productId: number): Promise<number> {
  const recipe = await fetchRecipe(tx, productId);
  const { sellable } = calcSellableQuantity(recipe);
  return sellable === Infinity ? Number.MAX_SAFE_INTEGER : sellable;
}

/** All product IDs that reference the given ingredient (any recipe line). */
export async function productsUsingIngredient(tx: StockTx, ingredientId: number): Promise<number[]> {
  const rows = await tx.productIngredient.findMany({
    where: { ingredientId },
    select: { productId: true },
  });
  return Array.from(new Set(rows.map((r: any) => r.productId)));
}

/**
 * Recompute and persist the derived Inventory.quantity (sellable cache) for one
 * product. Products with no required ingredients are left untouched (always available).
 */
export async function recomputeProduct(tx: StockTx, productId: number): Promise<void> {
  const recipe = await fetchRecipe(tx, productId);
  const { sellable } = calcSellableQuantity(recipe);
  // Persist the derived capital cost from the recipe (single source of truth).
  await tx.product.update({
    where: { id: productId },
    data: { capitalCost: computeProductCapitalCost(recipe) },
  });
  if (sellable === Infinity) return; // recipe-less product — leave legacy/manual quantity alone
  // Clamp to >= 0: an overridden sale can drive an ingredient negative, but the
  // derived "sellable" cache used by the menu/terminal must never be negative
  // (the menu checks quantity === 0 for "Sold Out").
  await tx.inventory.upsert({
    where: { productId },
    update: { quantity: Math.max(0, Math.floor(sellable)) },
    create: { productId, quantity: Math.max(0, Math.floor(sellable)) },
  });
}

/** Recompute for an explicit list of products, or all products when omitted. */
export async function recomputeProducts(tx: StockTx, productIds?: number[]): Promise<void> {
  let ids = productIds;
  if (!ids || ids.length === 0) {
    const all = await tx.product.findMany({ select: { id: true } });
    ids = all.map((p: any) => p.id);
  }
  for (const pid of ids) {
    await recomputeProduct(tx, pid);
  }
}

export interface ProductionCapacityEntry {
  productId: number;
  productName: string;
  available: boolean;
  sellable: number; // null-serialised-safe sentinel for "unlimited" handled by callers
  limitingIngredientId: number | null;
  limitingIngredient: string | null;
  status: StockStatus;
  capacityThreshold: number;
  ingredients: AvailabilityBreakdown[];
}

/**
 * Production capacity for every product: sellable quantity + the limiting
 * (required) ingredient. Used by the admin capacity view and product page.
 */
export async function calcProductionCapacity(tx: StockTx): Promise<ProductionCapacityEntry[]> {
  const products = await tx.product.findMany({
    include: {
      inventory: { select: { lowStockThreshold: true, quantity: true } },
      ingredients: { include: { ingredient: true } },
    },
  });

  const results: ProductionCapacityEntry[] = [];
  for (const p of products) {
    const recipe: RecipeItemInfo[] = (p.ingredients || []).map((pi: any) => ({
      ingredientId: pi.ingredientId,
      name: pi.ingredient.name,
      baseUnit: pi.ingredient.baseUnit,
      quantity: pi.quantity,
      required: pi.required ?? true,
      currentStock: pi.ingredient.currentStock ?? 0,
    }));
    const { sellable, limitingIngredientId, breakdown } = calcSellableQuantity(recipe);
    const capacityThreshold = p.inventory?.lowStockThreshold ?? 0;
    // Clamp negative (over-drawn) sellable to 0 for display/status purposes.
    const displaySellable = sellable === Infinity ? Number.MAX_SAFE_INTEGER : Math.max(0, sellable);
    const status = sellable === Infinity ? 'IN_STOCK' : calcStatus(displaySellable, capacityThreshold);

    let limitingIngredient: string | null = null;
    if (limitingIngredientId) {
      const lim = breakdown.find((b) => b.ingredientId === limitingIngredientId);
      if (lim) limitingIngredient = lim.name;
    }

    results.push({
      productId: p.id,
      productName: p.name,
      available: p.available !== false,
      sellable: displaySellable,
      limitingIngredientId,
      limitingIngredient,
      status,
      capacityThreshold,
      ingredients: breakdown,
    });
  }
  return results;
}
