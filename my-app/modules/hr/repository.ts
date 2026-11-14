 
import { prisma } from '@/lib/prisma';

// ---------------------------------------------------------------------------
// HR – Attendance, Leave, Payroll, Performance, Schedules, Shifts, Staff, Training
// Every helper touching a location-owned table merges locationId = 1 by default.
// User model has NO locationId column; its helpers do not accept locationId.
// ---------------------------------------------------------------------------

const STAFF_SELECT = {
  id: true, name: true, email: true, role: true, permissions: true, active: true,
  createdAt: true, updatedAt: true,
  phone: true, address: true, dateOfBirth: true, hireDate: true,
  position: true, department: true, profilePhoto: true,
  emergencyContactName: true, emergencyContactPhone: true,
  hourlyRate: true, monthlySalary: true, paymentType: true,
} as const;

// ----- Users (HR staff) – no locationId -----

export async function findUserById(id: number) {
  return prisma.user.findUnique({ where: { id } });
}

export async function findUserEmailById(id: number) {
  return prisma.user.findUnique({ where: { id }, select: { email: true } });
}

export async function findUserByEmail(email: string) {
  return prisma.user.findUnique({ where: { email } });
}

export async function listStaffUsers() {
  return prisma.user.findMany({ select: STAFF_SELECT, orderBy: { createdAt: 'desc' } } as any);
}

export async function createStaffUser(data: Record<string, any>) {
  return prisma.user.create({ data, select: STAFF_SELECT } as any);
}

export async function updateStaffUser(id: number, data: Record<string, any>) {
  return prisma.user.update({ where: { id }, data, select: STAFF_SELECT } as any);
}

export async function deleteStaffUser(id: number) {
  return prisma.user.delete({ where: { id } });
}

// ----- Attendance – location-scoped -----

export async function findActiveAttendance(userId: number, locationId: number = 1) {
  return prisma.attendance.findFirst({
    where: { userId, clockOut: null, locationId },
    orderBy: { clockIn: 'desc' },
  });
}

export async function createAttendance(
  data: { userId: number; clockIn: Date; clockOut?: Date | null; notes?: string | null; breakStart?: Date | null; breakEnd?: Date | null; totalHours?: number | null },
  locationId: number = 1,
) {
  return prisma.attendance.create({ data: { ...data, locationId } as any });
}

export async function findAttendanceById(id: number, locationId: number = 1) {
  return prisma.attendance.findFirst({ where: { id, locationId } });
}

export async function updateAttendance(id: number, data: Record<string, any>, _locationId: number = 1) {
  return prisma.attendance.update({ where: { id }, data } as any);
}

export async function listAttendances(
  filters: { userId?: number; from?: string | null; to?: string | null },
  locationId: number = 1,
) {
  const where: Record<string, unknown> = { locationId };
  if (filters.userId) (where as any).userId = filters.userId;
  if (filters.from || filters.to) {
    (where as any).clockIn = {};
    if (filters.from) (where as any).clockIn.gte = new Date(filters.from);
    if (filters.to) (where as any).clockIn.lte = new Date(filters.to + 'T23:59:59');
  }
  return prisma.attendance.findMany({
    where: where as any,
    include: { user: { select: { id: true, name: true, position: true } } },
    orderBy: { clockIn: 'desc' },
    take: 500,
  });
}

export async function listAttendanceForPayroll(
  userId: number,
  periodStart: string,
  periodEnd: string,
  locationId: number = 1,
) {
  return prisma.attendance.findMany({
    where: {
      userId,
      locationId,
      clockOut: { not: null },
      clockIn: { gte: new Date(periodStart), lte: new Date(periodEnd + 'T23:59:59') },
    } as any,
  });
}

// ----- LeaveType – location-scoped -----

export async function listActiveLeaveTypes(locationId: number = 1) {
  return prisma.leaveType.findMany({ where: { isActive: true, locationId }, orderBy: { name: 'asc' } });
}

