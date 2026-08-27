import { describe, expect, test, vi } from 'vitest';
import {
  calcProductionCapacity,
  calcSellableQuantity,
  calcStatus,
  computeProductCapitalCost,
  fetchRecipe,
  getSellableQuantity,
  productsUsingIngredient,
  recomputeProduct,
  recomputeProducts,
} from '../../lib/availability';
import type { RecipeItemInfo, StockTx } from '../../lib/availability';

function r(partial: Partial<RecipeItemInfo>): RecipeItemInfo {
  return {
    ingredientId: 1,
    name: 'Ingredient',
    baseUnit: 'g',
    quantity: 10,
    required: true,
    currentStock: 0,
    ...partial,
  };
}

test('sellable = floor(min over required ingredients)', () => {
  // 1000g beans @ 18g per product => 55 ; 1500ml milk @ 150ml => 10 => min = 10
  const recipe = [
    r({ ingredientId: 1, name: 'Coffee Beans', baseUnit: 'g', quantity: 18, required: true, currentStock: 1000 }),
    r({ ingredientId: 2, name: 'Milk', baseUnit: 'ml', quantity: 150, required: true, currentStock: 1500 }),
  ];
  const res = calcSellableQuantity(recipe);
  expect(res.sellable).toBe(10);
  expect(res.limitingIngredientId).toBe(2); // milk is the limiter
  expect(res.breakdown).toHaveLength(2);
  expect(res.breakdown[0].servings).toBe(55);
  expect(res.breakdown[1].servings).toBe(10);
});

test('optional ingredients do NOT gate sellable quantity', () => {
  // Americano: beans required (1000g / 18 => 55), sugar optional (0g) => still 55
  const recipe = [
    r({ ingredientId: 1, name: 'Coffee Beans', quantity: 18, required: true, currentStock: 1000 }),
    r({ ingredientId: 3, name: 'Sugar', quantity: 10, required: false, currentStock: 0 }),
  ];
  const res = calcSellableQuantity(recipe);
  expect(res.sellable).toBe(55);
  expect(res.limitingIngredientId).toBe(1);
  // optional ingredient still reported in breakdown
  expect(res.breakdown.find(b => b.ingredientId === 3)?.servings).toBe(0);
});

test('no required ingredients => unlimited (recipe-less product)', () => {
  const recipe = [
    r({ ingredientId: 3, name: 'Sugar', quantity: 10, required: false, currentStock: 5 }),
  ];
  const res = calcSellableQuantity(recipe);
  expect(res.sellable).toBe(Infinity);
  expect(res.limitingIngredientId).toBeNull();
});

test('a required ingredient at 0 stock => out of stock', () => {
  const recipe = [
    r({ ingredientId: 1, name: 'Coffee Beans', quantity: 18, required: true, currentStock: 0 }),
    r({ ingredientId: 2, name: 'Milk', quantity: 150, required: true, currentStock: 1500 }),
  ];
  const res = calcSellableQuantity(recipe);
  expect(res.sellable).toBe(0);
  expect(res.limitingIngredientId).toBe(1);
});

test('calcStatus thresholds', () => {
  expect(calcStatus(0, 10)).toBe('OUT_OF_STOCK');
  expect(calcStatus(5, 10)).toBe('LOW_STOCK');
  expect(calcStatus(10, 10)).toBe('LOW_STOCK'); // at threshold boundary
  expect(calcStatus(11, 10)).toBe('IN_STOCK');
  expect(calcStatus(100, 10)).toBe('IN_STOCK');
});

test('sellable respects floor division (fractional stock)', () => {
  const recipe = [r({ ingredientId: 1, quantity: 18, required: true, currentStock: 95 })];
  const res = calcSellableQuantity(recipe);
  expect(res.sellable).toBe(5); // 95 / 18 = 5.27 => 5
});

test('capital cost includes every recipe line and tolerates missing costs', () => {
  const recipe = [
    r({ quantity: 18, costPerUnit: 0.75 }),
    r({ ingredientId: 2, quantity: 150, costPerUnit: 0.08 }),
    r({ ingredientId: 3, quantity: 10 }),
  ];

  expect(computeProductCapitalCost(recipe)).toBe(25.5);
});

