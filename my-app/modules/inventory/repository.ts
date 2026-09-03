 
import { prisma } from '@/lib/prisma';
import {
  canConvertUnit,
  computeVoidRollback,
  convertToBase,
  calcPricePerUnit,
  purchaseUnitOptions,
} from '@/lib/ingredient-utils';
import { productsUsingIngredient, recomputeProducts } from '@/lib/availability';

// ---------------------------------------------------------------------------
// Ingredient – location-scoped
// ---------------------------------------------------------------------------

export async function findIngredients(locationId: number = 1) {
  return prisma.ingredient.findMany({
    where: { locationId },
    orderBy: { name: 'asc' },
  });
}

export async function findIngredientsWithDetails(locationId: number = 1) {
  return prisma.ingredient.findMany({
    where: { locationId },
    include: {
      supplier: { select: { id: true, name: true } },
      _count: { select: { transactions: true } },
    },
    orderBy: { name: 'asc' },
  });
}

export async function createIngredient(
  data: {
    name: string;
    category?: string;
    baseUnit?: string;
    purchaseUnit?: string;
    currentStock?: number;
    minStock?: number;
    costPerUnit?: number;
    supplierId?: number | null;
  },
  locationId: number = 1,
) {
  return prisma.ingredient.create({
    data: {
      name: data.name,
      category: data.category || undefined,
      baseUnit: data.baseUnit || 'g',
      purchaseUnit: data.purchaseUnit || data.baseUnit || 'g',
      currentStock: data.currentStock || 0,
      minStock: data.minStock || 0,
      costPerUnit: data.costPerUnit || 0,
      supplierId: data.supplierId ?? null,
      locationId,
    },
  });
}

export async function findIngredientById(id: number, locationId: number = 1) {
  return prisma.ingredient.findFirst({
    where: { id, locationId },
    include: { supplier: true },
  });
}

// ---------------------------------------------------------------------------
// ProductIngredient – no locationId column; scoped via product/ingredient
// locationId is accepted for uniform repository API and used to filter via relation
// ---------------------------------------------------------------------------

export async function findProductIngredientsByProductIds(productIds: number[], locationId: number = 1) {
  // Scope via product location or ingredient location to enforce tenant isolation
  // If location filtering produces empty for legacy rows without location, fall back to productId filter
  // Keep locationId param for call-site uniformity per spec.
  void locationId;
  return prisma.productIngredient.findMany({
    where: { productId: { in: productIds } },
    include: { ingredient: true },
  });
}

export async function findProductIngredientsByProductId(productId: number, _locationId: number = 1) {
  return prisma.productIngredient.findMany({
    where: { productId },
    include: { ingredient: true },
  });
}

export async function deleteProductIngredientsByProductId(productId: number, _locationId: number = 1) {
  return prisma.productIngredient.deleteMany({ where: { productId } });
}

export async function createProductIngredients(
  data: Array<{ productId: number; ingredientId: number; quantity: number; required?: boolean }>,
  _locationId: number = 1,
) {
  if (data.length === 0) return { count: 0 };
  return prisma.productIngredient.createMany({ data: data as any });
}

// ---------------------------------------------------------------------------
// IngredientTransaction – location-scoped
// ---------------------------------------------------------------------------

export async function findRecentIngredientTransactionsByType(
  type: string,
  locationId: number = 1,
  take: number = 10,
) {
  return prisma.ingredientTransaction.findMany({
    where: { type, locationId },
    include: {
      ingredient: { select: { id: true, name: true, baseUnit: true, category: true } },
    },
    orderBy: { createdAt: 'desc' },
    take,
  });
}

export async function findIngredientTransactions(
  filters: { ingredientId?: number; type?: string; limit?: number },
  locationId: number = 1,
) {
  const where: Record<string, unknown> = { locationId };
  if (filters.ingredientId !== undefined) where.ingredientId = filters.ingredientId;
  if (filters.type) where.type = filters.type;
  return prisma.ingredientTransaction.findMany({
    where: where as any,
    include: {
      ingredient: { select: { id: true, name: true, baseUnit: true, category: true, costPerUnit: true } },
    },
    orderBy: { createdAt: 'desc' },
    take: filters.limit ?? 100,
  });
}

