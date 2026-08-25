import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  calcSellableQuantity,
  calcStatus,
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
  assert.equal(res.sellable, 10);
  assert.equal(res.limitingIngredientId, 2); // milk is the limiter
  assert.equal(res.breakdown.length, 2);
  assert.equal(res.breakdown[0].servings, 55);
  assert.equal(res.breakdown[1].servings, 10);
});

test('optional ingredients do NOT gate sellable quantity', () => {
  // Americano: beans required (1000g / 18 => 55), sugar optional (0g) => still 55
  const recipe = [
    r({ ingredientId: 1, name: 'Coffee Beans', quantity: 18, required: true, currentStock: 1000 }),
    r({ ingredientId: 3, name: 'Sugar', quantity: 10, required: false, currentStock: 0 }),
  ];
  const res = calcSellableQuantity(recipe);
  assert.equal(res.sellable, 55);
  assert.equal(res.limitingIngredientId, 1);
  // optional ingredient still reported in breakdown
  assert.equal(res.breakdown.find(b => b.ingredientId === 3)?.servings, 0);
});

test('no required ingredients => unlimited (recipe-less product)', () => {
  const recipe = [
    r({ ingredientId: 3, name: 'Sugar', quantity: 10, required: false, currentStock: 5 }),
  ];
  const res = calcSellableQuantity(recipe);
  assert.equal(res.sellable, Infinity);
  assert.equal(res.limitingIngredientId, null);
});

test('a required ingredient at 0 stock => out of stock', () => {
  const recipe = [
    r({ ingredientId: 1, name: 'Coffee Beans', quantity: 18, required: true, currentStock: 0 }),
    r({ ingredientId: 2, name: 'Milk', quantity: 150, required: true, currentStock: 1500 }),
  ];
  const res = calcSellableQuantity(recipe);
  assert.equal(res.sellable, 0);
  assert.equal(res.limitingIngredientId, 1);
});

test('calcStatus thresholds', () => {
  assert.equal(calcStatus(0, 10), 'OUT_OF_STOCK');
  assert.equal(calcStatus(5, 10), 'LOW_STOCK');
  assert.equal(calcStatus(10, 10), 'LOW_STOCK'); // at threshold boundary
  assert.equal(calcStatus(11, 10), 'IN_STOCK');
  assert.equal(calcStatus(100, 10), 'IN_STOCK');
});

test('sellable respects floor division (fractional stock)', () => {
  const recipe = [r({ ingredientId: 1, quantity: 18, required: true, currentStock: 95 })];
  const res = calcSellableQuantity(recipe);
  assert.equal(res.sellable, 5); // 95 / 18 = 5.27 => 5
});
