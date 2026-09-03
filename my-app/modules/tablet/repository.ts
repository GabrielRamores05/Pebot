// modules/tablet/repository.ts — tablet-gateway read model (spec 013 Phase 2).
// This is the ONLY module file that imports the Prisma client for the tablet
// gateway; routes stay thin and call modules/tablet/service.ts.

import { prisma } from '@/lib/prisma';

export type TabletRows = Record<string, any[]>;

/** Bootstrap snapshot of the shop's shared configuration/catalog so a tablet
 *  mirror can operate offline with the same menu, prices, stock and settings as
 *  the PC. Orders are intentionally excluded — they flow live over Socket.IO and
 *  through the push endpoints, not through this bootstrap payload. */
export async function findTabletSnapshotRows(): Promise<TabletRows> {
  const [
    categories,
    products,
    productIngredients,
    optionGroups,
    productOptions,
    productOptionGroups,
    ingredients,
    suppliers,
    ingredientTransactions,
    restaurantTables,
    businessSettings,
    staffUsers,
    loyaltyVouchers,
    loyaltySettings,
    expenseCategories,
    reviews,
  ] = await Promise.all([
    prisma.category.findMany({ orderBy: { sortOrder: 'asc' } }),
    prisma.product.findMany(),
    prisma.productIngredient.findMany(),
    prisma.optionGroup.findMany(),
    prisma.productOption.findMany(),
    prisma.productOptionGroup.findMany(),
    prisma.ingredient.findMany(),
    prisma.supplier.findMany(),
    // Spec 014 (contracts/bridge-schema.md): exported snapshots carry the full
    // ingredient ledger — supplier-linked purchases (`referenceType='supplier'`
    // + `referenceId`), batch adjustments and VOID_PURCHASE rows — so a tablet
    // mirror shows the same history/trends as the PC. Ingredient rows already
    // carry the web `supplierId` (latest-supplier cache).
    prisma.ingredientTransaction.findMany({ orderBy: { id: 'asc' } }),
    prisma.restaurantTable.findMany(),
    prisma.businessSettings.findMany(),
    prisma.user.findMany(),
    prisma.loyaltyVoucher.findMany(),
    prisma.loyaltySetting.findMany(),
    prisma.expenseCategory.findMany(),
    prisma.review.findMany(),
  ]);

  return {
    categories: categories as any[],
    products: products as any[],
    productIngredients: productIngredients as any[],
    optionGroups: optionGroups as any[],
    productOptions: productOptions as any[],
    productOptionGroups: productOptionGroups as any[],
    ingredients: ingredients as any[],
    suppliers: suppliers as any[],
    ingredientTransactions: ingredientTransactions as any[],
    restaurantTables: restaurantTables as any[],
    businessSettings: businessSettings as any[],
    staffUsers: staffUsers as any[],
    loyaltyVouchers: loyaltyVouchers as any[],
    loyaltySettings: loyaltySettings as any[],
    expenseCategories: expenseCategories as any[],
    reviews: reviews as any[],
  };
}
