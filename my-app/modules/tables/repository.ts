 
import { prisma } from '@/lib/prisma';

// ---------------------------------------------------------------------------
// RestaurantTable – locationId is a first-class column
// ---------------------------------------------------------------------------

export async function findAllTables(locationId: number = 1) {
  return prisma.restaurantTable.findMany({
    where: { locationId },
    orderBy: { name: 'asc' },
    include: {
      guests: { where: { active: true }, orderBy: { createdAt: 'asc' } },
      sessions: {
        where: { exitTime: null },
        orderBy: { entryTime: 'desc' },
        include: { orders: { orderBy: { createdAt: 'asc' } } },
      },
    },
  });
}

export async function findTableById(id: number, locationId: number = 1) {
  return prisma.restaurantTable.findFirst({ where: { id, locationId } });
}

export async function findTableUnique(id: number) {
  return prisma.restaurantTable.findUnique({ where: { id } });
}

export async function findTableBySlug(slug: string, locationId: number = 1) {
  return prisma.restaurantTable.findFirst({ where: { slug, locationId } });
}

// Used by clean-request (name lookup) and entry (id lookup)
export async function findTableFirst(
  where: Record<string, unknown>,
  locationId: number = 1,
) {
  return prisma.restaurantTable.findFirst({ where: { locationId, ...where } });
}

export async function findTableByName(name: string, locationId: number = 1) {
  return prisma.restaurantTable.findFirst({ where: { name, locationId } });
}

export async function findTableBySlugUnique(slug: string, _locationId: number = 1) {
  // slug is globally unique in schema; keep wrapper for repository parity
  return prisma.restaurantTable.findUnique({ where: { slug } });
}

export async function createTable(
  data: { name: string; slug: string; capacity: number; section?: string; positionX?: number; positionY?: number },
  locationId: number = 1,
) {
  return prisma.restaurantTable.create({
    data: { ...data, locationId },
  });
}

export async function updateTable(
  id: number,
  data: Record<string, unknown>,
  _locationId: number = 1,
) {
  return prisma.restaurantTable.update({ where: { id }, data });
}

export async function deleteTable(id: number, _locationId: number = 1) {
  return prisma.restaurantTable.delete({ where: { id } });
}

export async function resetTableForDelete(id: number, _locationId: number = 1) {
  return prisma.restaurantTable.update({
    where: { id },
    data: { status: 'AVAILABLE', currentOccupants: 0, occupiedSince: null, assignedOrderId: null },
  });
}

export async function occupyTable(
  id: number,
  data: { status: string; currentOccupants: number; occupiedSince?: Date | null },
  _locationId: number = 1,
) {
  return prisma.restaurantTable.update({ where: { id }, data });
}

export async function updateTableOccupants(
  id: number,
  data: { currentOccupants: number; status: string; occupiedSince: Date | null },
  _locationId: number = 1,
) {
  return prisma.restaurantTable.update({ where: { id }, data });
}

// ---------------------------------------------------------------------------
// TableSession – has locationId
// ---------------------------------------------------------------------------

export async function findActiveSessionByTableId(tableId: number, locationId: number = 1) {
  return prisma.tableSession.findFirst({
    where: { tableId, exitTime: null, locationId },
    orderBy: { entryTime: 'desc' },
  });
}

export async function findSessionById(id: number, locationId: number = 1) {
  return prisma.tableSession.findFirst({ where: { id, locationId } });
}

export async function findRememberedSession(sessionId: number, tableId: number, locationId: number = 1) {
  return prisma.tableSession.findFirst({ where: { id: sessionId, tableId, exitTime: null, locationId } });
}

export async function createSession(
  data: { tableId: number; occupants: number },
  locationId: number = 1,
) {
  return prisma.tableSession.create({ data: { ...data, locationId } });
}

export async function updateSession(
  id: number,
  data: Record<string, unknown>,
  _locationId: number = 1,
) {
  return prisma.tableSession.update({ where: { id }, data: data as any });
}

export async function updateManySessions(
  where: Record<string, unknown>,
  data: Record<string, unknown>,
  _locationId: number = 1,
) {
  return prisma.tableSession.updateMany({ where: where as any, data: data as any });
}

export async function findSessionUnique(id: number) {
  return prisma.tableSession.findUnique({ where: { id } });
}

// ---------------------------------------------------------------------------
// TableGuest – no locationId column; scoped via session/table
// ---------------------------------------------------------------------------

export async function findActiveGuestsBySessionId(sessionId: number, _locationId: number = 1) {
  return prisma.tableGuest.findMany({ where: { sessionId, active: true }, orderBy: { createdAt: 'asc' } });
}