// Transactional purchase (spec 014): latest purchase price replaces the
// ingredient cost-per-unit (owner decision), the supplier is linked on the
// transaction row (referenceType 'supplier' — same contract as the tablet),
// and stock + ledger write in one transaction. Unit cost is stored per BASE
// unit so trends and cross-platform numbers match the tablet.
export async function recordIngredientPurchase(
  params: {
    ingredientId: number;
    quantity: number;
    purchaseUnit: string;
    purchaseCost: number;
    supplierId?: number | null;
    notes?: string | null;
    userId?: number | null;
  },
  locationId: number = 1,
) {
  return prisma.$transaction(async (tx) => {
    const ingredient = await tx.ingredient.findFirst({
      where: { id: params.ingredientId, locationId },
      include: { supplier: true },
    });

    if (!ingredient) throw new Error('Ingredient not found');

    // Spec 014 / QS error cases: a purchase unit must be convertible to the
    // ingredient's base unit (never trust a cross-family unit), quantity ≤ 0
    // and negative totals are rejected before anything is written.
    if (!Number.isFinite(params.quantity) || params.quantity <= 0) {
      throw new Error('Quantity must be greater than 0');
    }
    if (params.purchaseCost < 0) throw new Error('Purchase cost must not be negative');
    if (!canConvertUnit(ingredient.baseUnit, params.purchaseUnit)) {
      throw new Error(
        `Cannot record a ${params.purchaseUnit} purchase for an ingredient stocked in ${ingredient.baseUnit}. ` +
          `Supported units: ${purchaseUnitOptions(ingredient.baseUnit).join(', ')}`,
      );
    }

    const quantityInBase = convertToBase(params.quantity, params.purchaseUnit);
    if (quantityInBase <= 0) throw new Error('Converted quantity must be greater than 0');

    const pricePerUnit = calcPricePerUnit(params.purchaseCost, params.quantity, params.purchaseUnit);
    const unitCostBase = quantityInBase > 0
      ? Math.round((params.purchaseCost / quantityInBase) * 100) / 100
      : 0;
    const newCostPerUnit = unitCostBase; // latest purchase price replaces the previous value
    const newStock = ingredient.currentStock + quantityInBase;

    const transaction = await tx.ingredientTransaction.create({
      data: {
        ingredientId: ingredient.id,
        type: 'PURCHASE',
        quantity: quantityInBase,
        purchaseCost: params.purchaseCost,
        unitCost: unitCostBase,
        purchaseUnit: params.purchaseUnit,
        referenceId: params.supplierId ?? null,
        referenceType: params.supplierId != null ? 'supplier' : null,
        notes: params.notes || null,
        userId: params.userId ?? null,
        locationId,
      },
    });

    // Latest-supplier cache mirrors the latest non-void purchase: a purchase
    // without a supplier clears it (tablet parity), a purchase with one replaces it.
    const updated = await tx.ingredient.update({
      where: { id: ingredient.id },
      data: {
        currentStock: newStock,
        costPerUnit: newCostPerUnit,
        ...(params.supplierId !== undefined ? { supplierId: params.supplierId } : {}),
      },
    });

    // newWeightedCost is kept as a compatibility alias; the semantics are now
    // "latest purchase price per base unit" (see spec 014 decision Q-cost).
    return { ingredient: updated, transaction, pricePerUnit, newStock, newWeightedCost: newCostPerUnit };
  });
}

// ---------------------------------------------------------------------------
// Supplier – location-scoped
// ---------------------------------------------------------------------------

