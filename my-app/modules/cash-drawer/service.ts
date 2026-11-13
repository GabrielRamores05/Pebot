import { z } from 'zod';
import { fromZodError } from 'zod-validation-error';
import { drawerTotals, type DrawerTotals } from '@/lib/cash-drawer';
import { logAction } from '@/lib/audit-log';
import * as repo from '@/modules/cash-drawer/repository';

// Cash drawer count per shift (spec 017, US4).

const LOCATION_ID = 1;

export interface Staff {
  userId: number;
  name: string;
}

function parseInput<T>(schema: z.ZodSchema<T>, input: unknown): T {
  const result = schema.safeParse(input);
  if (!result.success) throw fromZodError(result.error);
  return result.data;
}

function fail(message: string, status: number): Error {
  const e = new Error(message);
  (e as unknown as { status: number }).status = status;
  return e;
}

const peso = z.number().finite().nonnegative().max(10_000_000);

export const OpenDrawerSchema = z.object({
  openingCash: peso,
  note: z.string().trim().max(500).optional(),
});

export const MovementSchema = z.object({
  kind: z.enum(['IN', 'OUT']),
  amount: peso.positive('Enter an amount above zero.'),
  reason: z.string().trim().min(1, 'Enter a reason.').max(200),
});

export const CloseDrawerSchema = z.object({
  countedCash: peso,
  note: z.string().trim().max(500).optional(),
});

type Session = NonNullable<Awaited<ReturnType<typeof repo.findSession>>>;

export interface DrawerView {
  id: number;
  openedAt: Date;
  openedByName: string;
  closedAt: Date | null;
  closedByName: string | null;
  countedCash: number | null;
  note: string | null;
  movements: Session['movements'];
  totals: DrawerTotals;
}

async function view(session: Session): Promise<DrawerView> {
  const cashSales = await repo.findCashSaleAmounts(session.id);
  const totals = drawerTotals(
    { openingCash: session.openingCash, cashSales, movements: session.movements },
    session.countedCash,
  );
  // A closed drawer shows what was expected when it was closed, even if an order changed later.
  if (session.closedAt && session.expectedCash != null) {
    totals.expectedCash = session.expectedCash;
    if (session.countedCash != null) {
      totals.overShort = Math.round((session.countedCash - session.expectedCash) * 100) / 100;
    }
  }
  return {
    id: session.id,
    openedAt: session.openedAt,
    openedByName: session.openedByName,
    closedAt: session.closedAt,
    closedByName: session.closedByName,
    countedCash: session.countedCash,
    note: session.note,
    movements: session.movements,
    totals,
  };
}

export async function currentDrawer(): Promise<DrawerView | null> {
  const session = await repo.findOpenSession(LOCATION_ID);
  return session ? view(session) : null;
}

export async function getDrawer(id: number): Promise<DrawerView> {
  const session = await repo.findSession(id, LOCATION_ID);
  if (!session) throw fail('Cash drawer not found.', 404);
  return view(session);
}

export async function openDrawer(input: unknown, staff: Staff): Promise<DrawerView> {
  const data = parseInput(OpenDrawerSchema, input);
  const session = await repo.openSessionIfNoneOpen({
    locationId: LOCATION_ID,
    openedById: staff.userId,
    openedByName: staff.name,
    openingCash: data.openingCash,
    note: data.note || null,
  });
  if (!session) throw fail('A cash drawer is already open. Close it before opening a new one.', 409);
  await logAction({
    userId: staff.userId,
    action: 'CASH_DRAWER_OPEN',
    resource: 'cash-drawer',
    resourceId: session.id,
    details: { openingCash: data.openingCash },
  });
  return view(session);
}

export async function recordMovement(input: unknown, staff: Staff): Promise<DrawerView> {
  const data = parseInput(MovementSchema, input);
  const session = await repo.findOpenSession(LOCATION_ID);
  if (!session) throw fail('No cash drawer is open.', 409);
  await repo.createMovement({
    sessionId: session.id,
    kind: data.kind,
    amount: data.amount,
    reason: data.reason,
    userId: staff.userId,
    userName: staff.name,
  });
  await logAction({
    userId: staff.userId,
    action: data.kind === 'IN' ? 'CASH_DRAWER_IN' : 'CASH_DRAWER_OUT',
    resource: 'cash-drawer',
    resourceId: session.id,
    details: { amount: data.amount, reason: data.reason },
  });
  return getDrawer(session.id);
}

export async function closeDrawer(input: unknown, staff: Staff): Promise<DrawerView> {
  const data = parseInput(CloseDrawerSchema, input);
  const session = await repo.findOpenSession(LOCATION_ID);
  if (!session) throw fail('No cash drawer is open.', 409);
  const { totals } = await view(session);
  const closed = await repo.closeOpenSession(session.id, {
    closedById: staff.userId,
    closedByName: staff.name,
    countedCash: data.countedCash,
    expectedCash: totals.expectedCash,
    note: [session.note, data.note].filter(Boolean).join('\n') || null,
  });
  if (closed !== 1) throw fail('This cash drawer was already closed.', 409);
  await logAction({
    userId: staff.userId,
    action: 'CASH_DRAWER_CLOSE',
    resource: 'cash-drawer',
    resourceId: session.id,
    details: {
      expectedCash: totals.expectedCash,
      countedCash: data.countedCash,
      overShort: Math.round((data.countedCash - totals.expectedCash) * 100) / 100,
    },
  });
  return getDrawer(session.id);
}

/** Drawers opened within [from, to), for the end-of-day summary. */
export async function drawersOpenedBetween(from: Date, to: Date): Promise<DrawerView[]> {
  const sessions = await repo.findSessionsOpenedBetween(LOCATION_ID, from, to);
  return Promise.all(sessions.map(view));
}