export async function findLeaveTypeById(id: number, locationId: number = 1) {
  return prisma.leaveType.findFirst({ where: { id, locationId } });
}

export async function createLeaveType(
  data: { name: string; daysPerYear?: number; isActive?: boolean },
  locationId: number = 1,
) {
  return prisma.leaveType.create({
    data: { name: data.name, daysPerYear: data.daysPerYear ?? 0, isActive: data.isActive ?? true, locationId },
  });
}

export async function updateLeaveType(id: number, data: Record<string, any>, _locationId: number = 1) {
  return prisma.leaveType.update({ where: { id }, data } as any);
}

// ----- LeaveRequest – no locationId column -----

export async function listLeaveRequests(
  filters: { userId?: number; status?: string },
  _locationId: number = 1,
) {
  const where: Record<string, unknown> = {};
  if (filters.userId) (where as any).userId = filters.userId;
  if (filters.status) (where as any).status = filters.status;
  return prisma.leaveRequest.findMany({
    where: where as any,
    include: { user: { select: { id: true, name: true, position: true } }, leaveType: true },
    orderBy: { createdAt: 'desc' },
  });
}

export async function createLeaveRequest(
  data: { userId: number; leaveTypeId: number; startDate: Date; endDate: Date; reason?: string | null; status?: string },
  _locationId: number = 1,
) {
  return prisma.leaveRequest.create({
    data: { ...data, reason: data.reason || null, status: data.status || 'PENDING' } as any,
    include: { user: { select: { id: true, name: true } }, leaveType: true },
  } as any);
}

export async function updateLeaveRequest(
  id: number,
  data: { status: string; notes?: string | null; approvedById: number; approvedAt: Date },
  _locationId: number = 1,
) {
  return prisma.leaveRequest.update({
    where: { id },
    data: { status: data.status, notes: data.notes || null, approvedById: data.approvedById, approvedAt: data.approvedAt },
  });
}

// ----- Payroll – no locationId column -----

export async function listPayrolls(
  filters: { userId?: number; status?: string },
  _locationId: number = 1,
) {
  const where: Record<string, unknown> = {};
  if (filters.userId) (where as any).userId = filters.userId;
  if (filters.status) (where as any).status = filters.status;
  return prisma.payroll.findMany({
    where: where as any,
    include: { user: { select: { id: true, name: true, position: true, paymentType: true, hourlyRate: true, monthlySalary: true } } },
    orderBy: { periodEnd: 'desc' },
  });
}

export async function createPayroll(
  data: {
    userId: number; periodStart: Date; periodEnd: Date;
    regularHours: number; overtimeHours: number; grossPay: number;
    deductions: number; netPay: number; breakdown: string; status: string; processedById: number;
  },
  _locationId: number = 1,
) {
  return prisma.payroll.create({
    data: data as any,
    include: { user: { select: { id: true, name: true, position: true } } },
  } as any);
}

export async function updatePayrollStatus(id: number, status: string, _locationId: number = 1) {
  return prisma.payroll.update({ where: { id }, data: { status } });
}

// ----- PerformanceReview – location-scoped -----

export async function listPerformanceReviews(
  filters: { userId?: number },
  locationId: number = 1,
) {
  const where: Record<string, unknown> = { locationId };
  if (filters.userId) (where as any).userId = filters.userId;
  return prisma.performanceReview.findMany({
    where: where as any,
    include: {
      user: { select: { id: true, name: true, position: true } },
      reviewer: { select: { id: true, name: true } },
    },
    orderBy: { createdAt: 'desc' },
  });
}

export async function createPerformanceReview(
  data: { userId: number; reviewerId: number; period: string; rating: number; strengths?: string | null; improvements?: string | null; goals?: string | null; notes?: string | null },
  locationId: number = 1,
) {
  return prisma.performanceReview.create({
    data: { ...data, strengths: data.strengths || null, improvements: data.improvements || null, goals: data.goals || null, notes: data.notes || null, locationId } as any,
    include: { user: { select: { id: true, name: true } }, reviewer: { select: { id: true, name: true } } },
  } as any);
}

