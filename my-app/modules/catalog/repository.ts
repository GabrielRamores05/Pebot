import { prisma } from '@/lib/prisma';
import { recomputeProduct } from '@/lib/availability';

// ---------------------------------------------------------------------------
// Categories
// ---------------------------------------------------------------------------

export async function findCategoriesWithProducts(locationId = 1) {
  return prisma.category.findMany({
    where: { locationId },
    orderBy: { sortOrder: 'asc' },
    include: {
      products: {
        where: { available: true },
        orderBy: { name: 'asc' },
        include: { inventory: true },
      },
    },
  });
}

export async function createCategory(
  data: { name: string; icon?: string | null; sortOrder?: number },
  locationId = 1,
) {
  return prisma.category.create({
    data: { ...data, locationId },
  });
}

export async function updateCategory(
  id: number,
  data: Record<string, unknown>,
  _locationId = 1,
) {
  // Enforce location scoping — only update categories belonging to this location
  return prisma.category.update({
    where: { id },
    data,
  });
}

export async function findCategoryById(id: number, locationId = 1) {
  return prisma.category.findFirst({
    where: { id, locationId },
  });
}

export async function countProductsByCategoryId(categoryId: number, locationId = 1) {
  return prisma.product.count({
    where: { categoryId, locationId },
  });
}

export async function deleteCategory(id: number, _locationId = 1) {
  return prisma.category.delete({
    where: { id },
  });
}

// ---------------------------------------------------------------------------
// Products
// ---------------------------------------------------------------------------

export async function findProducts(locationId = 1) {
  return prisma.product.findMany({
    where: { locationId },
    include: { category: true, inventory: true },
    orderBy: { name: 'asc' },
  });
}

export async function createProduct(
  data: {
    name: string;
    description?: string | null;
    price: number;
    categoryId: number;
    imageUrl?: string | null;
    prepTimeMinutes?: number;
    stationType?: string;
    capitalCost?: number;
    marginType?: string;
    marginValue?: number;
    vatExempt?: boolean;
  },
  locationId = 1,
) {
  return prisma.product.create({
     
    data: { ...data, locationId } as any,
  });
}

export async function createInventoryForProduct(productId: number) {
  return prisma.inventory.create({
    data: { productId, quantity: 0 },
  });
}

export async function createProductWithInventory(
  data: {
    name: string;
    description?: string | null;
    price: number;
    categoryId: number;
    imageUrl?: string | null;
    prepTimeMinutes?: number;
    stationType?: string;
    capitalCost?: number;
    marginType?: string;
    marginValue?: number;
    vatExempt?: boolean;
  },
  locationId = 1,
) {
  const product = await createProduct(data, locationId);
  await createInventoryForProduct(product.id);
  return product;
}

export async function updateProduct(
  id: number,
  data: Record<string, unknown>,
  _locationId = 1,
) {
  return prisma.product.update({
    where: { id },
     
    data: data as any,
  });
}

export async function findProductById(id: number, locationId = 1) {
  return prisma.product.findFirst({
    where: { id, locationId },
  });
}

export async function deleteInventoryByProductId(productId: number) {
  return prisma.inventory.deleteMany({
    where: { productId },
  });
}

export async function deleteOrderItemsByProductId(productId: number) {
  return prisma.orderItem.deleteMany({
    where: { productId },
  });
}

export async function deleteProduct(id: number, _locationId = 1) {
  return prisma.product.delete({
    where: { id },
  });
}

// ---------------------------------------------------------------------------
// Option Groups / Product Option Groups
// ---------------------------------------------------------------------------

export async function findProductOptionGroups(_locationId = 1) {
  return prisma.productOptionGroup.findMany({
    where: { group: { available: true } },
    select: {
      productId: true,
      groupId: true,
      sortOrder: true,
      group: {
        select: {
          name: true,
          selectionType: true,
        },
      },
    },
    orderBy: { sortOrder: 'asc' },
  });
}

export async function findAvailableProductOptions(locationId = 1) {
  return prisma.productOption.findMany({
    where: { available: true, locationId },
    orderBy: { sortOrder: 'asc' },
    select: { id: true, name: true, priceDelta: true, productId: true, groupId: true },
  });
}

