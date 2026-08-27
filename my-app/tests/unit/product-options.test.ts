import { beforeEach, describe, expect, test, vi } from 'vitest';

const { findMany } = vi.hoisted(() => ({
  findMany: vi.fn(),
}));

vi.mock('@/lib/prisma', () => ({
  prisma: {
    productOption: { findMany },
  },
}));

import {
  resolveSelections,
  selectionsIngredientDeltas,
  selectionsLabel,
  selectionsLabelFromJson,
  selectionsPriceAdder,
} from '../../lib/product-options';
import type { ResolvedSelection } from '../../lib/product-options';

function selection(partial: Partial<ResolvedSelection> = {}): ResolvedSelection {
  return {
    optionId: 1,
    groupId: 10,
    groupName: 'Size',
    selectionType: 'single',
    name: 'Large',
    priceDelta: 20,
    ingredientDeltas: [],
    ...partial,
  };
}

describe('resolveSelections', () => {
  beforeEach(() => {
    findMany.mockReset();
  });

  test('ignores non-arrays and arrays without valid positive IDs', async () => {
    await expect(resolveSelections(5, null)).resolves.toEqual([]);
    await expect(resolveSelections(5, [0, -1, 'invalid'])).resolves.toEqual([]);
    expect(findMany).not.toHaveBeenCalled();
  });

  test('deduplicates IDs and resolves trusted option data', async () => {
    findMany.mockResolvedValue([
      {
        id: 2,
        groupId: 20,
        name: 'Extra Shot',
        priceDelta: null,
        available: true,
        group: { id: 20, name: 'Add-ons', selectionType: 'multi' },
        ingredients: [{ ingredientId: 7, deltaQty: 18 }],
      },
      {
        id: 3,
        groupId: 10,
        name: 'Large',
        priceDelta: 25,
        available: true,
        group: { id: 10, name: 'Size', selectionType: 'single' },
        ingredients: [{ ingredientId: 8, deltaQty: 50 }],
      },
    ]);

    await expect(resolveSelections(9, ['2', 2, 3])).resolves.toEqual([
      selection({
        optionId: 2,
        groupId: 20,
        groupName: 'Add-ons',
        selectionType: 'multi',
        name: 'Extra Shot',
        priceDelta: 0,
        ingredientDeltas: [{ ingredientId: 7, deltaQty: 18 }],
      }),
      selection({
        optionId: 3,
        name: 'Large',
        priceDelta: 25,
        ingredientDeltas: [{ ingredientId: 8, deltaQty: 50 }],
      }),
    ]);
    expect(findMany).toHaveBeenCalledWith({
      where: { id: { in: [2, 3] }, productId: 9 },
      include: {
        group: { select: { id: true, name: true, selectionType: true } },
        ingredients: { select: { ingredientId: true, deltaQty: true } },
      },
    });
  });

  test('rejects missing, unavailable, and duplicate single-choice options', async () => {
    findMany.mockResolvedValueOnce([]);
    await expect(resolveSelections(9, [1])).rejects.toThrow(
      'One or more selected options do not exist',
    );

    findMany.mockResolvedValueOnce([
      {
        id: 1,
        groupId: 10,
        name: 'Large',
        available: false,
        group: { id: 10, name: 'Size', selectionType: 'single' },
        ingredients: [],
      },
    ]);
    await expect(resolveSelections(9, [1])).rejects.toThrow(
      'Option "Large" is currently unavailable',
    );

    findMany.mockResolvedValueOnce([
      {
        id: 1,
        groupId: 10,
        name: 'Small',
        available: true,
        group: { id: 10, name: 'Size', selectionType: 'single' },
        ingredients: [],
      },
      {
        id: 2,
        groupId: 10,
        name: 'Large',
        available: true,
        group: { id: 10, name: 'Size', selectionType: 'single' },
        ingredients: [],
      },
    ]);
    await expect(resolveSelections(9, [1, 2])).rejects.toThrow(
      'Only one "Size" option can be chosen',
    );
  });

  test('allows multiple selections from a multi-choice group', async () => {
    findMany.mockResolvedValue([
      {
        id: 1,
        groupId: 20,
        name: 'Syrup',
        priceDelta: 10,
        available: true,
        group: { id: 20, name: 'Add-ons', selectionType: 'multi' },
        ingredients: [],
      },
      {
        id: 2,
        groupId: 20,
        name: 'Shot',
        priceDelta: 15,
        available: true,
        group: { id: 20, name: 'Add-ons', selectionType: 'multi' },
        ingredients: [],
      },
    ]);

    await expect(resolveSelections(9, [1, 2])).resolves.toHaveLength(2);
  });
});

describe('selection formatting and totals', () => {
  test('sums price adders and ingredient deltas', () => {
    const selections = [
      selection({
        priceDelta: 20,
        ingredientDeltas: [
          { ingredientId: 1, deltaQty: 18 },
          { ingredientId: 2, deltaQty: 50 },
        ],
      }),
      selection({
        optionId: 2,
        priceDelta: 0,
        ingredientDeltas: [
          { ingredientId: 1, deltaQty: 9 },
          { ingredientId: 3, deltaQty: -10 },
        ],
      }),
    ];

    expect(selectionsPriceAdder(selections)).toBe(20);
    expect(Object.fromEntries(selectionsIngredientDeltas(selections))).toEqual({
      1: 27,
      2: 50,
      3: -10,
    });
  });

  test('formats selections and marks priced add-ons', () => {
    expect(selectionsLabel([])).toBe('');
    expect(
      selectionsLabel([
        selection({ name: 'Large', priceDelta: 20 }),
        selection({ optionId: 2, name: 'Hot', priceDelta: 0 }),
      ]),
    ).toBe(' (+Large · Hot)');
  });

  test('formats stored JSON safely', () => {
    expect(selectionsLabelFromJson('[{"name":"Large"},{"name":"Hot"}]')).toBe(
      ' (Large · Hot)',
    );
    expect(selectionsLabelFromJson('[]')).toBe('');
    expect(selectionsLabelFromJson('invalid')).toBe('');
    expect(selectionsLabelFromJson(null)).toBe('');
  });
});