// ----- Shift – location-scoped -----

export async function listShifts(locationId: number = 1) {
  return prisma.shift.findMany({ where: { locationId }, orderBy: { sortOrder: 'asc' } });
}

export async function createShift(
  data: { name: string; startTime: string; endTime: string; breakMinutes?: number; sortOrder?: number },
  locationId: number = 1,
) {
  return prisma.shift.create({
    data: { name: data.name, startTime: data.startTime, endTime: data.endTime, breakMinutes: data.breakMinutes ?? 0, sortOrder: data.sortOrder ?? 0, locationId },
  });
}

export async function updateShift(id: number, data: Record<string, any>, _locationId: number = 1) {
  return prisma.shift.update({ where: { id }, data } as any);
}

export async function deleteShift(id: number, _locationId: number = 1) {
  return prisma.shift.delete({ where: { id } });
}

// ----- Schedule – location-scoped -----

export async function listSchedules(
  filters: { userId?: number; from?: string | null; to?: string | null },
  locationId: number = 1,
) {
  const where: Record<string, unknown> = { locationId };
  if (filters.from || filters.to) {
    (where as any).date = {};
    if (filters.from) (where as any).date.gte = new Date(filters.from);
    if (filters.to) (where as any).date.lte = new Date(filters.to);
  }
  if (filters.userId) (where as any).userId = filters.userId;
  return prisma.schedule.findMany({
    where: where as any,
    include: { user: { select: { id: true, name: true, position: true } }, shift: true },
    orderBy: { date: 'asc' },
  });
}

export async function upsertSchedule(
  userId: number,
  date: Date,
  shiftId: number,
  status: string,
  locationId: number = 1,
) {
  return prisma.schedule.upsert({
    where: { userId_date: { userId, date } },
    update: { shiftId, status, locationId } as any,
    create: { userId, shiftId, date, status, locationId } as any,
  });
}

export async function updateSchedule(id: number, data: Record<string, any>, _locationId: number = 1) {
  return prisma.schedule.update({ where: { id }, data } as any);
}

export async function deleteSchedule(id: number, _locationId: number = 1) {
  return prisma.schedule.delete({ where: { id } });
}

// ----- Training – location-scoped -----

export async function listTrainings(locationId: number = 1) {
  return prisma.training.findMany({
    where: { isActive: true, locationId },
    include: { enrollments: true },
    orderBy: { name: 'asc' },
  });
}

export async function createTraining(
  data: { name: string; description?: string | null; duration?: string | null },
  locationId: number = 1,
) {
  return prisma.training.create({
    data: { name: data.name, description: data.description || null, duration: data.duration || null, locationId },
  });
}

// ----- StaffTraining – location-scoped -----

export async function upsertStaffTraining(
  userId: number,
  trainingId: number,
  locationId: number = 1,
) {
  return prisma.staffTraining.upsert({
    where: { userId_trainingId: { userId, trainingId } },
    update: { status: 'ENROLLED', completedAt: null, expiryDate: null, locationId } as any,
    create: { userId, trainingId, status: 'ENROLLED', locationId } as any,
  });
}

export async function updateStaffTraining(
  userId: number,
  trainingId: number,
  data: Record<string, any>,
  _locationId: number = 1,
) {
  return prisma.staffTraining.update({
    where: { userId_trainingId: { userId, trainingId } },
    data: data as any,
  });
}

// ----- StaffDocument – location-scoped -----

export async function listStaffDocuments(userId: number, locationId: number = 1) {
  return prisma.staffDocument.findMany({
    where: { userId, locationId },
    include: { uploader: { select: { id: true, name: true } } },
    orderBy: { createdAt: 'desc' },
  });
}

