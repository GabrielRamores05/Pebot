import { expect, test } from 'vitest';
import {
  calcSellableQuantity,
  calcStatus,
  computeProductCapitalCost,
} from '../../lib/availability';
import type { RecipeItemInfo } from '../../lib/availability';

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
