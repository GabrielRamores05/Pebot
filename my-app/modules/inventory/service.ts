import { z } from 'zod';
import { fromZodError, ValidationError } from 'zod-validation-error';
import {
  ListInventoryParamsSchema,
  UpdateInventoryInputSchema,
} from '@/modules/inventory/schema';
import * as repo from '@/modules/inventory/repository';
import { recomputeProduct } from '@/lib/availability';
import { prisma } from '@/lib/prisma';
import { emitEvent } from '@/lib/socket';
import { logAction } from '@/lib/audit-log';
import {
  aggregateSupplierPurchasePrices,
  convertFromBase,
  priceChangeByPurchaseId,
  summarizeStockLevels,
  SupplierIngredientPrice,
} from '@/lib/ingredient-utils';

export class ProductNotFoundError extends Error {
  status = 404;
  constructor(productId: number) {
    super(`Product with id ${productId} not found`);
    this.name = 'ProductNotFoundError';
  }
}

export class ProductHasRecipeError extends Error {
  status = 403;
  constructor() {
    super('This product derives its stock from a recipe. Adjust ingredient levels instead of setting product stock directly.');
    this.name = 'ProductHasRecipeError';
  }
}

export class IngredientNotFoundError extends Error {
  status = 404;
  constructor(ingredientId: number) {
    super(`Ingredient with id ${ingredientId} not found`);
    this.name = 'IngredientNotFoundError';
  }
}

function parseInput<T>(schema: z.ZodSchema<T>, input: unknown): T {
  const result = schema.safeParse(input);
  if (!result.success) {
    throw fromZodError(result.error);
  }
  return result.data;
}

export async function listInventory(locationId = 1) {
  return repo.findInventoryWithProductDetails(locationId);
}

export async function updateInventory(input: unknown, locationId = 1) {
  const data = parseInput(UpdateInventoryInputSchema, input);

  const hasRecipe = await repo.countRequiredProductIngredients(data.productId, locationId);

  const updateData: Record<string, unknown> = {};

  if (data.lowStockThreshold !== undefined) {
    updateData.lowStockThreshold = data.lowStockThreshold;
  }

  if (data.quantity !== undefined || data.adjustment !== undefined) {
    if (hasRecipe > 0) {
      throw new ProductHasRecipeError();
    }
    updateData.quantity = data.adjustment !== undefined
      ? { increment: data.adjustment }
      : data.quantity;
  }

  const inv = await repo.updateInventory(data.productId, updateData, locationId);

  await recomputeProduct(prisma, data.productId);

  emitEvent('inventory-update', [inv]);
  emitEvent('ingredients-update', []);

  if ((inv.quantity as number) <= (inv.lowStockThreshold as number)) {
    emitEvent('low-stock-alert', [inv]);
  }

  return inv;
}

// ---------------------------------------------------------------------------
// Purchase / void / bulk-adjust (spec 014). Thin routes call these services;
// every money/stock write emits an audit event (constitution §III / spec 014).
// ---------------------------------------------------------------------------

const PurchaseInputSchema = z.object({
  ingredientId: z.number({ message: 'Ingredient is required' }).int().positive(),
  quantity: z.number({ message: 'Quantity is required' }).positive('Quantity must be greater than 0'),
  purchaseUnit: z.string({ message: 'Unit is required' }).trim().min(1, 'Unit is required'),
  purchaseCost: z
    .number({ message: 'Purchase cost is required' })
    .min(0, 'Purchase cost must not be negative'),
  supplierId: z.number().int().positive().nullable().optional(),
  notes: z.string().trim().max(1000, 'Notes are too long').nullable().optional(),
});

const VoidPurchaseInputSchema = z.object({
  transactionId: z.number({ message: 'Purchase is required' }).int().positive(),
});

const BulkAdjustInputSchema = z.object({
  rows: z
    .array(
      z.object({
        ingredientId: z.number().int().positive(),
        adjustment: z.number(),
      }),
      { message: 'rows must be an array' },
    )
    .min(1, 'Enter at least one adjustment'),
  notes: z.string().trim().max(1000).nullable().optional(),
});