export async function findActiveGuestsForExit(sessionId: number, take: number, _locationId: number = 1) {
  return prisma.tableGuest.findMany({
    where: { sessionId, active: true },
    orderBy: { createdAt: 'desc' },
    take,
  });
}

export async function findGuestsBySessionLimited(sessionId: number, take: number, _locationId: number = 1) {
  return prisma.tableGuest.findMany({
    where: { sessionId, active: true },
    orderBy: { createdAt: 'asc' },
    take,
  });
}

export async function findGuestById(id: number, _locationId: number = 1): Promise<any> {
  return (prisma.tableGuest.findUnique as any)({ where: { id }, include: { table: true, session: true } });
}

export async function findGuestUnique(id: number, _locationId: number = 1) {
  return prisma.tableGuest.findUnique({ where: { id } });
}

export async function createGuest(
  data: { tableId: number; sessionId: number; displayName: string; moodEmoji?: string | null; moodNote?: string | null; active?: boolean },
  _locationId: number = 1,
) {
  return prisma.tableGuest.create({ data: data as any });
}

export async function createManyGuests(
  data: Array<{ tableId: number; sessionId: number; displayName: string; moodEmoji?: string | null; moodNote?: string | null; active: boolean }>,
  _locationId: number = 1,
) {
  return prisma.tableGuest.createMany({ data: data as any });
}

export async function updateGuest(
  id: number,
  data: Record<string, unknown>,
  _locationId: number = 1,
) {
  return prisma.tableGuest.update({ where: { id }, data: data as any });
}

export async function updateManyGuests(
  where: Record<string, unknown>,
  data: Record<string, unknown>,
  _locationId: number = 1,
) {
  return prisma.tableGuest.updateMany({ where: where as any, data: data as any });
}

export async function findActiveGuestsByTableId(tableId: number, _locationId: number = 1) {
  return prisma.tableGuest.findMany({ where: { tableId, active: true } });
}

export async function findGuestByDisplayName(
  sessionId: number,
  displayName: string,
  _locationId: number = 1,
) {
  return prisma.tableGuest.findFirst({
    where: { sessionId, active: true, displayName: { equals: displayName } },
    orderBy: { createdAt: 'desc' },
  });
}

export async function findMostRecentActiveGuest(sessionId: number, _locationId: number = 1) {
  return prisma.tableGuest.findFirst({
    where: { sessionId, active: true },
    orderBy: { createdAt: 'desc' },
  });
}

export async function clearTableGuestsAndSessions(tableId: number, _locationId: number = 1) {
  return prisma.$transaction([
    prisma.tableGuest.updateMany({ where: { tableId, active: true }, data: { active: false, exitedAt: new Date() } }),
    prisma.tableSession.updateMany({ where: { tableId, exitTime: null }, data: { exitTime: new Date() } }),
  ]);
}

// ---------------------------------------------------------------------------
// StaffStationControl – has locationId
// ---------------------------------------------------------------------------

export async function findAllStations(locationId: number = 1) {
  return prisma.staffStationControl.findMany({ where: { locationId }, orderBy: { stationType: 'asc' } });
}

export async function findAllStationsUnscoped(_locationId: number = 1) {
  // Original GET did not filter by location; keep helper with location merge
  return prisma.staffStationControl.findMany({ orderBy: { stationType: 'asc' } });
}

export async function createManyStations(
  data: Array<{ stationType: string; staffCount: number }>,
  locationId: number = 1,
) {
  return prisma.staffStationControl.createMany({
    data: data.map((d) => ({ ...d, locationId })),
  });
}

export async function findStationByStationType(stationType: string, locationId: number = 1) {
  return prisma.staffStationControl.findFirst({ where: { stationType, locationId } });
}

export async function findStationByStationTypeUnique(stationType: string, _locationId: number = 1) {
  return prisma.staffStationControl.findUnique({ where: { stationType } });
}

export async function createStation(
  data: { stationType: string; staffCount: number; emoji?: string },
  locationId: number = 1,
) {
  return prisma.staffStationControl.create({ data: { ...data, locationId } });
}

export async function findStationById(id: number, locationId: number = 1) {
  return prisma.staffStationControl.findFirst({ where: { id, locationId } });
}

export async function updateStation(
  id: number,
  data: Record<string, unknown>,
  _locationId: number = 1,
) {
  return prisma.staffStationControl.update({ where: { id }, data: data as any });
}

export async function deleteStation(id: number, _locationId: number = 1) {
  return prisma.staffStationControl.delete({ where: { id } });
}
