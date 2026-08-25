import { prisma } from '@/lib/prisma';
import { recomputeProducts, calcProductionCapacity } from '@/lib/availability';

async function main() {
  // Inspect current state
  const productCount = await prisma.product.count();
  const recipeCount = await prisma.productIngredient.count();
  console.log(`[backfill] products=${productCount} recipeRows=${recipeCount}`);

  // Recompute derived Inventory.quantity (sellable cache) for every product.
  await recomputeProducts(prisma);
  console.log('[backfill] recomputed all product Inventory.quantity from ingredient stock');

  // Show before/after snapshot via the capacity engine
  const before = await calcProductionCapacity(prisma);
  for (const e of before) {
    const qty = e.sellable >= Number.MAX_SAFE_INTEGER ? '∞' : e.sellable;
    console.log(
      `[capacity] ${e.productName} → sellable=${qty} status=${e.status} limiting=${e.limitingIngredient || '—'}`,
    );
  }

  await prisma.$disconnect();
  console.log('[backfill] done');
}

main().catch((e) => {
  console.error('[backfill] failed:', e);
  process.exit(1);
});