// ── DB-backed helpers ───────────────────────────────────────────────────
// The Prisma transaction client is stood in for: these helpers only read the
// recipe rows and write back the derived caches.

function recipeRow(partial: {
  ingredientId?: number;
  name?: string;
  baseUnit?: string;
  quantity?: number;
  required?: boolean | null;
  currentStock?: number | null;
  costPerUnit?: number | null;
}) {
  return {
    ingredientId: partial.ingredientId ?? 1,
    quantity: partial.quantity ?? 10,
    required: partial.required,
    ingredient: {
      name: partial.name ?? 'Coffee Beans',
      baseUnit: partial.baseUnit ?? 'g',
      currentStock: partial.currentStock,
      costPerUnit: partial.costPerUnit,
    },
  };
}

function fakeTx(rows: unknown[] = [], products: unknown[] = []) {
  const tx = {
    productIngredient: { findMany: vi.fn().mockResolvedValue(rows) },
    product: {
      update: vi.fn().mockResolvedValue({}),
      findMany: vi.fn().mockResolvedValue(products),
    },
    inventory: { upsert: vi.fn().mockResolvedValue({}) },
  };
  return tx as unknown as StockTx & typeof tx;
}

describe('fetchRecipe', () => {
  test('maps recipe rows and defaults required/stock/cost', async () => {
    const tx = fakeTx([
      recipeRow({ ingredientId: 1, quantity: 18, currentStock: 900, costPerUnit: 0.5 }),
      recipeRow({ ingredientId: 2, name: 'Milk', baseUnit: 'ml', quantity: 150, required: null, currentStock: null, costPerUnit: null }),
    ]);

    const recipe = await fetchRecipe(tx, 4);

    expect(tx.productIngredient.findMany).toHaveBeenCalledWith({
      where: { productId: 4 },
      include: { ingredient: true },
    });
    expect(recipe).toEqual([
      { ingredientId: 1, name: 'Coffee Beans', baseUnit: 'g', quantity: 18, required: true, currentStock: 900, costPerUnit: 0.5 },
      { ingredientId: 2, name: 'Milk', baseUnit: 'ml', quantity: 150, required: true, currentStock: 0, costPerUnit: 0 },
    ]);
  });

  test('an optional recipe line stays optional', async () => {
    const tx = fakeTx([recipeRow({ required: false })]);
    expect((await fetchRecipe(tx, 4))[0].required).toBe(false);
  });

  test('a product with no recipe has an empty one', async () => {
    const tx = fakeTx();
    await expect(fetchRecipe(tx, 4)).resolves.toEqual([]);
  });
});

describe('getSellableQuantity', () => {
  test('derives the sellable count from the stored recipe', async () => {
    const tx = fakeTx([recipeRow({ quantity: 18, currentStock: 900 })]);
    await expect(getSellableQuantity(tx, 4)).resolves.toBe(50);
  });

  test('a recipe-less product is unlimited, expressed as MAX_SAFE_INTEGER for the DB', async () => {
    const tx = fakeTx();
    await expect(getSellableQuantity(tx, 4)).resolves.toBe(Number.MAX_SAFE_INTEGER);
  });
});

describe('productsUsingIngredient', () => {
  test('returns each product once, however many recipe lines mention it', async () => {
    const tx = fakeTx();
    tx.productIngredient.findMany.mockResolvedValue([
      { productId: 3 },
      { productId: 5 },
      { productId: 3 },
    ]);

    await expect(productsUsingIngredient(tx, 7)).resolves.toEqual([3, 5]);
    expect(tx.productIngredient.findMany).toHaveBeenCalledWith({
      where: { ingredientId: 7 },
      select: { productId: true },
    });
  });
});