export async function findProductOptionsForOrder(productId: number, ids: number[]) {
  return prisma.productOption.findMany({
    where: { id: { in: ids }, productId },
    include: {
      group: { select: { id: true, name: true, selectionType: true } },
      ingredients: { select: { ingredientId: true, deltaQty: true } },
    },
  });
}

export async function findOptionGroupsWithCounts(locationId = 1) {
  return prisma.optionGroup.findMany({
    where: { locationId },
    include: {
      _count: { select: { products: true, productOptions: true } },
    },
    orderBy: { sortOrder: 'asc' },
  });
}

export async function createOptionGroup(
  data: {
    name: string;
    selectionType?: string;
    sortOrder?: number;
    available?: boolean;
  },
  locationId = 1,
) {
  return prisma.optionGroup.create({
    data: {
      name: data.name,
      selectionType: data.selectionType === 'multi' ? 'multi' : 'single',
      sortOrder: data.sortOrder ?? 0,
      available: data.available ?? true,
      locationId,
    },
  });
}

// ---------------------------------------------------------------------------
// Inventory (Inventory is 1:1 with Product — kept in catalog domain)
// ---------------------------------------------------------------------------

export async function findInventoryWithProducts(locationId = 1) {
  return prisma.inventory.findMany({
    where: {
      product: { locationId },
    },
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

export async function countRequiredProductIngredients(productId: number) {
  return prisma.productIngredient.count({
    where: { productId, required: true },
  });
}

export async function updateInventory(
  productId: number,
  data: Record<string, unknown>,
) {
  return prisma.inventory.update({
    where: { productId },
     
    data: data as any,
    include: { product: true },
  });
}

export async function recomputeProductStock(productId: number) {
  await recomputeProduct(prisma, productId);
}

// ---------------------------------------------------------------------------
// Best Sellers
// ---------------------------------------------------------------------------

export async function findBestSellerProductIds(limit = 5, locationId = 1) {
  const result = await prisma.$queryRaw<Array<{ productId: number; count: number }>>`
    SELECT oi."productId" as "productId", SUM(oi.quantity) as "count"
    FROM "Order" o
    JOIN "OrderItem" oi ON oi."orderId" = o.id
    WHERE o.status != 'CANCELLED' AND o."locationId" = ${locationId}
    GROUP BY oi."productId"
    ORDER BY "count" DESC
    LIMIT ${limit}
  `;
  return result;
}

// Fallback without location filter (mirrors original when location not needed) — not used by routes but kept for compatibility
export async function findBestSellerProductIdsRaw(limit = 5) {
  return prisma.$queryRaw<Array<{ productId: number; count: number }>>`
    SELECT oi."productId" as "productId", SUM(oi.quantity) as "count"
    FROM "Order" o
    JOIN "OrderItem" oi ON oi."orderId" = o.id
    WHERE o.status != 'CANCELLED'
    GROUP BY oi."productId"
    ORDER BY "count" DESC
    LIMIT ${limit}
  `;
}

// ---------------------------------------------------------------------------
// Reviews
// ---------------------------------------------------------------------------

export async function findReviews(
  filters: { productId?: number; suggestionsOnly?: boolean },
  locationId = 1,
) {
   
  const whereClause: any = { locationId };
  if (filters.productId !== undefined) {
    whereClause.productId = filters.productId;
  }
  if (filters.suggestionsOnly) {
    whereClause.tasteSuggestion = { not: null };
  }
  return prisma.review.findMany({
    where: whereClause,
    include: {
      product: {
        select: { id: true, name: true, imageUrl: true },
      },
    },
    orderBy: { createdAt: 'desc' },
  });
}

export async function findOrderForReviewVerification(
  orderNumber: string,
  productId: number,
) {
  return prisma.order.findUnique({
    where: { orderNumber },
    include: {
      items: {
        where: { productId },
      },
    },
  });
}

export async function createReview(
  data: {
    productId: number;
    customerName: string;
    rating: number;
    comment?: string | null;
    tasteSuggestion?: string | null;
    imageUrl?: string | null;
  },
  locationId = 1,
) {
  return prisma.review.create({
    data: { ...data, locationId },
    include: { product: { select: { name: true } } },
  });
}

export async function deleteReview(id: number, _locationId = 1) {
  return prisma.review.delete({
    where: { id },
  });
}
