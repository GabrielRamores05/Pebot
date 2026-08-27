import { beforeEach, describe, expect, test, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  orderItemFindMany: vi.fn(),
  stationFindUnique: vi.fn(),
}));

vi.mock('@/lib/prisma', () => ({
  prisma: {
    orderItem: { findMany: mocks.orderItemFindMany },
    staffStationControl: { findUnique: mocks.stationFindUnique },
  },
}));

import { calculateOrderWaitTime, calculateStationWaitTime } from '../../lib/waitTime';

function queued(prepTimeMinutes: number, quantity = 1) {
  return { quantity, product: { prepTimeMinutes } };
}

beforeEach(() => {
  mocks.orderItemFindMany.mockReset();
  mocks.stationFindUnique.mockReset();
  mocks.orderItemFindMany.mockResolvedValue([]);
  mocks.stationFindUnique.mockResolvedValue(null);
});

describe('calculateStationWaitTime', () => {
  test('counts only pending/preparing orders created before the reference time', async () => {
    const asOf = new Date('2026-01-01T08:30:00.000Z');
    await calculateStationWaitTime('coffee', asOf);

    expect(mocks.orderItemFindMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          order: { status: { in: ['PENDING', 'PREPARING'] }, createdAt: { lt: asOf } },
          product: { stationType: 'coffee' },
        },
      }),
    );
  });

  test('is zero with an empty queue, and does not ask about staffing', async () => {
    await expect(calculateStationWaitTime('coffee')).resolves.toBe(0);
    expect(mocks.stationFindUnique).not.toHaveBeenCalled();
  });

  test('sums prep time across quantities, one barista by default', async () => {
    mocks.orderItemFindMany.mockResolvedValue([queued(3, 2), queued(4)]);

    await expect(calculateStationWaitTime('coffee')).resolves.toBe(10);
    expect(mocks.stationFindUnique).toHaveBeenCalledWith({ where: { stationType: 'coffee' } });
  });

  test('divides the queue across the staff on duty, rounding up', async () => {
    mocks.orderItemFindMany.mockResolvedValue([queued(5, 2)]);
    mocks.stationFindUnique.mockResolvedValue({ staffCount: 3 });

    // 10 minutes of work over 3 staff => ceil(3.33) = 4
    await expect(calculateStationWaitTime('coffee')).resolves.toBe(4);
  });

  test('a station with zero staff is treated as one, never dividing by zero', async () => {
    mocks.orderItemFindMany.mockResolvedValue([queued(6)]);
    mocks.stationFindUnique.mockResolvedValue({ staffCount: 0 });

    await expect(calculateStationWaitTime('kitchen')).resolves.toBe(6);
  });

  test('items with zero prep time leave no wait', async () => {
    mocks.orderItemFindMany.mockResolvedValue([queued(0, 5)]);

    await expect(calculateStationWaitTime('pastry')).resolves.toBe(0);
  });
});

describe('calculateOrderWaitTime', () => {
  test('adds the order\'s own prep time to the queue wait, per station', async () => {
    mocks.orderItemFindMany.mockResolvedValue([queued(4)]); // 4 min queued at each station

    const result = await calculateOrderWaitTime([
      { stationType: 'coffee', prepTimeMinutes: 3, quantity: 2 },
      { stationType: 'kitchen', prepTimeMinutes: 10, quantity: 1 },
    ]);

    expect(result.perStation).toEqual({ coffee: 10, kitchen: 14 });
    expect(result.maxWait).toBe(14);
  });

  test('queries each station once even when the order repeats it', async () => {
    const result = await calculateOrderWaitTime([
      { stationType: 'coffee', prepTimeMinutes: 3, quantity: 1 },
      { stationType: 'coffee', prepTimeMinutes: 2, quantity: 1 },
    ]);

    expect(mocks.orderItemFindMany).toHaveBeenCalledTimes(1);
    expect(result.perStation).toEqual({ coffee: 5 });
    expect(result.maxWait).toBe(5);
  });

  test('staffing shortens this order\'s own prep time too', async () => {
    mocks.stationFindUnique.mockResolvedValue({ staffCount: 2 });

    const result = await calculateOrderWaitTime([
      { stationType: 'bar', prepTimeMinutes: 5, quantity: 3 },
    ]);

    // no queue + ceil(15 / 2) = 8
    expect(result.perStation).toEqual({ bar: 8 });
  });

  test('an empty order has no wait', async () => {
    await expect(calculateOrderWaitTime([])).resolves.toEqual({ perStation: {}, maxWait: 0 });
  });
});
