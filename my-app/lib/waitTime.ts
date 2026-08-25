import { prisma } from '@/lib/prisma';

/**
 * Calculate the estimated wait time (in minutes) for a given station.
 *
 * Logic:
 *  1. Find all PENDING / PREPARING orders created before `asOf`.
 *  2. Sum `prepTimeMinutes` of their items that belong to the given station.
 *  3. Divide by the station's current `staffCount`.
 *
 * @param stationType  e.g. "coffee", "kitchen", "bar", "pastry", "general"
 * @param asOf         reference timestamp (defaults to now) — only orders
 *                     created *before* this time are counted in the queue.
 * @returns estimated wait in minutes (rounded up), minimum 0
 */
export async function calculateStationWaitTime(
  stationType: string,
  asOf: Date = new Date(),
): Promise<number> {
  // 1. Queued items at this station from orders that are still pending/preparing
  const queuedItems = await prisma.orderItem.findMany({
    where: {
      order: {
        status: { in: ['PENDING', 'PREPARING'] },
        createdAt: { lt: asOf },
      },
      product: {
        stationType: stationType,
      },
    },
    include: { product: { select: { prepTimeMinutes: true } } },
  });

  const totalPrepTime = queuedItems.reduce(
    (sum, item) => sum + item.product.prepTimeMinutes * item.quantity,
    0,
  );

  if (totalPrepTime === 0) return 0;

  // 2. Get staff count for this station (default to 1 if not configured)
  const station = await prisma.staffStationControl.findUnique({
    where: { stationType },
  });
  const staffCount = Math.max(station?.staffCount ?? 1, 1); // never divide by 0

  // 3. Estimated wait = queued prep time / staff on duty
  return Math.ceil(totalPrepTime / staffCount);
}

/**
 * Calculate estimated wait times for an entire order (all its items).
 * Returns the per-station breakdown and the overall max wait.
 */
export async function calculateOrderWaitTime(
  orderItemStations: Array<{ stationType: string; prepTimeMinutes: number; quantity: number }>,
  asOf: Date = new Date(),
): Promise<{ perStation: Record<string, number>; maxWait: number }> {
  // Collect unique stations involved in this order
  const stationTypes = [...new Set(orderItemStations.map((i) => i.stationType))];

  // Get queue wait + this order's own prep per station
  const perStation: Record<string, number> = {};

  for (const st of stationTypes) {
    const queueWait = await calculateStationWaitTime(st, asOf);
    // Add prep time for *this* order's items at the station
    const ownPrep = orderItemStations
      .filter((i) => i.stationType === st)
      .reduce((sum, i) => sum + i.prepTimeMinutes * i.quantity, 0);

    // Get staff count for division of own prep time
    const station = await prisma.staffStationControl.findUnique({
      where: { stationType: st },
    });
    const staffCount = Math.max(station?.staffCount ?? 1, 1);

    perStation[st] = queueWait + Math.ceil(ownPrep / staffCount);
  }

  // The order is ready when the slowest station finishes
  const maxWait = Math.max(...Object.values(perStation), 0);

  return { perStation, maxWait };
}