/** Record a purchase (stock + ledger + latest cost + supplier cache, one
 *  repository transaction). Unit cost is always derived server-side; the
 *  client only supplies quantity/unit/total/supplier. */
export async function recordPurchase(input: unknown, opts: { userId?: number | null } = {}) {
  const data = parseInput(PurchaseInputSchema, input);
  const result = await repo.recordIngredientPurchase(
    {
      ingredientId: data.ingredientId,
      quantity: data.quantity,
      purchaseUnit: data.purchaseUnit,
      purchaseCost: data.purchaseCost,
      supplierId: data.supplierId ?? null,
      notes: data.notes ?? null,
      userId: opts.userId ?? null,
    },
    1,
  );

  await logAction({
    userId: opts.userId ?? null,
    // Token parity with the tablet audit log (spec 014): PURCHASE_RECORD on
    // the ingredient_transaction entity, entityId = the ledger row id.
    action: 'PURCHASE_RECORD',
    resource: 'ingredient_transaction',
    resourceId: result.transaction.id,
    details: {
      ingredientId: data.ingredientId,
      quantity: data.quantity,
      purchaseUnit: data.purchaseUnit,
      purchaseCost: data.purchaseCost,
      unitCost: result.transaction.unitCost,
      supplierId: data.supplierId ?? null,
    },
  });

  return result;
}

/** Void a purchase: appends a compensating VOID_PURCHASE row and reverses stock
 *  in one repository transaction; rolls cost/latest-supplier back only when the
 *  voided row was the latest non-void purchase. */
export async function voidIngredientPurchase(input: unknown, opts: { userId?: number | null } = {}) {
  const { transactionId } = parseInput(VoidPurchaseInputSchema, input);
  const result = await repo.voidIngredientPurchase(transactionId);

  await logAction({
    userId: opts.userId ?? null,
    // Token parity with the tablet audit log (spec 014): VOID_PURCHASE on the
    // ingredient_transaction entity, entityId = the voided purchase row id.
    action: 'VOID_PURCHASE',
    resource: 'ingredient_transaction',
    resourceId: transactionId,
    details: {
      ingredientId: result.ingredient.id,
      voidRowId: result.voidRow.id,
      voidedIsLatest: result.voidedIsLatest,
    },
  });

  return result;
}

/** Bulk stock corrections: one repository transaction for the whole batch
 *  (ADJUSTMENT rows sharing a batch token); rejects below-zero rows before any
 *  write; stock-only, never touches cost or supplier. */
export async function bulkAdjustStock(input: unknown, opts: { userId?: number | null } = {}) {
  const data = parseInput(BulkAdjustInputSchema, input);
  const result = await repo.bulkAdjustIngredients(
    data.rows,
    { userId: opts.userId ?? null, notes: data.notes ?? null },
    1,
  );

  await logAction({
    userId: opts.userId ?? null,
    // Token parity with the tablet audit log (spec 014): BULK_ADJUST on the
    // ingredient entity (entityId 0 — a batch spans ingredients) with the
    // batch token and count in the details.
    action: 'BULK_ADJUST',
    resource: 'ingredient',
    resourceId: 0,
    details: {
      batchId: result.batchId,
      ingredientCount: result.adjusted.length,
      ingredientIds: result.adjusted.map((a) => a.id),
      notes: data.notes ?? null,
    },
  });

  return result;
}

// ---------------------------------------------------------------------------
// Read models (spec 014 US2/US3/US5) — derived from ledger rows.
// ---------------------------------------------------------------------------

export interface PurchaseHistoryEntry {
  id: number;
  createdAt: Date;
  type: string;
  quantity: number; // base unit
  purchaseUnit: string | null;
  enteredQuantity: number; // as entered (base converted back to purchase unit)
  purchaseCost: number | null;
  unitCost: number | null;
  supplierId: number | null;
  supplierName: string | null;
  notes: string | null;
  /** True when a compensating VOID_PURCHASE row already exists for this row. */
  voided: boolean;
  change: { delta: number; percent: number } | null;
}

/** Per-ingredient purchase history (newest first) with ₱/% change vs the
 *  previous non-void purchase of that ingredient (spec 014 US2). */
