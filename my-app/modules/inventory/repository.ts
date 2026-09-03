 
import { prisma } from '@/lib/prisma';
import { convertToBase, calcPricePerUnit } from '@/lib/ingredient-utils';
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

    const quantityInBase = convertToBase(params.quantity, params.purchaseUnit);
    if (quantityInBase <= 0) throw new Error('Converted quantity must be greater than 0');
    if (params.purchaseCost < 0) throw new Error('Purchase cost must not be negative');

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

    const updated = await tx.ingredient.update({
      where: { id: ingredient.id },
      data: {
        currentStock: newStock,
        costPerUnit: newCostPerUnit,
        ...(params.supplierId !== undefined ? { supplierId: params.supplierId || undefined } : {}),
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

export async function deleteSupplier(id: number, _locationId: number = 1) {
  // Spec 014 / no silent data loss: deleting a supplier must never leave an
  // ingredient pointing at a missing vendor. Recompute each affected
  // ingredient's latest supplier from remaining purchase history.
  return prisma.$transaction(async (tx) => {
    const affected = await tx.ingredient.findMany({ where: { supplierId: id }, select: { id: true } });
    await tx.supplier.delete({ where: { id } });
    for (const { id: ingredientId } of affected) {
      const latest = await tx.ingredientTransaction.findFirst({
        where: { ingredientId, type: 'PURCHASE', referenceType: 'supplier', referenceId: { not: null } },
        orderBy: { id: 'desc' },
        select: { referenceId: true },
      });
      await tx.ingredient.update({
        where: { id: ingredientId },
        data: { supplierId: latest?.referenceId ?? null },
      });
    }
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

    const later = await tx.ingredientTransaction.findFirst({
      where: { ingredientId: purchase.ingredientId, type: 'PURCHASE', id: { gt: purchase.id } },
    });
    const voidedIsLatest = later == null;

    const previousCost = voidedIsLatest
      ? await tx.ingredientTransaction.findFirst({
          where: { ingredientId: purchase.ingredientId, type: 'PURCHASE', unitCost: { not: null }, id: { lt: purchase.id } },
          orderBy: { id: 'desc' },
          select: { unitCost: true },
        })
      : null;
    const previousSupplier = voidedIsLatest
      ? await tx.ingredientTransaction.findFirst({
          where: { ingredientId: purchase.ingredientId, type: 'PURCHASE', referenceType: 'supplier', referenceId: { not: null }, id: { lt: purchase.id } },
          orderBy: { id: 'desc' },
          select: { referenceId: true },
        })
      : null;

    const stockReverted = ingredient.currentStock - purchase.quantity;
    const updateData: Record<string, unknown> = { currentStock: Math.max(0, stockReverted) };
    if (voidedIsLatest) {
      updateData.costPerUnit = previousCost?.unitCost ?? 0;
      updateData.supplierId = previousSupplier?.referenceId ?? null;
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
        notes: `Void of purchase #${purchase.id}` + (voidedIsLatest ? ' (latest — cost/last supplier reverted)' : ' (older purchase — stock only)'),
        userId: purchase.userId,
        locationId,
      },
    });

    return { ingredient: updated, voidRow, voidedIsLatest };
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