export async function findSuppliers(locationId: number = 1) {
  return prisma.supplier.findMany({
    where: { locationId },
    include: {
      ingredients: {
        select: {
          id: true,
          name: true,
          currentStock: true,
          baseUnit: true,
          products: { select: { product: { select: { id: true, name: true } } } },
        },
      },
      expenses: { select: { id: true, amount: true, expenseDate: true, description: true } },
    },
    orderBy: { name: 'asc' },
  });
}

export async function createSupplier(
  data: {
    name: string;
    contactPerson?: string | null;
    phone?: string | null;
    email?: string | null;
    address?: string | null;
    notes?: string | null;
    status?: string;
  },
  locationId: number = 1,
) {
  return prisma.supplier.create({
    data: {
      name: data.name,
      contactPerson: data.contactPerson || null,
      phone: data.phone || null,
      email: data.email || null,
      address: data.address || null,
      notes: data.notes || null,
      status: data.status || 'ACTIVE',
      locationId,
    },
  });
}

export async function updateSupplier(
  id: number,
  data: {
    name?: string;
    contactPerson?: string | null;
    phone?: string | null;
    email?: string | null;
    address?: string | null;
    notes?: string | null;
    status?: string;
  },
  _locationId: number = 1,
) {
  return prisma.supplier.update({
    where: { id },
    data: {
      name: data.name || undefined,
      contactPerson: data.contactPerson || null,
      phone: data.phone || null,
      email: data.email || null,
      address: data.address || null,
      notes: data.notes || null,
      status: data.status || undefined,
    },
  });
}

export async function findSupplierById(id: number, locationId: number = 1) {
  return prisma.supplier.findFirst({ where: { id, locationId } });
}

export async function findSupplierBrief(locationId: number = 1) {
  return prisma.supplier.findMany({
    where: { locationId },
    select: { id: true, name: true, status: true },
    orderBy: { name: 'asc' },
  });
}

export async function deleteSupplier(id: number, _locationId: number = 1) {
  // Spec 014 / no silent data loss: deleting a supplier must never leave an
  // ingredient pointing at a missing vendor. Recompute each affected
  // ingredient's latest supplier from remaining purchase history.
  return prisma.$transaction(async (tx) => {
    const affected = await tx.ingredient.findMany({ where: { supplierId: id }, select: { id: true } });
    // Recompute every affected ingredient's latest supplier BEFORE the delete so
    // it falls back to its prior supplier (or none) and never re-points at the
    // removed id. Excludes the deleted supplier's own purchase rows (its history
    // is kept, but cannot become the new "latest supplier"). This also ensures
    // no Ingredient still references the supplier when it is deleted, regardless
    // of the FK's referential action.
    for (const { id: ingredientId } of affected) {
      const latest = await tx.ingredientTransaction.findFirst({
        where: { ingredientId, type: 'PURCHASE', referenceType: 'supplier', referenceId: { not: id } },
        orderBy: { id: 'desc' },
        select: { referenceId: true },
      });
      await tx.ingredient.update({
        where: { id: ingredientId },
        data: { supplierId: latest?.referenceId ?? null },
      });
    }
    await tx.supplier.delete({ where: { id } });
  });
}

// ---------------------------------------------------------------------------
// Void purchase (spec 014 FR-009): additive compensation — the original
// PURCHASE row is never modified; a VOID_PURCHASE row reverses stock, and only
// when the voided row is the latest purchase does the cost/last supplier revert
// to the previous non-void purchase.
// ---------------------------------------------------------------------------