export async function createStaffDocument(
  data: { userId: number; name: string; type?: string; fileUrl?: string | null; expiryDate?: Date | null; uploadedById: number; notes?: string | null },
  locationId: number = 1,
) {
  return prisma.staffDocument.create({
    data: {
      userId: data.userId, name: data.name, type: data.type ?? 'OTHER',
      fileUrl: data.fileUrl || null, expiryDate: data.expiryDate || null,
      uploadedById: data.uploadedById, notes: data.notes || null, locationId,
    },
  });
}

export async function deleteStaffDocument(id: number, _locationId: number = 1) {
  return prisma.staffDocument.delete({ where: { id } });
}

// ----- Spec 021: holidays, schedules, service charge, payroll reports -----

export async function listHolidaysBetween(from: string, to: string, locationId: number = 1) {
  return prisma.holiday.findMany({ where: { locationId, date: { gte: from, lte: to } }, orderBy: { date: 'asc' } });
}

export async function countHolidaysForYear(year: number, locationId: number = 1) {
  return prisma.holiday.count({ where: { locationId, date: { gte: `${year}-01-01`, lte: `${year}-12-31` } } });
}

export async function createHolidays(rows: { date: string; name: string; type: string }[], locationId: number = 1) {
  for (const r of rows) {
    await prisma.holiday.upsert({
      where: { locationId_date: { locationId, date: r.date } },
      update: {},
      create: { ...r, locationId },
    });
  }
}

export async function upsertHoliday(row: { date: string; name: string; type: string }, locationId: number = 1) {
  return prisma.holiday.upsert({
    where: { locationId_date: { locationId, date: row.date } },
    update: { name: row.name, type: row.type },
    create: { ...row, locationId },
  });
}

export async function deleteHoliday(id: number, locationId: number = 1) {
  return prisma.holiday.deleteMany({ where: { id, locationId } });
}

export async function listScheduleDates(userId: number, from: string, to: string) {
  const rows = await prisma.schedule.findMany({
    where: { userId, status: { not: 'CANCELLED' }, date: { gte: new Date(from + 'T00:00:00'), lte: new Date(to + 'T23:59:59') } },
    select: { date: true },
  });
  return rows.map((r) => r.date);
}

/** Service charges collected on paid, not-cancelled orders in the period. */
export async function sumServiceCharge(from: string, to: string, locationId: number = 1) {
  const r = await prisma.order.aggregate({
    where: { locationId, status: { not: 'CANCELLED' }, paidAt: { gte: new Date(from + 'T00:00:00'), lte: new Date(to + 'T23:59:59') } },
    _sum: { serviceCharge: true },
  });
  return r._sum.serviceCharge ?? 0;
}

export async function listPayableStaff() {
  return prisma.user.findMany({
    where: { active: true, paymentType: { not: null } },
    select: { id: true, name: true, paymentType: true, hourlyRate: true, monthlySalary: true },
    orderBy: { name: 'asc' },
  });
}

export async function listUserIdsWithAttendance(from: string, to: string) {
  const rows = await prisma.attendance.findMany({
    where: { clockOut: { not: null }, clockIn: { gte: new Date(from + 'T00:00:00'), lte: new Date(to + 'T23:59:59') } } as any,
    select: { userId: true },
    distinct: ['userId'],
  });
  return rows.map((r) => r.userId);
}

export async function listPayrollsEndingIn(from: string, to: string) {
  return prisma.payroll.findMany({
    where: { periodEnd: { gte: new Date(from + 'T00:00:00'), lte: new Date(to + 'T23:59:59') } },
    select: { userId: true, grossPay: true, breakdown: true, user: { select: { id: true, name: true, position: true } } },
  });
}

export async function listApprovedLeaveBetween(from: string, to: string) {
  return prisma.leaveRequest.findMany({
    where: { status: 'APPROVED', startDate: { lte: new Date(to + 'T23:59:59') }, endDate: { gte: new Date(from + 'T00:00:00') } },
    select: { userId: true, leaveTypeId: true, startDate: true, endDate: true },
  });
}

export async function listActiveStaffBasic() {
  return prisma.user.findMany({ where: { active: true }, select: { id: true, name: true, position: true }, orderBy: { name: 'asc' } });
}
