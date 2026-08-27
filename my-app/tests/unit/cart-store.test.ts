import { beforeEach, describe, expect, test, vi } from 'vitest';

vi.mock('zustand/middleware', () => ({
  persist: (initializer: unknown) => initializer,
}));

import { lineKey, useCartStore } from '../../store/cartStore';

beforeEach(() => {
  useCartStore.setState({
    items: [],
    customerName: '',
    tableNumber: '',
  });
});

describe('lineKey', () => {
  test('uses sorted option IDs so equivalent configurations share a key', () => {
    const selections = [
      { optionId: 9, groupName: 'Add-ons', name: 'Shot', priceDelta: 20 },
      { optionId: 2, groupName: 'Size', name: 'Large', priceDelta: 15 },
    ];

    expect(lineKey(4, selections)).toBe('4::2,9');
    expect(lineKey(4)).toBe('4::');
    expect(selections.map((item) => item.optionId)).toEqual([9, 2]);
  });
});

describe('cart actions', () => {
  const baseItem = {
    productId: 1,
    name: 'Latte',
    price: 120,
  };
  const large = {
    optionId: 2,
    groupName: 'Size',
    name: 'Large',
    priceDelta: 20,
  };

  test('increments identical lines but keeps different configurations separate', () => {
    const store = useCartStore.getState();
    store.addItem(baseItem);
    store.addItem(baseItem);
    store.addItem({ ...baseItem, price: 140, selections: [large] });

    expect(useCartStore.getState().items).toEqual([
      { ...baseItem, quantity: 2 },
      { ...baseItem, price: 140, selections: [large], quantity: 1 },
    ]);
  });

  test('updates quantities and removes zero-quantity lines', () => {
    useCartStore.getState().addItem(baseItem);
    const key = lineKey(baseItem.productId);

    useCartStore.getState().updateQuantity(key, 3);
    expect(useCartStore.getState().items[0].quantity).toBe(3);

    useCartStore.getState().updateQuantity(key, 0);
    expect(useCartStore.getState().items).toEqual([]);
  });

  test('removes a line by its exact configuration', () => {
    const store = useCartStore.getState();
    store.addItem(baseItem);
    store.addItem({ ...baseItem, price: 140, selections: [large] });

    store.removeItem(lineKey(baseItem.productId, [large]));
    expect(useCartStore.getState().items).toEqual([
      { ...baseItem, quantity: 1 },
    ]);
  });

  test('reconfigures a line while preserving its quantity', () => {
    const store = useCartStore.getState();
    store.addItem(baseItem);
    store.updateQuantity(lineKey(baseItem.productId), 3);

    store.updateLine(lineKey(baseItem.productId), {
      ...baseItem,
      price: 140,
      selections: [large],
    });

    expect(useCartStore.getState().items).toEqual([
      { ...baseItem, price: 140, selections: [large], quantity: 3 },
    ]);
  });

  test('merges quantities when reconfiguration matches another line', () => {
    const store = useCartStore.getState();
    store.addItem(baseItem);
    store.addItem({ ...baseItem, price: 140, selections: [large] });
    store.updateQuantity(lineKey(baseItem.productId, [large]), 2);

    store.updateLine(
      lineKey(baseItem.productId),
      { ...baseItem, price: 140, selections: [large] },
      3,
    );

    expect(useCartStore.getState().items).toEqual([
      { ...baseItem, price: 140, selections: [large], quantity: 5 },
    ]);
  });

  test('calculates totals and clears customer and table details', () => {
    const store = useCartStore.getState();
    store.addItem(baseItem);
    store.addItem({ productId: 2, name: 'Cookie', price: 50 });
    store.updateQuantity(lineKey(baseItem.productId), 2);
    store.setCustomerName('Ana');
    store.setTableNumber('T1');

    expect(useCartStore.getState().total()).toBe(290);
    expect(useCartStore.getState().itemCount()).toBe(3);

    useCartStore.getState().clearCart();
    expect(useCartStore.getState()).toMatchObject({
      items: [],
      customerName: '',
      tableNumber: '',
    });
  });
});