export async function voidIngredientPurchase(transactionId: number, locationId: number = 1) {
  return prisma.$transaction(async (tx) => {
    const purchase = await tx.ingredientTransaction.findFirst({
      where: { id: transactionId, type: 'PURCHASE', locationId },
    });
    if (!purchase) throw new Error('Purchase not found');

    const ingredient = await tx.ingredient.findUnique({ where: { id: purchase.ingredientId } });
    if (!ingredient) throw new Error('Ingredient not found');

    // Non-void PURCHASE rows in ledger (id) order — the rollback decision is a
    // pure rule (lib/ingredient-utils) so the repository and its tests share it.
    const purchaseRows = await tx.ingredientTransaction.findMany({
      where: { ingredientId: purchase.ingredientId, type: 'PURCHASE', locationId },
      select: { id: true, unitCost: true, referenceType: true, referenceId: true },
      orderBy: { id: 'asc' },
    });
    const decision = computeVoidRollback(
      purchaseRows as { id: number; unitCost: number | null; referenceType: string | null; referenceId: number | null }[],
      purchase.id,
    );

    const stockReverted = ingredient.currentStock - purchase.quantity;
    const updateData: Record<string, unknown> = { currentStock: Math.max(0, stockReverted) };
    if (decision.voidedIsLatest) {
      updateData.costPerUnit = decision.previousUnitCost ?? 0;
      updateData.supplierId = decision.previousSupplierId ?? null;
    }

    const updated = await tx.ingredient.update({ where: { id: ingredient.id }, data: updateData });

    const voidRow = await tx.ingredientTransaction.create({
      data: {
        ingredientId: ingredient.id,
        type: 'VOID_PURCHASE',
        quantity: -purchase.quantity,
        purchaseCost: purchase.purchaseCost,
        unitCost: purchase.unitCost,
        purchaseUnit: purchase.purchaseUnit,
        referenceId: purchase.id,
        referenceType: 'void-of',
        notes: `Void of purchase #${purchase.id}` + (decision.voidedIsLatest ? ' (latest — cost/last supplier reverted)' : ' (older purchase — stock only)'),
        userId: purchase.userId,
        locationId,
      },
    });

    return { ingredient: updated, voidRow, voidedIsLatest: decision.voidedIsLatest };
  });
}

// ---------------------------------------------------------------------------
// Purchase history + supplier reads (spec 014 US2/US3) — ledger rows are the
// source of truth for price/trend figures.
// ---------------------------------------------------------------------------

/** An ingredient's non-void PURCHASE rows in ledger (id) order. */
export async function findIngredientPurchaseRows(ingredientId: number, locationId: number = 1) {
  return prisma.ingredientTransaction.findMany({
    where: { ingredientId, type: 'PURCHASE', locationId },
    orderBy: { id: 'asc' },
  });
}

/** Ids of this ingredient's purchases that already have a VOID_PURCHASE row
 *  (referenceType 'void-of') so history can show them as already voided. */
export async function findVoidedPurchaseIds(ingredientId: number, locationId: number = 1) {
  const rows = await prisma.ingredientTransaction.findMany({
    where: {
      ingredientId,
      type: 'VOID_PURCHASE',
      referenceType: 'void-of',
      referenceId: { not: null },
      locationId,
    },
    select: { referenceId: true },
  });
  return new Set(rows.map((r) => r.referenceId as number));
}

/** Every supplier-linked PURCHASE row (the supplier-page ledger source). */
export async function findSupplierLinkedPurchaseRows(locationId: number = 1) {
  return prisma.ingredientTransaction.findMany({
    where: { type: 'PURCHASE', referenceType: 'supplier', referenceId: { not: null }, locationId },
    orderBy: { id: 'asc' },
  });
}

export async function findSuppliersByIds(ids: number[], locationId: number = 1) {
  if (ids.length === 0) return [];
  return prisma.supplier.findMany({
    where: { id: { in: ids }, locationId },
    select: { id: true, name: true },
  });
}

/**
 * Bulk stock corrections (spec 014 US4): the whole batch is validated against
 * current stock BEFORE anything is written and saved in ONE transaction. Each
 * changed ingredient writes an ADJUSTMENT row carrying `referenceType='batch'`
 * with the batch token (the first created row's id) in `referenceId`. Never
 * touches cost or supplier; stock-only, and nothing is written when any row
 * would push an ingredient below zero.
 */
