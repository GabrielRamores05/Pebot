import { describe, it, expect, vi, beforeEach } from 'vitest';

const mocks = vi.hoisted(() => ({
  findAllTables: vi.fn(),
  createTable: vi.fn(),
  updateTable: vi.fn(),
  deleteTable: vi.fn(),
  findTableUnique: vi.fn(),
  findTableByName: vi.fn(),
  findTableBySlugUnique: vi.fn(),
  findActiveSessionByTableId: vi.fn(),
  findRememberedSession: vi.fn(),
  createSession: vi.fn(),
  updateSession: vi.fn(),
  createManyGuests: vi.fn(),
  findActiveGuestsBySessionId: vi.fn(),
  findActiveGuestsForExit: vi.fn(),
  clearTableGuestsAndSessions: vi.fn(),
  updateGuest: vi.fn(),
  findGuestById: vi.fn(),
  findGuestByDisplayName: vi.fn(),
  findMostRecentActiveGuest: vi.fn(),
  createGuest: vi.fn(),
  updateManyGuests: vi.fn(),
  findSessionUnique: vi.fn(),
}));

vi.mock('../../../modules/tables/repository', () => mocks);
vi.mock('@/lib/socket', () => ({ emitEvent: vi.fn() }));

import {
  listTables,
  createTable,
  updateTable,
  deleteTable,
  adjustOccupants,
  enterTable,
  exitTable,
  createGuest,
  updateGuest,
  requestClean,
  TableNotFoundError,
} from '../../../modules/tables/service';

