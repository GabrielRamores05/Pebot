import { z } from 'zod';
import { fromZodError } from 'zod-validation-error';
import { emitEvent } from '@/lib/socket';
import {
  ListTablesParamsSchema,
  CreateTableInputSchema,
  CreateTableInput,
  UpdateTableInputSchema,
  UpdateTableInput,
  DeleteTableInputSchema,
  DeleteTableInput,
  AdjustOccupantsInputSchema,
  AdjustOccupantsInput,
  TableEntryInputSchema,
  TableExitInputSchema,
  CreateGuestInputSchema,
  UpdateGuestInputSchema,
  CleanRequestInputSchema,
} from '@/modules/tables/schema';
import * as repo from '@/modules/tables/repository';

function slugify(name: string): string {
  return name
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

function parseInput<T>(schema: z.ZodSchema<T>, input: unknown): T {
  const result = schema.safeParse(input);
  if (!result.success) {
    throw fromZodError(result.error);
  }
  return result.data;
}

function setErrorStatus(e: Error, status: number): Error {
  (e as unknown as { status: number }).status = status;
  return e;
}

export class TableNotFoundError extends Error {
  status = 404;
  constructor(id?: number, name?: string) {
    super(`Table not found${id ? ` (id: ${id})` : ''}${name ? ` (name: ${name})` : ''}`);
    this.name = 'TableNotFoundError';
  }
}

export async function listTables(locationId = 1) {
  return repo.findAllTables(locationId);
}

export async function createTable(input: unknown, locationId = 1) {
  const data = parseInput(CreateTableInputSchema, input) as CreateTableInput;

  const trimmedName = data.name.trim();
  if (!trimmedName) {
    throw setErrorStatus(new Error('Table name is required'), 400);
  }

  const safeCapacity = data.capacity && data.capacity > 0 ? data.capacity : 4;

  const baseSlug = slugify(trimmedName) || `table-${Date.now()}`;
  let slug = baseSlug;
  let slugTaken = await repo.findTableBySlugUnique(slug);
  let suffix = 2;
  while (slugTaken) {
    slug = `${baseSlug}-${suffix}`;
    slugTaken = await repo.findTableBySlugUnique(slug);
    suffix += 1;
  }

  try {
    const table = await repo.createTable(
      {
        name: trimmedName,
        slug,
        capacity: safeCapacity,
        ...(data.section ? { section: data.section } : {}),
        ...(data.positionX !== undefined && data.positionX !== null ? { positionX: data.positionX } : {}),
        ...(data.positionY !== undefined && data.positionY !== null ? { positionY: data.positionY } : {}),
      },
      locationId,
    );
    emitEvent('table-update', table);
    return table;
  } catch (e) {
    const msg = String(e);
    if (msg.includes('P2002') || msg.includes('Unique constraint')) {
      throw setErrorStatus(new Error('A table with this name already exists. Please use a different name.'), 400);
    }
    throw e;
  }
}

export async function updateTable(input: unknown, locationId = 1) {
  const data = parseInput(UpdateTableInputSchema, input) as UpdateTableInput;

  const updateData: Record<string, unknown> = {};
  if (data.status) updateData.status = data.status;
  if (data.name) updateData.name = data.name;
  if (data.capacity !== undefined) updateData.capacity = data.capacity;
  if (data.section) updateData.section = data.section;
  if (data.positionX !== undefined) updateData.positionX = data.positionX;
  if (data.positionY !== undefined) updateData.positionY = data.positionY;

  if (Object.keys(updateData).length === 0) {
    throw setErrorStatus(new Error('No fields to update'), 400);
  }

  const table = await repo.updateTable(data.id, updateData, locationId);
  emitEvent('table-update', table);
  return table;
}

export async function deleteTable(input: unknown, locationId = 1) {
  const data = parseInput(DeleteTableInputSchema, input) as DeleteTableInput;

  const table = await repo.findTableUnique(data.id);
  if (!table) {
    throw new TableNotFoundError(data.id);
  }

  if (data.force || table.status === 'OCCUPIED') {
    await repo.updateTable(
      data.id,
      {
        status: 'AVAILABLE',
        currentOccupants: 0,
        occupiedSince: null,
        assignedOrderId: null,
      },
      locationId,
    );
  }

  const result = await repo.deleteTable(data.id, locationId);
  emitEvent('table-update', { id: data.id, deleted: true });
  return { ok: true };
}

export async function adjustOccupants(input: unknown, locationId = 1) {
  const data = parseInput(AdjustOccupantsInputSchema, input) as AdjustOccupantsInput;

  const table = await repo.findTableUnique(data.id);
  if (!table) {
    throw new TableNotFoundError(data.id);
  }

  if (data.action === 'clear') {
    const activeSession = await repo.findActiveSessionByTableId(data.id, locationId);
    const activeGuests = activeSession
      ? await repo.findActiveGuestsBySessionId(activeSession.id, locationId)
      : [];

    if (activeGuests.length > 0) {
      throw setErrorStatus(
        new Error('Cannot clear table with active guests. Please dismiss guests first.'),
        400,
      );
    }

    await repo.clearTableGuestsAndSessions(data.id, locationId);

    const updatedTable = await repo.updateTable(
      data.id,
      {
        currentOccupants: 0,
        status: 'AVAILABLE',
        occupiedSince: null,
      },
      locationId,
    );

    emitEvent('table-update', updatedTable);
    emitEvent('table-guest-updated', { tableId: data.id });
    return updatedTable;
  }

  let newOccupants = table.currentOccupants ?? 0;

  if (data.action === 'add') {
    newOccupants += 1;
  } else if (data.action === 'remove') {
    const activeSession = await repo.findActiveSessionByTableId(data.id, locationId);
    if (!activeSession) {
      return table;
    }

    const activeGuests = await repo.findActiveGuestsBySessionId(activeSession.id, locationId);
    if (activeGuests.length === 0) {
      return table;
    }

    newOccupants = Math.max(0, newOccupants - 1);

    let leavingGuest = null;
    if (data.customerName) {
      leavingGuest = await repo.findGuestByDisplayName(activeSession.id, data.customerName, locationId);
    }
    if (!leavingGuest) {
      leavingGuest = await repo.findMostRecentActiveGuest(activeSession.id, locationId);
    }

    if (leavingGuest) {
      await repo.updateGuest(leavingGuest.id, { active: false, exitedAt: new Date() }, locationId);

      emitEvent('table-guest-left', {
        tableId: data.id,
        tableName: table.name,
        guestNames: leavingGuest.displayName,
      });
      emitEvent('table-guest-updated', { tableId: data.id });
    }
  } else if (data.action === 'set' && data.occupantCount !== undefined) {
    newOccupants = Math.max(0, Math.min(data.occupantCount, table.capacity));
  }

  const updatedTable = await repo.updateTable(
    data.id,
    {
      currentOccupants: newOccupants,
      status: newOccupants > 0 ? 'OCCUPIED' : 'AVAILABLE',
      occupiedSince:
        newOccupants > 0 ? (table.occupiedSince ?? new Date()) : null,
    },
    locationId,
  );

  emitEvent('table-update', updatedTable);
  return updatedTable;
}

export async function enterTable(input: unknown) {
  const data = parseInput(TableEntryInputSchema, input);

  const table = await repo.findTableUnique(data.tableId);
  if (!table) {
    throw new TableNotFoundError(data.tableId);
  }

  const current = table.currentOccupants ?? 0;
  const newTotalOccupants = current + data.occupants;

  if (newTotalOccupants > table.capacity) {
    const remaining = Math.max(table.capacity - current, 0);
    const seatText = remaining === 1 ? 'seat' : 'seats';
    if (remaining > 0) {
      throw setErrorStatus(
        new Error(`Only ${remaining} ${seatText} left at this table.`),
        400,
      );
    }
    throw setErrorStatus(new Error('This table is already full.'), 400);
  }

  const updatedTable = await repo.updateTable(
    data.tableId,
    {
      status: 'OCCUPIED',
      currentOccupants: newTotalOccupants,
      occupiedSince: table.occupiedSince ?? new Date(),
    },
  );

  let session: { id: number; occupants: number } | null = null;

  if (data.sessionId) {
    const remembered = await repo.findRememberedSession(data.sessionId, data.tableId);
    if (remembered) {
      session = await repo.updateSession(remembered.id, {
        occupants: remembered.occupants + data.occupants,
      });
    }
  }

  if (!session) {
    session = await repo.createSession({
      tableId: data.tableId,
      occupants: data.occupants,
    });
  }

  const guestData: Array<{
    tableId: number;
    sessionId: number;
    displayName: string;
    moodEmoji?: string | null;
    moodNote?: string | null;
    active: boolean;
  }> = [];

  for (let i = 0; i < data.occupants; i++) {
    guestData.push({
      tableId: data.tableId,
      sessionId: session.id,
      displayName: data.customerName.trim(),
      moodEmoji: data.moodEmoji ?? null,
      moodNote: data.moodNote ?? null,
      active: true,
    });
  }

  await repo.createManyGuests(guestData);

  const guests = await repo.findActiveGuestsBySessionId(session.id);

  emitEvent('table-occupied', {
    tableId: data.tableId,
    tableName: table.name,
    occupants: data.occupants,
    status: updatedTable.status,
    currentOccupants: updatedTable.currentOccupants,
    timestamp: new Date(),
  });
  emitEvent('table-guest-joined', { tableId: data.tableId, guests });
  emitEvent('table-update', updatedTable);

  return {
    success: true,
    table: updatedTable,
    session,
    guests,
  };
}

export async function exitTable(input: unknown) {
  const data = parseInput(TableExitInputSchema, input);

  const table = await repo.findTableUnique(data.tableId);
  if (!table) {
    throw new TableNotFoundError(data.tableId);
  }

  if (table.status !== 'OCCUPIED' || (table.currentOccupants ?? 0) <= 0) {
    throw setErrorStatus(new Error('This table is not currently occupied.'), 400);
  }

  const exitingOccupants = data.occupants && data.occupants > 0 ? data.occupants : 1;

  if (exitingOccupants > (table.currentOccupants ?? 0)) {
    throw setErrorStatus(
      new Error(
        `Cannot exit ${exitingOccupants} occupants - only ${table.currentOccupants} present`,
      ),
      400,
    );
  }

  const newOccupants = (table.currentOccupants ?? 0) - exitingOccupants;
  const newStatus = newOccupants === 0 ? 'AVAILABLE' : 'OCCUPIED';

  const activeSession = await repo.findActiveSessionByTableId(data.tableId);

  const updatedTable = await repo.updateTable(
    data.tableId,
    {
      status: newStatus,
      currentOccupants: newOccupants,
      occupiedSince: newOccupants > 0 ? table.occupiedSince : null,
    },
  );

  let activeGuests: any[] = [];
  if (activeSession) {
    activeGuests = await repo.findActiveGuestsForExit(activeSession.id, exitingOccupants);

    if (activeGuests.length > 0) {
      const guestIds = activeGuests.map((g) => g.id);
      await repo.updateManyGuests({ id: { in: guestIds } }, { active: false, exitedAt: new Date() });
    }
  }

  let exitedSession = null;
  if (activeSession && newOccupants === 0) {
    const exitTime = new Date();
    const dwellMinutes = Math.round(
      (exitTime.getTime() - (activeSession.entryTime as Date).getTime()) / 60000,
    );
    exitedSession = await repo.updateSession(activeSession.id, { exitTime, dwellMinutes });
  }

  const leftGuestNames = activeGuests.map((g) => g.displayName).join(', ');

  emitEvent('table-exit', {
    tableId: data.tableId,
    tableName: table.name,
    newOccupants,
    newStatus,
    dwellMinutes: exitedSession?.dwellMinutes ?? null,
    timestamp: new Date(),
  });
  emitEvent('table-guest-left', {
    tableId: data.tableId,
    tableName: table.name,
    guestNames: leftGuestNames,
  });
  emitEvent('table-update', updatedTable);

  return {
    success: true,
    table: updatedTable,
    session: exitedSession,
    message:
      newOccupants === 0
        ? `Table ${table.name} is now available`
        : `${newOccupants} occupant(s) remain at ${table.name}`,
  };
}

export async function createGuest(input: unknown) {
  const data = parseInput(CreateGuestInputSchema, input);

  const [table, session] = await Promise.all([
    repo.findTableUnique(data.tableId),
    repo.findSessionUnique(data.sessionId),
  ]);

  if (!table) {
    throw new TableNotFoundError(data.tableId);
  }
  if (!session || session.tableId !== data.tableId) {
    throw new TableNotFoundError(data.tableId);
  }

  const displayName = data.displayName.trim();

  const guest = await repo.createGuest({
    tableId: data.tableId,
    sessionId: data.sessionId,
    displayName,
    moodEmoji: data.moodEmoji ?? null,
    moodNote: data.moodNote ?? null,
    active: true,
  });

  emitEvent('table-guest-joined', {
    tableId: data.tableId,
    tableName: table.name,
    sessionId: data.sessionId,
    guest,
    timestamp: new Date(),
  });

  return guest;
}

export async function updateGuest(input: unknown, locationId = 1) {
  const data = parseInput(UpdateGuestInputSchema, input);

  const updateData: Record<string, unknown> = {};
  if (data.moodEmoji !== undefined) updateData.moodEmoji = data.moodEmoji;
  if (data.moodNote !== undefined) updateData.moodNote = data.moodNote;
  if (data.active !== undefined) {
    updateData.active = data.active;
    if (data.active === false) {
      updateData.exitedAt = new Date();
    }
  }

  if (Object.keys(updateData).length === 0) {
    throw setErrorStatus(new Error('No fields to update'), 400);
  }

  const existing = await repo.findGuestById(data.id, locationId);
  if (!existing) {
    throw new TableNotFoundError();
  }

  const guest = await repo.updateGuest(data.id, updateData, locationId);

  if (data.active === false) {
    emitEvent('table-guest-left', {
      tableId: existing.tableId,
      tableName: existing.table?.name,
      sessionId: existing.sessionId,
      guest,
      timestamp: new Date(),
    });
  } else {
    emitEvent('table-guest-updated', {
      tableId: existing.tableId,
      tableName: existing.table?.name,
      sessionId: existing.sessionId,
      guest,
      timestamp: new Date(),
    });
  }

  return guest;
}

export async function requestClean(input: unknown) {
  const data = parseInput(CleanRequestInputSchema, input);

  let table;
  if (data.tableId) {
    table = await repo.findTableUnique(data.tableId);
  } else if (data.tableName) {
    table = await repo.findTableByName(data.tableName.trim());
  }

  if (!table) {
    throw new TableNotFoundError(data.tableId, data.tableName);
  }

  if (table.status === 'NEEDS_CLEANING') {
    emitEvent('table-clean-request', {
      tableId: table.id,
      tableName: table.name,
      status: table.status,
      alreadyFlagged: true,
      timestamp: new Date(),
    });
    return { ok: true, table, alreadyFlagged: true };
  }

  const updated = await repo.updateTable(table.id, { status: 'NEEDS_CLEANING' });

  emitEvent('table-clean-request', {
    tableId: updated.id,
    tableName: updated.name,
    status: updated.status,
    alreadyFlagged: false,
    timestamp: new Date(),
  });
  emitEvent('table-update', updated);

  return { ok: true, table: updated };
}