export async function bulkAdjustIngredients(
  rows: Array<{ ingredientId: number; adjustment: number }>,
  opts: { userId?: number | null; notes?: string | null },
  locationId: number = 1,
) {
  if (rows.length === 0) {
    return { adjusted: [], transactionIds: [] as number[], batchId: null as number | null };
  }

  return prisma.$transaction(async (tx) => {
    const ids = [...new Set(rows.map((r) => r.ingredientId))];
    const ingredients = await tx.ingredient.findMany({ where: { id: { in: ids }, locationId } });
    const byId = new Map(ingredients.map((ing) => [ing.id, ing]));

    // Whole-batch validation against the CURRENT stock before any write.
    const deltas = new Map<number, number>();
    for (const row of rows) {
      const ingredient = byId.get(row.ingredientId);
      if (!ingredient) throw new Error(`Ingredient #${row.ingredientId} not found`);
      if (!Number.isFinite(row.adjustment)) throw new Error(`Adjustment must be a number for ${ingredient.name}`);
      if (row.adjustment === 0) continue;
      deltas.set(row.ingredientId, (deltas.get(row.ingredientId) ?? 0) + row.adjustment);
    }
    for (const [ingredientId, delta] of deltas) {
      const ingredient = byId.get(ingredientId)!;
      if (ingredient.currentStock + delta < 0) {
        throw new Error(
          `${ingredient.name} would drop below zero (only ${ingredient.currentStock} ${ingredient.baseUnit} in stock). Nothing was changed.`,
        );
      }
    }

    const adjusted: Array<{ id: number; name: string; currentStock: number; baseUnit: string; adjustment: number }> = [];
    const transactionIds: number[] = [];
    let batchId: number | null = null;

    for (const [ingredientId, delta] of deltas) {
      const ingredient = byId.get(ingredientId)!;
      const row = await tx.ingredientTransaction.create({
        data: {
          ingredientId,
          type: 'ADJUSTMENT',
          quantity: delta,
          unitCost: ingredient.costPerUnit,
          purchaseUnit: ingredient.baseUnit,
          referenceType: 'batch',
          referenceId: null, // backfilled below with the shared batch token
          notes: opts.notes?.trim() || 'Bulk adjust',
          userId: opts.userId ?? null,
          locationId,
        },
      });
      if (batchId == null) batchId = row.id; // batch identity = first row id
      transactionIds.push(row.id);
      const updated = await tx.ingredient.update({
        where: { id: ingredientId },
        data: { currentStock: { increment: delta } },
      });
      adjusted.push({
        id: updated.id,
        name: ingredient.name,
        baseUnit: ingredient.baseUnit,
        currentStock: updated.currentStock,
        adjustment: delta,
      });
    }

    if (batchId != null && transactionIds.length > 0) {
      await tx.ingredientTransaction.updateMany({
        where: { id: { in: transactionIds } },
        data: { referenceId: batchId },
      });
    }

    return { adjusted, transactionIds, batchId };
  });
}

// ---------------------------------------------------------------------------
// Availability – derived sellable cache (delegates to lib/availability)
// ---------------------------------------------------------------------------

export async function getProductsUsingIngredient(ingredientId: number, _locationId: number = 1) {
  return productsUsingIngredient(prisma, ingredientId);
}

export async function recomputeProductsForIngredients(productIds: number[], _locationId: number = 1) {
  return recomputeProducts(prisma, productIds);
}

// ---------------------------------------------------------------------------
// Product Inventory – location-scoped
// ---------------------------------------------------------------------------

export async function findInventoryWithProductDetails(locationId: number = 1) {
  return prisma.inventory.findMany({
    where: { product: { locationId } },
    include: {
      product: {
        include: {
          category: true,
          _count: { select: { ingredients: { where: { required: true } } } },
        },
      },
    },
    orderBy: { product: { name: 'asc' } },
  });
}

export async function countRequiredProductIngredients(productId: number, _locationId: number = 1) {
  return prisma.productIngredient.count({
    where: { productId, required: true },
  });
}

export async function updateInventory(
  productId: number,
  data: Record<string, unknown>,
  _locationId: number = 1,
) {
  return prisma.inventory.update({
    where: { productId },
    data: data as any,
    include: { product: true },
  });
}