describe('tables service', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('listTables', () => {
    it('calls repository with default locationId', async () => {
      mocks.findAllTables.mockResolvedValue([]);
      await listTables();
      expect(mocks.findAllTables).toHaveBeenCalledWith(1);
    });

    it('passes locationId through', async () => {
      mocks.findAllTables.mockResolvedValue([]);
      await listTables(42);
      expect(mocks.findAllTables).toHaveBeenCalledWith(42);
    });
  });

  describe('createTable', () => {
    it('creates table with slugified name and capacity 4', async () => {
      mocks.findTableBySlugUnique.mockResolvedValue(null);
      mocks.createTable.mockResolvedValue({ id: 1, name: 'Window', slug: 'window', capacity: 4 });
      const result = await createTable({ name: 'Window' });
      expect(mocks.createTable).toHaveBeenCalledWith(
        { name: 'Window', slug: 'window', capacity: 4 },
        1,
      );
      expect(result).toEqual({ id: 1, name: 'Window', slug: 'window', capacity: 4 });
    });

    it('uses provided capacity when positive', async () => {
      mocks.findTableBySlugUnique.mockResolvedValue(null);
      mocks.createTable.mockResolvedValue({ id: 1, name: 'Bar', slug: 'bar', capacity: 6 });
      await createTable({ name: 'Bar', capacity: 6 });
      expect(mocks.createTable).toHaveBeenCalledWith(
        expect.objectContaining({ name: 'Bar', capacity: 6 }),
        1,
      );
    });

    it('defaults capacity to 4 when not positive', async () => {
      mocks.findTableBySlugUnique.mockResolvedValue(null);
      mocks.createTable.mockResolvedValue({ id: 1, name: 'Corner', slug: 'corner', capacity: 4 });
      await createTable({ name: 'Corner', capacity: 0 });
      expect(mocks.createTable).toHaveBeenCalledWith(
        expect.objectContaining({ capacity: 4 }),
        1,
      );
    });

    it('appends suffix when slug is taken', async () => {
      mocks.findTableBySlugUnique
        .mockResolvedValueOnce({ id: 99, slug: 'window' })
        .mockResolvedValueOnce(null);
      mocks.createTable.mockResolvedValue({ id: 1, name: 'Window', slug: 'window-2', capacity: 4 });
      const result = await createTable({ name: 'Window' });
      expect(result.slug).toBe('window-2');
    });

    it('throws 400 when name is empty', async () => {
      await expect(createTable({ name: '   ' })).rejects.toMatchObject({ status: 400 });
    });

    it('throws 400 on unique constraint error', async () => {
      mocks.findTableBySlugUnique.mockResolvedValue(null);
      mocks.createTable.mockRejectedValue(new Error('P2002: unique constraint failed'));
      await expect(createTable({ name: 'Test' })).rejects.toMatchObject({ status: 400 });
    });
  });

  describe('updateTable', () => {
    it('updates table fields', async () => {
      mocks.updateTable.mockResolvedValue({ id: 1, name: 'Updated', status: 'AVAILABLE' });
      await updateTable({ id: 1, name: 'Updated' });
      expect(mocks.updateTable).toHaveBeenCalledWith(1, { name: 'Updated' }, 1);
    });

    it('throws 400 when no fields to update', async () => {
      await expect(updateTable({ id: 1 })).rejects.toMatchObject({ status: 400 });
    });

    it('throws ValidationError on missing id', async () => {
      await expect(updateTable({ name: 'Test' })).rejects.toThrow();
    });
  });

  describe('deleteTable', () => {
    it('throws TableNotFoundError when table does not exist', async () => {
      mocks.findTableUnique.mockResolvedValue(null);
      await expect(deleteTable({ id: 999 })).rejects.toThrow(TableNotFoundError);
    });

    it('deletes table when not occupied', async () => {
      mocks.findTableUnique.mockResolvedValue({ id: 1, status: 'AVAILABLE', name: 'Table 1' });
      mocks.deleteTable.mockResolvedValue({ id: 1 });
      const result = await deleteTable({ id: 1 });
      expect(mocks.deleteTable).toHaveBeenCalledWith(1, 1);
      expect(result).toEqual({ ok: true });
    });

    it('resets table before delete when occupied', async () => {
      mocks.findTableUnique.mockResolvedValue({ id: 1, status: 'OCCUPIED', name: 'Table 1' });
      mocks.updateTable.mockResolvedValue({});
      mocks.deleteTable.mockResolvedValue({ id: 1 });
      await deleteTable({ id: 1 });
      expect(mocks.updateTable).toHaveBeenCalledWith(
        1,
        { status: 'AVAILABLE', currentOccupants: 0, occupiedSince: null, assignedOrderId: null },
        1,
      );
      expect(mocks.deleteTable).toHaveBeenCalledWith(1, 1);
    });

    it('skips reset when force is false and status is AVAILABLE', async () => {
      mocks.findTableUnique.mockResolvedValue({ id: 1, status: 'AVAILABLE', name: 'Table 1' });
      mocks.deleteTable.mockResolvedValue({ id: 1 });
      await deleteTable({ id: 1, force: false });
      expect(mocks.updateTable).not.toHaveBeenCalled();
    });
  });

  describe('adjustOccupants', () => {
    it('throws TableNotFoundError when table does not exist', async () => {
      mocks.findTableUnique.mockResolvedValue(null);
      await expect(adjustOccupants({ id: 999 })).rejects.toThrow(TableNotFoundError);
    });

    it('handles clear action by resetting table', async () => {
      mocks.findTableUnique.mockResolvedValue({ id: 1, name: 'T1', status: 'OCCUPIED', currentOccupants: 3, occupiedSince: new Date() });
      mocks.findActiveSessionByTableId.mockResolvedValue({ id: 5, entryTime: new Date() });
      mocks.findActiveGuestsBySessionId.mockResolvedValue([]);
      mocks.clearTableGuestsAndSessions.mockResolvedValue(undefined);
      mocks.updateTable.mockResolvedValue({ id: 1, status: 'AVAILABLE', currentOccupants: 0 });
      const result = await adjustOccupants({ id: 1, action: 'clear' });
      expect(mocks.clearTableGuestsAndSessions).toHaveBeenCalledWith(1, 1);
      expect(result.status).toBe('AVAILABLE');
    });

    it('throws 400 on clear when active guests exist', async () => {
      mocks.findTableUnique.mockResolvedValue({ id: 1, name: 'T1', status: 'OCCUPIED', currentOccupants: 3, occupiedSince: new Date() });
      mocks.findActiveSessionByTableId.mockResolvedValue({ id: 5 });
      mocks.findActiveGuestsBySessionId.mockResolvedValue([{ id: 1 }]);
      await expect(adjustOccupants({ id: 1, action: 'clear' })).rejects.toMatchObject({ status: 400 });
    });

    it('handles add action by incrementing occupants', async () => {
      mocks.findTableUnique.mockResolvedValue({ id: 1, name: 'T1', status: 'AVAILABLE', currentOccupants: 0, capacity: 4, occupiedSince: null });
      mocks.updateTable.mockResolvedValue({ id: 1, status: 'OCCUPIED', currentOccupants: 1 });
      const result = await adjustOccupants({ id: 1, action: 'add' });
      expect(mocks.updateTable).toHaveBeenCalledWith(1, { currentOccupants: 1, status: 'OCCUPIED', occupiedSince: expect.any(Date) }, 1);
      expect(result.status).toBe('OCCUPIED');
    });

    it('handles set action by clamping to capacity', async () => {
      mocks.findTableUnique.mockResolvedValue({ id: 1, name: 'T1', status: 'AVAILABLE', currentOccupants: 0, capacity: 4, occupiedSince: null });
      mocks.updateTable.mockResolvedValue({ id: 1, status: 'OCCUPIED', currentOccupants: 4 });
      const result = await adjustOccupants({ id: 1, action: 'set', occupantCount: 10 });
      expect(mocks.updateTable).toHaveBeenCalledWith(1, { currentOccupants: 4, status: 'OCCUPIED', occupiedSince: expect.any(Date) }, 1);
    });
  });

  describe('enterTable', () => {
    it('throws TableNotFoundError when table does not exist', async () => {
      mocks.findTableUnique.mockResolvedValue(null);
      await expect(enterTable({ tableId: 999, occupants: 2, customerName: 'Alice' })).rejects.toThrow(TableNotFoundError);
    });

    it('throws 400 when capacity is exceeded', async () => {
      mocks.findTableUnique.mockResolvedValue({ id: 1, name: 'T1', currentOccupants: 4, capacity: 4 });
      await expect(enterTable({ tableId: 1, occupants: 1, customerName: 'Alice' })).rejects.toMatchObject({ status: 400 });
    });

    it('creates a new session and guests when no remembered session', async () => {
      mocks.findTableUnique.mockResolvedValue({ id: 1, name: 'T1', currentOccupants: 0, capacity: 4, occupiedSince: null });
      mocks.createSession.mockResolvedValue({ id: 5, occupants: 2 });
      mocks.createManyGuests.mockResolvedValue({});
      mocks.findActiveGuestsBySessionId.mockResolvedValue([
        { id: 1, displayName: 'Alice' },
        { id: 2, displayName: 'Alice' },
      ]);
      mocks.updateTable.mockResolvedValue({ id: 1, status: 'OCCUPIED', currentOccupants: 2, occupiedSince: new Date() });
      const result = await enterTable({ tableId: 1, occupants: 2, customerName: 'Alice' });
      expect(mocks.createSession).toHaveBeenCalledWith({ tableId: 1, occupants: 2 });
      expect(mocks.createManyGuests).toHaveBeenCalledWith([
        expect.objectContaining({ tableId: 1, sessionId: 5, displayName: 'Alice', active: true }),
        expect.objectContaining({ tableId: 1, sessionId: 5, displayName: 'Alice', active: true }),
      ]);
      expect(result.success).toBe(true);
    });

    it('reuses remembered session when valid', async () => {
      mocks.findTableUnique.mockResolvedValue({ id: 1, name: 'T1', currentOccupants: 0, capacity: 4, occupiedSince: null });
      mocks.findRememberedSession.mockResolvedValue({ id: 5, occupants: 2, entryTime: new Date() });
      mocks.updateSession.mockResolvedValue({ id: 5, occupants: 3 });
      mocks.createManyGuests.mockResolvedValue({});
      mocks.findActiveGuestsBySessionId.mockResolvedValue([]);
      mocks.updateTable.mockResolvedValue({ id: 1, status: 'OCCUPIED', currentOccupants: 1 });
      await enterTable({ tableId: 1, occupants: 1, customerName: 'Bob', sessionId: 5 });
      expect(mocks.updateSession).toHaveBeenCalledWith(5, { occupants: 3 });
      expect(mocks.createSession).not.toHaveBeenCalled();
    });
  });

  describe('exitTable', () => {
    it('throws TableNotFoundError when table does not exist', async () => {
      mocks.findTableUnique.mockResolvedValue(null);
      await expect(exitTable({ tableId: 999 })).rejects.toThrow(TableNotFoundError);
    });

    it('throws 400 when table is not occupied', async () => {
      mocks.findTableUnique.mockResolvedValue({ id: 1, name: 'T1', status: 'AVAILABLE', currentOccupants: 0 });
      await expect(exitTable({ tableId: 1 })).rejects.toMatchObject({ status: 400 });
    });

    it('throws 400 when exiting more occupants than present', async () => {
      mocks.findTableUnique.mockResolvedValue({ id: 1, name: 'T1', status: 'OCCUPIED', currentOccupants: 2, occupiedSince: new Date() });
      await expect(exitTable({ tableId: 1, occupants: 5 })).rejects.toMatchObject({ status: 400 });
    });

    it('reduces occupants and returns available status when last person exits', async () => {
      mocks.findTableUnique.mockResolvedValue({ id: 1, name: 'T1', status: 'OCCUPIED', currentOccupants: 1, occupiedSince: new Date() });
      mocks.findActiveSessionByTableId.mockResolvedValue({ id: 5, entryTime: new Date() });
      mocks.findActiveGuestsForExit.mockResolvedValue([{ id: 1, displayName: 'Alice' }]);
      mocks.updateManyGuests.mockResolvedValue({});
      mocks.updateSession.mockResolvedValue({ id: 5, dwellMinutes: 30 });
      mocks.updateTable.mockResolvedValue({ id: 1, status: 'AVAILABLE', currentOccupants: 0, occupiedSince: null });
      const result = await exitTable({ tableId: 1 });
      expect(result.success).toBe(true);
      expect(result.message).toContain('now available');
    });
  });

  describe('createGuest', () => {
    it('throws TableNotFoundError when table does not exist', async () => {
      mocks.findTableUnique.mockResolvedValue(null);
      mocks.findSessionUnique.mockResolvedValue(null);
      await expect(createGuest({ tableId: 999, sessionId: 5, displayName: 'Alice' })).rejects.toThrow(TableNotFoundError);
    });

    it('throws when session belongs to different table', async () => {
      mocks.findTableUnique.mockResolvedValue({ id: 1, name: 'T1' });
      mocks.findSessionUnique.mockResolvedValue({ id: 5, tableId: 2 });
      await expect(createGuest({ tableId: 1, sessionId: 5, displayName: 'Alice' })).rejects.toThrow();
    });

    it('creates guest and emits events', async () => {
      mocks.findTableUnique.mockResolvedValue({ id: 1, name: 'T1' });
      mocks.findSessionUnique.mockResolvedValue({ id: 5, tableId: 1 });
      mocks.createGuest.mockResolvedValue({ id: 10, tableId: 1, sessionId: 5, displayName: 'Alice' });
      const result = await createGuest({ tableId: 1, sessionId: 5, displayName: '  Alice  ' });
      expect(mocks.createGuest).toHaveBeenCalledWith({
        tableId: 1, sessionId: 5, displayName: 'Alice', moodEmoji: null, moodNote: null, active: true,
      });
      expect(result.id).toBe(10);
    });
  });

  describe('updateGuest', () => {
    it('throws TableNotFoundError when guest does not exist', async () => {
      mocks.findGuestById.mockResolvedValue(null);
      await expect(updateGuest({ id: 999, moodEmoji: '😊' })).rejects.toThrow(TableNotFoundError);
    });

    it('throws 400 when no fields to update', async () => {
      await expect(updateGuest({ id: 1 })).rejects.toMatchObject({ status: 400 });
    });

    it('updates guest and emits events', async () => {
      mocks.findGuestById.mockResolvedValue({ id: 1, tableId: 1, sessionId: 5, table: { name: 'T1' }, session: {} });
      mocks.updateGuest.mockResolvedValue({ id: 1, moodEmoji: '😊' });
      await updateGuest({ id: 1, moodEmoji: '😊' });
      expect(mocks.updateGuest).toHaveBeenCalledWith(1, { moodEmoji: '😊' }, 1);
    });
  });

  describe('requestClean', () => {
    it('throws TableNotFoundError when table not found by id', async () => {
      mocks.findTableUnique.mockResolvedValue(null);
      await expect(requestClean({ tableId: 999 })).rejects.toThrow(TableNotFoundError);
    });

    it('throws TableNotFoundError when table not found by name', async () => {
      mocks.findTableByName.mockResolvedValue(null);
      await expect(requestClean({ tableName: 'Ghost' })).rejects.toThrow(TableNotFoundError);
    });

    it('returns alreadyFlagged when status is NEEDS_CLEANING', async () => {
      mocks.findTableUnique.mockResolvedValue({ id: 1, name: 'T1', status: 'NEEDS_CLEANING' });
      const result = await requestClean({ tableId: 1 });
      expect(result.alreadyFlagged).toBe(true);
      expect(mocks.updateTable).not.toHaveBeenCalled();
    });

    it('updates status to NEEDS_CLEANING when not already flagged', async () => {
      mocks.findTableUnique.mockResolvedValue({ id: 1, name: 'T1', status: 'AVAILABLE' });
      mocks.updateTable.mockResolvedValue({ id: 1, name: 'T1', status: 'NEEDS_CLEANING' });
      const result = await requestClean({ tableId: 1 });
      expect(mocks.updateTable).toHaveBeenCalledWith(1, { status: 'NEEDS_CLEANING' });
      expect(result.table.status).toBe('NEEDS_CLEANING');
    });
  });
});
