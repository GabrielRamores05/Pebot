import { describe, expect, test } from 'vitest';
import { STATIONS, getItemStation, groupByStation } from '../../lib/kitchen-stations';
import type { StationOrder, StationOrderItem } from '../../lib/kitchen-stations';

function item(id: number, name: string, stationType?: string, quantity = 1): StationOrderItem {
  return { id, quantity, product: { name, stationType } };
}

function order(id: number, items: StationOrderItem[]): StationOrder {
  return {
    id,
    orderNumber: `ORD-${id}`,
    customerName: 'Ana',
    status: 'PENDING',
    totalAmount: 100,
    createdAt: '2026-01-01T08:00:00.000Z',
    items,
  };
}

describe('STATIONS', () => {
  test('lists the five stations with unique keys', () => {
    expect(STATIONS.map((s) => s.key)).toEqual(['coffee', 'kitchen', 'bar', 'pastry', 'general']);
    expect(new Set(STATIONS.map((s) => s.key)).size).toBe(STATIONS.length);
  });
});

describe('getItemStation', () => {
  test('matches a known station regardless of case', () => {
    expect(getItemStation(item(1, 'Latte', 'coffee'))).toBe('coffee');
    expect(getItemStation(item(1, 'Latte', 'COFFEE'))).toBe('coffee');
    expect(getItemStation(item(1, 'Fries', 'Kitchen'))).toBe('kitchen');
  });

  test('falls back to general for missing or unknown stations', () => {
    expect(getItemStation(item(1, 'Mug'))).toBe('general');
    expect(getItemStation(item(1, 'Mug', ''))).toBe('general');
    expect(getItemStation(item(1, 'Mug', 'dishwashing'))).toBe('general');
  });
});

describe('groupByStation', () => {
  test('returns an entry for every station even with no orders', () => {
    const grouped = groupByStation([]);
    expect(Object.keys(grouped).sort()).toEqual(['bar', 'coffee', 'general', 'kitchen', 'pastry']);
    expect(Object.values(grouped).every((entries) => entries.length === 0)).toBe(true);
  });

  test('an order appears at each station it has items for, with only that station\'s items', () => {
    const mixed = order(1, [
      item(10, 'Latte', 'coffee'),
      item(11, 'Croissant', 'pastry'),
      item(12, 'Espresso', 'coffee'),
    ]);

    const grouped = groupByStation([mixed]);

    expect(grouped.coffee).toHaveLength(1);
    expect(grouped.coffee[0].order).toBe(mixed);
    expect(grouped.coffee[0].items.map((i) => i.id)).toEqual([10, 12]);
    expect(grouped.pastry[0].items.map((i) => i.id)).toEqual([11]);
    expect(grouped.kitchen).toHaveLength(0);
    expect(grouped.bar).toHaveLength(0);
    expect(grouped.general).toHaveLength(0);
  });

  test('groups several orders per station in input order', () => {
    const first = order(1, [item(10, 'Latte', 'coffee')]);
    const second = order(2, [item(20, 'Mocha', 'coffee'), item(21, 'Burger', 'kitchen')]);

    const grouped = groupByStation([first, second]);

    expect(grouped.coffee.map((entry) => entry.order.id)).toEqual([1, 2]);
    expect(grouped.kitchen.map((entry) => entry.order.id)).toEqual([2]);
  });

  test('items with no station land under general', () => {
    const grouped = groupByStation([order(3, [item(30, 'Tumbler')])]);
    expect(grouped.general.map((entry) => entry.order.id)).toEqual([3]);
    expect(grouped.general[0].items.map((i) => i.id)).toEqual([30]);
  });
});