describe('recomputeProduct', () => {
  test('persists the derived capital cost and the sellable cache', async () => {
    const tx = fakeTx([
      recipeRow({ ingredientId: 1, quantity: 18, currentStock: 900, costPerUnit: 0.5 }),
      recipeRow({ ingredientId: 2, name: 'Milk', quantity: 150, currentStock: 1500, costPerUnit: 0.1 }),
    ]);

    await recomputeProduct(tx, 4);

    expect(tx.product.update).toHaveBeenCalledWith({
      where: { id: 4 },
      data: { capitalCost: 24 },
    });
    expect(tx.inventory.upsert).toHaveBeenCalledWith({
      where: { productId: 4 },
      update: { quantity: 10 },
      create: { productId: 4, quantity: 10 },
    });
  });

  test('a recipe-less product keeps its manually managed quantity', async () => {
    const tx = fakeTx();

    await recomputeProduct(tx, 4);

    expect(tx.product.update).toHaveBeenCalledWith({ where: { id: 4 }, data: { capitalCost: 0 } });
    expect(tx.inventory.upsert).not.toHaveBeenCalled();
  });

  test('an over-drawn ingredient never caches a negative sellable quantity', async () => {
    const tx = fakeTx([recipeRow({ quantity: 18, currentStock: -36 })]);

    await recomputeProduct(tx, 4);

    expect(tx.inventory.upsert).toHaveBeenCalledWith(
      expect.objectContaining({ update: { quantity: 0 } }),
    );
  });
});

describe('recomputeProducts', () => {
  test('recomputes only the products asked for', async () => {
    const tx = fakeTx([recipeRow({ quantity: 10, currentStock: 100 })]);

    await recomputeProducts(tx, [1, 2]);

    expect(tx.product.findMany).not.toHaveBeenCalled();
    expect(tx.product.update.mock.calls.map((c) => c[0].where.id)).toEqual([1, 2]);
  });

  test('recomputes every product when the list is omitted or empty', async () => {
    const tx = fakeTx([recipeRow({ quantity: 10, currentStock: 100 })], [{ id: 8 }, { id: 9 }]);

    await recomputeProducts(tx);
    expect(tx.product.update.mock.calls.map((c) => c[0].where.id)).toEqual([8, 9]);

    tx.product.update.mockClear();
    await recomputeProducts(tx, []);
    expect(tx.product.update.mock.calls.map((c) => c[0].where.id)).toEqual([8, 9]);
  });
});

describe('calcProductionCapacity', () => {
  function product(partial: {
    id: number;
    name: string;
    available?: boolean;
    lowStockThreshold?: number;
    ingredients?: unknown[];
  }) {
    return {
      id: partial.id,
      name: partial.name,
      available: partial.available,
      inventory: { lowStockThreshold: partial.lowStockThreshold, quantity: 0 },
      ingredients: partial.ingredients ?? [],
    };
  }

  test('reports the limiting ingredient and the stock status per product', async () => {
    const tx = fakeTx([], [
      product({
        id: 1,
        name: 'Latte',
        lowStockThreshold: 5,
        ingredients: [
          recipeRow({ ingredientId: 1, quantity: 18, currentStock: 900 }),
          recipeRow({ ingredientId: 2, name: 'Milk', baseUnit: 'ml', quantity: 150, currentStock: 450 }),
        ],
      }),
    ]);

    const [latte] = await calcProductionCapacity(tx);

    expect(latte).toMatchObject({
      productId: 1,
      productName: 'Latte',
      available: true,
      sellable: 3,
      limitingIngredientId: 2,
      limitingIngredient: 'Milk',
      status: 'LOW_STOCK',
      capacityThreshold: 5,
    });
    expect(latte.ingredients).toHaveLength(2);
  });

  test('a recipe-less product is unlimited and in stock', async () => {
    const tx = fakeTx([], [product({ id: 2, name: 'Mug' })]);

    const [mug] = await calcProductionCapacity(tx);

    expect(mug).toMatchObject({
      sellable: Number.MAX_SAFE_INTEGER,
      status: 'IN_STOCK',
      limitingIngredientId: null,
      limitingIngredient: null,
      capacityThreshold: 0,
    });
  });

  test('a product hidden from the menu is reported as unavailable', async () => {
    const tx = fakeTx([], [product({ id: 3, name: 'Seasonal', available: false })]);
    expect((await calcProductionCapacity(tx))[0].available).toBe(false);
  });

  test('an over-drawn product shows zero sellable and out of stock', async () => {
    const tx = fakeTx([], [
      product({
        id: 4,
        name: 'Americano',
        ingredients: [recipeRow({ ingredientId: 1, quantity: 18, currentStock: -18 })],
      }),
    ]);

    expect((await calcProductionCapacity(tx))[0]).toMatchObject({
      sellable: 0,
      status: 'OUT_OF_STOCK',
      limitingIngredient: 'Coffee Beans',
    });
  });
});