export async function getIngredientPurchaseHistory(ingredientId: number, locationId = 1) {
  const ingredient = await repo.findIngredientById(ingredientId, locationId);
  if (!ingredient) throw new IngredientNotFoundError(ingredientId);

  const rows = await repo.findIngredientPurchaseRows(ingredientId, locationId);
  const voidedIds = await repo.findVoidedPurchaseIds(ingredientId, locationId);
  const changes = priceChangeByPurchaseId(
    rows.map((r) => ({ id: r.id, unitCost: r.unitCost })),
  );

  const supplierIds = [
    ...new Set(
      rows
        .filter((r) => r.referenceType === 'supplier' && r.referenceId != null)
        .map((r) => r.referenceId as number),
    ),
  ];
  const suppliers = await repo.findSuppliersByIds(supplierIds, locationId);
  const supplierNames = new Map(suppliers.map((s) => [s.id, s.name]));

  const purchases: PurchaseHistoryEntry[] = [...rows]
    .sort((a, b) => b.id - a.id)
    .map((row) => ({
      id: row.id,
      createdAt: row.createdAt,
      type: row.type,
      quantity: row.quantity,
      purchaseUnit: row.purchaseUnit,
      enteredQuantity:
        row.purchaseUnit && row.purchaseUnit !== ingredient.baseUnit
          ? Math.round(convertFromBase(row.quantity, row.purchaseUnit) * 1e6) / 1e6
          : row.quantity,
      purchaseCost: row.purchaseCost,
      unitCost: row.unitCost,
      supplierId: row.referenceType === 'supplier' ? row.referenceId : null,
      supplierName:
        row.referenceType === 'supplier' && row.referenceId != null
          ? supplierNames.get(row.referenceId) ?? null
          : null,
      notes: row.notes,
      voided: voidedIds.has(row.id),
      change: changes.get(row.id) ?? null,
    }));

  return {
    ingredient: {
      id: ingredient.id,
      name: ingredient.name,
      baseUnit: ingredient.baseUnit,
      currentStock: ingredient.currentStock,
      minStock: ingredient.minStock,
      costPerUnit: ingredient.costPerUnit,
      supplierId: ingredient.supplierId,
    },
    purchases,
  };
}

export interface SupplierInsight {
  supplierId: number;
  supplierName: string;
  items: SupplierIngredientPrice[];
}

/** Per-supplier ingredient prices derived from purchase rows (spec 014 US3):
 *  latest price from that supplier + ₱/% change vs that supplier's previous
 *  price for the same ingredient. Suppliers without purchases get an empty
 *  item list so the UI can show a "no purchases yet" note. */
export async function getSupplierPurchaseInsights(locationId = 1) {
  const [suppliers, rows, ingredients] = await Promise.all([
    repo.findSupplierBrief(locationId),
    repo.findSupplierLinkedPurchaseRows(locationId),
    repo.findIngredients(locationId),
  ]);

  const ingredientMeta = new Map(
    ingredients.map((i) => [i.id, { name: i.name, baseUnit: i.baseUnit }]),
  );
  const prices = aggregateSupplierPurchasePrices(
    rows.map((r) => ({
      id: r.id,
      supplierId: r.referenceId as number,
      ingredientId: r.ingredientId,
      unitCost: r.unitCost,
    })),
    ingredientMeta,
  );

  const bySupplier = new Map<number, SupplierIngredientPrice[]>();
  for (const price of prices) {
    const list = bySupplier.get(price.supplierId) ?? [];
    list.push(price);
    bySupplier.set(price.supplierId, list);
  }

  return suppliers.map(
    (s): SupplierInsight => ({
      supplierId: s.id,
      supplierName: s.name,
      items: bySupplier.get(s.id) ?? [],
    }),
  );
}

/** Analytics inventory summary (spec 014 US5): healthy/low/out counts + total
 *  stock value, computed with the same shared rule as every other surface. */
export async function getInventorySummary(locationId = 1) {
  const ingredients = await repo.findIngredients(locationId);
  return summarizeStockLevels(ingredients);
}

export { ValidationError };
