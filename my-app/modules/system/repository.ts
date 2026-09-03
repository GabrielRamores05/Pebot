 
import { prisma } from '@/lib/prisma';

// ---------------------------------------------------------------------------
// System – Auth (User), AuditEvent, BusinessSettings, Setting, Admin Users
// Functions for location-owned tables accept locationId = 1.
// User / BusinessSettings / Setting / AIConversation have no locationId column.
// ---------------------------------------------------------------------------

// ----- Auth – User (no locationId) -----

export async function findUserByEmail(email: string) {
  return prisma.user.findUnique({ where: { email } });
}

export async function findUserById(id: number) {
  return prisma.user.findUnique({ where: { id } });
}

// Attendance helpers used by auth login/logout – attendance IS location-scoped
export async function findOpenAttendanceForUser(userId: number, locationId: number = 1) {
  return prisma.attendance.findFirst({ where: { userId, clockOut: null, locationId } });
}

export async function createAttendanceForUser(userId: number, locationId: number = 1) {
  return prisma.attendance.create({ data: { userId, clockIn: new Date(), locationId } as any });
}

export async function closeAttendanceForUser(id: number, clockOut: Date, totalHours: number, _locationId: number = 1) {
  return prisma.attendance.update({ where: { id }, data: { clockOut, totalHours } as any });
}

export async function createAuditEvent(
  data: { userId?: number | null; action: string; resource: string; resourceId?: number | null; details?: string | null; ip?: string | null },
  locationId: number = 1,
) {
  return prisma.auditEvent.create({
    data: {
      userId: data.userId ?? null,
      action: data.action,
      resource: data.resource,
      resourceId: data.resourceId ?? undefined,
      details: data.details ?? undefined,
      ip: data.ip ?? undefined,
      locationId,
    } as any,
  });
}

// ----- AuditEvent – location-scoped -----

export async function listAuditEvents(
  filters: { resource?: string | null; action?: string | null; userId?: number | null; dateFrom?: string | null; dateTo?: string | null },
  pagination: { skip: number; take: number },
  locationId: number = 1,
) {
  const where: Record<string, unknown> = { locationId };
  if (filters.resource) (where as any).resource = filters.resource;
  if (filters.action) (where as any).action = { contains: filters.action };
  if (filters.userId) (where as any).userId = filters.userId;
  if (filters.dateFrom || filters.dateTo) {
    const dateFilter: Record<string, Date> = {};
    if (filters.dateFrom) dateFilter.gte = new Date(filters.dateFrom);
    if (filters.dateTo) dateFilter.lte = new Date(filters.dateTo);
    (where as any).createdAt = dateFilter;
  }
  return prisma.auditEvent.findMany({
    where: where as any,
    include: { user: { select: { id: true, name: true, email: true, role: true } } },
    orderBy: { createdAt: 'desc' },
    skip: pagination.skip,
    take: pagination.take,
  });
}

export async function countAuditEvents(
  filters: { resource?: string | null; action?: string | null; userId?: number | null; dateFrom?: string | null; dateTo?: string | null },
  locationId: number = 1,
) {
  const where: Record<string, unknown> = { locationId };
  if (filters.resource) (where as any).resource = filters.resource;
  if (filters.action) (where as any).action = { contains: filters.action };
  if (filters.userId) (where as any).userId = filters.userId;
  if (filters.dateFrom || filters.dateTo) {
    const dateFilter: Record<string, Date> = {};
    if (filters.dateFrom) dateFilter.gte = new Date(filters.dateFrom);
    if (filters.dateTo) dateFilter.lte = new Date(filters.dateTo);
    (where as any).createdAt = dateFilter;
  }
  return prisma.auditEvent.count({ where: where as any });
}

// ----- BusinessSettings – NO locationId (singleton) -----

export async function findBusinessSettings() {
  return prisma.businessSettings.findFirst();
}

export async function createBusinessSettings(data: Record<string, any>) {
  return prisma.businessSettings.create({ data: data as any });
}

export async function updateBusinessSettings(id: number, data: Record<string, any>) {
  return prisma.businessSettings.update({ where: { id }, data: data as any });
}

export async function incrementReceiptNumber(id: number, currentNumber: number) {
  return prisma.businessSettings.update({
    where: { id },
    data: { lastReceiptNumber: currentNumber + 1 },
  });
}

// ----- Setting (key-value) – NO locationId -----

export async function findSettingsByKeys(keys: string[]) {
  return prisma.setting.findMany({ where: { key: { in: keys } } });
}

export async function findSettingByKey(key: string) {
  return prisma.setting.findUnique({ where: { key } });
}

export async function upsertSetting(key: string, value: string) {
  return prisma.setting.upsert({
    where: { key },
    update: { value },
    create: { key, value },
  });
}

// ----- Tablet device credentials (Setting kv doc "tabletDevices") -----

export const TABLET_DEVICES_KEY = 'tabletDevices';

export async function getTabletDevicesDoc(): Promise<Array<Record<string, any>>> {
  const row = await findSettingByKey(TABLET_DEVICES_KEY);
  if (!row) return [];
  try {
    const parsed = JSON.parse(row.value);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export async function saveTabletDevicesDoc(devices: Array<Record<string, any>>) {
  await upsertSetting(TABLET_DEVICES_KEY, JSON.stringify(devices));
}

// ----- Admin Users – User (no locationId) -----

export async function listAdminUsers() {
  return prisma.user.findMany({
    select: { id: true, name: true, email: true, role: true, active: true, createdAt: true } as any,
    orderBy: { createdAt: 'asc' } as any,
  });
}

export async function createAdminUser(data: { name: string; email: string; password: string; role: string }) {
  return prisma.user.create({
    data,
    select: { id: true, name: true, email: true, role: true, active: true, createdAt: true } as any,
  } as any);
}

export async function updateAdminUser(id: number, data: Record<string, any>) {
  return prisma.user.update({
    where: { id },
    data: data as any,
    select: { id: true, name: true, email: true, role: true, active: true, createdAt: true } as any,
  } as any);
}

export async function deleteAdminUser(id: number) {
  return prisma.user.delete({ where: { id } });
}

export async function findUserWithSubscription(userId: number) {
  return prisma.user.findUnique({
    where: { id: userId },
    include: { subscription: true },
  });
}

// ----- Restore – Prisma lifecycle passthrough -----

export async function disconnectPrisma() {
  return prisma.$disconnect();
}

export async function connectPrisma() {
  return prisma.$connect();
}
