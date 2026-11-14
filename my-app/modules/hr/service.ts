import { z } from 'zod';
import { fromZodError, ValidationError } from 'zod-validation-error';
import {
  ClockInInputSchema,
  ClockOutInputSchema,
  ListAttendanceParamsSchema,
  CreateLeaveRequestInputSchema,
  UpdateLeaveRequestInputSchema,
  ListLeaveRequestsParamsSchema,
  UpsertLeaveTypeInputSchema,
  CreatePerformanceReviewInputSchema,
  ListPerformanceReviewsParamsSchema,
} from '@/modules/hr/schema';
import * as repo from '@/modules/hr/repository';
import { emitEvent } from '@/lib/socket';

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

export async function clockIn(input: unknown, approvedById: number) {
  const data = parseInput(ClockInInputSchema, input);

  const user = await repo.findUserById(data.userId);
  if (!user) {
    throw setErrorStatus(new Error('User not found'), 404);
  }

  const active = await repo.findActiveAttendance(data.userId);
  if (active) {
    throw setErrorStatus(new Error('Already clocked in. Clock out first.'), 409);
  }

  const record = await repo.createAttendance({
    userId: data.userId,
    clockIn: new Date(),
    notes: data.notes ?? null,
  });

  return record;
}

/** Whether the signed-in person is on shift (spec 020). */
export async function myShift(userId: number) {
  const active = await repo.findActiveAttendance(userId);
  return { clockedIn: Boolean(active), since: active?.clockIn ?? null, attendanceId: active?.id ?? null };
}

/** Clock the signed-in person in, or out when they already are (spec 020). */
export async function toggleMyShift(userId: number) {
  const active = await repo.findActiveAttendance(userId);
  if (active) {
    await clockOut({ attendanceId: active.id }, userId);
    return { clockedIn: false, since: null, attendanceId: null };
  }
  const record = await clockIn({ userId }, userId);
  return { clockedIn: true, since: record.clockIn, attendanceId: record.id };
}

export async function clockOut(input: unknown, approvedById: number) {
  const data = parseInput(ClockOutInputSchema, input);

  const record = await repo.findAttendanceById(data.attendanceId);
  if (!record) {
    throw setErrorStatus(new Error('Record not found'), 404);
  }

  const updateData: Record<string, unknown> = {};
  if (data.notes !== undefined) updateData.notes = data.notes;

  const outTime = data.clockOut ? new Date(data.clockOut) : new Date();

  if (!record.clockOut) {
    updateData.clockOut = outTime;
    const breakMins = data.breakStart && data.breakEnd
      ? (new Date(data.breakEnd).getTime() - new Date(data.breakStart).getTime()) / 60000
      : record.breakStart && record.breakEnd
        ? (record.breakEnd.getTime() - record.breakStart.getTime()) / 60000
        : 0;
    const totalMs = outTime.getTime() - (record.clockIn as Date).getTime() - breakMins * 60000;
    updateData.totalHours = Math.round((totalMs / 3600000) * 100) / 100;
  }

  if (data.breakStart) updateData.breakStart = new Date(data.breakStart);
  if (data.breakEnd) updateData.breakEnd = new Date(data.breakEnd);

  const updated = await repo.updateAttendance(data.attendanceId, updateData);
  emitEvent('attendance-update', updated);
  return updated;
}

export async function listAttendance(input: unknown) {
  const params = parseInput(ListAttendanceParamsSchema, input);
  const filters: { userId?: number; from?: string | null; to?: string | null } = {};
  if (params.userId !== undefined) filters.userId = params.userId;
  if (params.from !== undefined) filters.from = params.from;
  if (params.to !== undefined) filters.to = params.to;
  return repo.listAttendances(filters);
}

export async function listLeaveRequests(input: unknown) {
  const params = parseInput(ListLeaveRequestsParamsSchema, input);
  const filters: { userId?: number; status?: string } = {};
  if (params.userId !== undefined) filters.userId = params.userId;
  if (params.status) filters.status = params.status;
  return repo.listLeaveRequests(filters);
}

export async function createLeaveRequest(input: unknown, approvedById: number) {
  const data = parseInput(CreateLeaveRequestInputSchema, input);

  const request = await repo.createLeaveRequest({
    userId: data.userId,
    leaveTypeId: data.leaveTypeId,
    startDate: new Date(data.startDate),
    endDate: new Date(data.endDate),
    reason: data.reason ?? null,
  });

  return request;
}

export async function updateLeaveRequest(input: unknown, approvedById: number) {
  const data = parseInput(UpdateLeaveRequestInputSchema, input);

  if (data.status === 'APPROVED' || data.status === 'REJECTED') {
    if (!approvedById) {
      throw setErrorStatus(new Error('Approver required'), 400);
    }
  }

  const updated = await repo.updateLeaveRequest(data.id, {
    status: data.status,
    notes: data.notes ?? null,
    approvedById: approvedById,
    approvedAt: new Date(),
  });

  return updated;
}

export async function listLeaveTypes() {
  return repo.listActiveLeaveTypes();
}

export async function upsertLeaveType(input: unknown, approvedById: number) {
  const data = parseInput(UpsertLeaveTypeInputSchema, input);

  if (data.id) {
    const existing = await repo.findLeaveTypeById(data.id);
    if (!existing) {
      throw setErrorStatus(new Error('Leave type not found'), 404);
    }
    try {
      return await repo.updateLeaveType(data.id, {
        name: data.name,
        daysPerYear: data.daysPerYear,
        isActive: data.isActive,
      });
    } catch (e: any) {
      if (e.code === 'P2002') {
        throw setErrorStatus(new Error('Leave type name already exists'), 409);
      }
      throw e;
    }
  }

  try {
    return await repo.createLeaveType({
      name: data.name,
      daysPerYear: data.daysPerYear ?? 0,
      isActive: data.isActive ?? true,
    });
  } catch (e: any) {
    if (e.code === 'P2002') {
      throw setErrorStatus(new Error('Leave type name already exists'), 409);
    }
    throw e;
  }
}

export async function listPerformanceReviews(input: unknown) {
  const params = parseInput(ListPerformanceReviewsParamsSchema, input);
  const filters: { userId?: number } = {};
  if (params.userId !== undefined) filters.userId = params.userId;
  return repo.listPerformanceReviews(filters);
}

export async function createPerformanceReview(input: unknown, approvedById: number) {
  const data = parseInput(CreatePerformanceReviewInputSchema, input);

  const review = await repo.createPerformanceReview({
    userId: data.userId,
    reviewerId: approvedById,
    period: data.period,
    rating: data.rating,
    strengths: data.strengths ?? null,
    improvements: data.improvements ?? null,
    goals: data.goals ?? null,
    notes: data.notes ?? null,
  });

  return review;
}

export { ValidationError };
