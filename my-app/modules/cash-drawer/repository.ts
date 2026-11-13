import { prisma } from '@/lib/prisma';

// Cash drawer sessions (spec 017). One open session per location.

const withMovements = { movements: { orderBy: { createdAt: 'asc' as const } } };

export async function findOpenSession(locationId: number) {
  return prisma.cashSession.findFirst({ where: { locationId, closedAt: null }, include: withMovements });
}

export async function findSession(id: number, locationId: number) {
  return prisma.cashSession.findFirst({ where: { id, locationId }, include: withMovements });
}

/** Sessions opened within [from, to). */
export async function findSessionsOpenedBetween(locationId: number, from: Date, to: Date) {
  return prisma.cashSession.findMany({
    where: { locationId, openedAt: { gte: from, lt: to } },
    include: withMovements,
    orderBy: { openedAt: 'asc' },
  });
}

/** Totals of the cash orders counted in a session, cancelled ones left out. */
export async function findCashSaleAmounts(sessionId: number): Promise<number[]> {
  const orders = await prisma.order.findMany({
    where: { cashSessionId: sessionId, status: { not: 'CANCELLED' } },
    select: { totalAmount: true },
  });
  return orders.map((o) => o.totalAmount);
}

/** Opens a session unless one is already open; returns null when one is. */
export async function openSessionIfNoneOpen(data: {
  locationId: number;
  openedById: number | null;
  openedByName: string;
  openingCash: number;
  note?: string | null;
}) {
  return prisma.$transaction(async (tx) => {
    const open = await tx.cashSession.findFirst({ where: { locationId: data.locationId, closedAt: null } });
    if (open) return null;
    return tx.cashSession.create({ data, include: withMovements });
  });
}

export async function createMovement(data: {
  sessionId: number;
  kind: 'IN' | 'OUT';
  amount: number;
  reason: string;
  userId: number | null;
  userName: string;
}) {
  return prisma.cashMovement.create({ data });
}

/** Closes an open session; returns 0 when it was already closed. */
export async function closeOpenSession(
  id: number,
  data: { closedById: number | null; closedByName: string; countedCash: number; expectedCash: number; note?: string | null },
) {
  const result = await prisma.cashSession.updateMany({
    where: { id, closedAt: null },
    data: { ...data, closedAt: new Date() },
  });
  return result.count;
}
