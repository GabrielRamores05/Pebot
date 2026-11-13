import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  findOpenSession: vi.fn(),
  findSession: vi.fn(),
  findCashSaleAmounts: vi.fn(),
  openSessionIfNoneOpen: vi.fn(),
  createMovement: vi.fn(),
  closeOpenSession: vi.fn(),
  logAction: vi.fn(),
}));

vi.mock('@/modules/cash-drawer/repository', () => ({
  findOpenSession: mocks.findOpenSession,
  findSession: mocks.findSession,
  findCashSaleAmounts: mocks.findCashSaleAmounts,
  openSessionIfNoneOpen: mocks.openSessionIfNoneOpen,
  createMovement: mocks.createMovement,
  closeOpenSession: mocks.closeOpenSession,
}));
vi.mock('@/lib/audit-log', () => ({ logAction: mocks.logAction }));

import { closeDrawer, currentDrawer, openDrawer, recordMovement } from '@/modules/cash-drawer/service';

const staff = { userId: 7, name: 'Ana' };
const session = (over: Record<string, unknown> = {}) => ({
  id: 1,
  locationId: 1,
  openedAt: new Date('2026-11-14T08:00:00Z'),
  openedById: 7,
  openedByName: 'Ana',
  openingCash: 1000,
  closedAt: null,
  closedById: null,
  closedByName: null,
  countedCash: null,
  expectedCash: null,
  note: null,
  movements: [{ id: 1, sessionId: 1, kind: 'OUT', amount: 300, reason: 'Ice', userId: 7, userName: 'Ana', createdAt: new Date() }],
  ...over,
});

describe('cash drawer service (spec 017, US4)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.findCashSaleAmounts.mockResolvedValue([250, 180]);
  });

  it('shows the open drawer with expected cash (spec independent test)', async () => {
    mocks.findOpenSession.mockResolvedValue(session());
    const drawer = await currentDrawer();
    expect(drawer?.totals).toMatchObject({ openingCash: 1000, cashSales: 430, cashOut: 300, expectedCash: 1130 });
  });

  it('is null when no drawer is open', async () => {
    mocks.findOpenSession.mockResolvedValue(null);
    expect(await currentDrawer()).toBeNull();
  });

  it('opens a drawer and records who opened it', async () => {
    mocks.openSessionIfNoneOpen.mockResolvedValue(session({ movements: [] }));
    mocks.findCashSaleAmounts.mockResolvedValue([]);
    const drawer = await openDrawer({ openingCash: 1000 }, staff);
    expect(mocks.openSessionIfNoneOpen).toHaveBeenCalledWith(
      expect.objectContaining({ openingCash: 1000, openedById: 7, openedByName: 'Ana' }),
    );
    expect(drawer.totals.expectedCash).toBe(1000);
    expect(mocks.logAction).toHaveBeenCalledWith(expect.objectContaining({ action: 'CASH_DRAWER_OPEN' }));
  });

  it('refuses a second open drawer (US4 #2)', async () => {
    mocks.openSessionIfNoneOpen.mockResolvedValue(null);
    await expect(openDrawer({ openingCash: 500 }, staff)).rejects.toMatchObject({ status: 409 });
  });

  it('refuses a negative starting amount', async () => {
    await expect(openDrawer({ openingCash: -1 }, staff)).rejects.toThrow();
    expect(mocks.openSessionIfNoneOpen).not.toHaveBeenCalled();
  });

  it('refuses a pay-out without a reason (US4 #3)', async () => {
    mocks.findOpenSession.mockResolvedValue(session());
    await expect(recordMovement({ kind: 'OUT', amount: 300, reason: '  ' }, staff)).rejects.toThrow();
    expect(mocks.createMovement).not.toHaveBeenCalled();
  });

  it('records a pay-out with its reason', async () => {
    mocks.findOpenSession.mockResolvedValue(session());
    mocks.findSession.mockResolvedValue(session());
    await recordMovement({ kind: 'OUT', amount: 300, reason: 'Ice' }, staff);
    expect(mocks.createMovement).toHaveBeenCalledWith(
      expect.objectContaining({ sessionId: 1, kind: 'OUT', amount: 300, reason: 'Ice', userName: 'Ana' }),
    );
    expect(mocks.logAction).toHaveBeenCalledWith(expect.objectContaining({ action: 'CASH_DRAWER_OUT' }));
  });

  it('refuses cash in/out when no drawer is open', async () => {
    mocks.findOpenSession.mockResolvedValue(null);
    await expect(recordMovement({ kind: 'IN', amount: 100, reason: 'Change fund' }, staff)).rejects.toMatchObject({ status: 409 });
  });

  it('closes with the count and freezes expected cash (US4 #5)', async () => {
    mocks.findOpenSession.mockResolvedValue(session());
    mocks.closeOpenSession.mockResolvedValue(1);
    mocks.findSession.mockResolvedValue(
      session({ closedAt: new Date(), closedByName: 'Ana', countedCash: 1120, expectedCash: 1130 }),
    );
    const drawer = await closeDrawer({ countedCash: 1120 }, staff);
    expect(mocks.closeOpenSession).toHaveBeenCalledWith(1, expect.objectContaining({ countedCash: 1120, expectedCash: 1130 }));
    expect(drawer.totals.overShort).toBe(-10);
    expect(mocks.logAction).toHaveBeenCalledWith(
      expect.objectContaining({ action: 'CASH_DRAWER_CLOSE', details: expect.objectContaining({ overShort: -10 }) }),
    );
  });

  it('keeps the expected cash it had at close even if an order changes later', async () => {
    mocks.findCashSaleAmounts.mockResolvedValue([250]); // the ₱180 order was cancelled after closing
    mocks.findOpenSession.mockResolvedValue(session());
    mocks.closeOpenSession.mockResolvedValue(1);
    mocks.findSession.mockResolvedValue(session({ closedAt: new Date(), countedCash: 1120, expectedCash: 1130 }));
    const drawer = await closeDrawer({ countedCash: 1120 }, staff);
    expect(drawer.totals.expectedCash).toBe(1130);
  });

  it('refuses to close a drawer twice', async () => {
    mocks.findOpenSession.mockResolvedValue(session());
    mocks.closeOpenSession.mockResolvedValue(0);
    await expect(closeDrawer({ countedCash: 1000 }, staff)).rejects.toMatchObject({ status: 409 });
  });
});
