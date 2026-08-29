import { describe, it, expect, vi, beforeEach } from 'vitest';

const mocks = vi.hoisted(() => ({
  findUserById: vi.fn(),
  findActiveAttendance: vi.fn(),
  createAttendance: vi.fn(),
  findAttendanceById: vi.fn(),
  updateAttendance: vi.fn(),
  listAttendances: vi.fn(),
  listLeaveRequests: vi.fn(),
  createLeaveRequest: vi.fn(),
  updateLeaveRequest: vi.fn(),
  listActiveLeaveTypes: vi.fn(),
  findLeaveTypeById: vi.fn(),
  createLeaveType: vi.fn(),
  updateLeaveType: vi.fn(),
  listPerformanceReviews: vi.fn(),
  createPerformanceReview: vi.fn(),
}));

vi.mock('../../../modules/hr/repository', () => mocks);
vi.mock('@/lib/socket', () => ({ emitEvent: vi.fn() }));

import {
  clockIn,
  clockOut,
  listAttendance,
  listLeaveRequests,
  createLeaveRequest,
  updateLeaveRequest,
  listLeaveTypes,
  upsertLeaveType,
  listPerformanceReviews,
  createPerformanceReview,
} from '../../../modules/hr/service';

describe('hr service', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('clockIn', () => {
    it('throws 404 when user not found', async () => {
      mocks.findUserById.mockResolvedValue(null);
      await expect(clockIn({ userId: 999 }, 1)).rejects.toMatchObject({ status: 404 });
    });

    it('throws 409 when already clocked in', async () => {
      mocks.findUserById.mockResolvedValue({ id: 1 });
      mocks.findActiveAttendance.mockResolvedValue({ id: 5 });
      await expect(clockIn({ userId: 1 }, 1)).rejects.toMatchObject({ status: 409 });
    });

    it('creates attendance record when valid', async () => {
      mocks.findUserById.mockResolvedValue({ id: 1 });
      mocks.findActiveAttendance.mockResolvedValue(null);
      mocks.createAttendance.mockResolvedValue({ id: 1, userId: 1, clockIn: new Date() });
      const result = await clockIn({ userId: 1, notes: 'late' }, 1);
      expect(mocks.createAttendance).toHaveBeenCalledWith({
        userId: 1, clockIn: expect.any(Date), notes: 'late',
      });
      expect(result.id).toBe(1);
    });

    it('throws ValidationError on missing userId', async () => {
      await expect(clockIn({}, 1)).rejects.toThrow();
    });
  });

  describe('clockOut', () => {
    it('throws 404 when attendance record not found', async () => {
      mocks.findAttendanceById.mockResolvedValue(null);
      await expect(clockOut({ attendanceId: 999 }, 1)).rejects.toMatchObject({ status: 404 });
    });

    it('calculates totalHours when clocking out', async () => {
      mocks.findAttendanceById.mockResolvedValue({
        id: 1, clockIn: new Date('2025-01-01T08:00:00'), clockOut: null, breakStart: null, breakEnd: null,
      });
      mocks.updateAttendance.mockResolvedValue({ id: 1, totalHours: 8 });
      const result = await clockOut({ attendanceId: 1 }, 1);
      expect(mocks.updateAttendance).toHaveBeenCalledWith(1, expect.objectContaining({
        clockOut: expect.any(Date),
        totalHours: expect.any(Number),
      }));
    });

    it('throws ValidationError on missing attendanceId', async () => {
      await expect(clockOut({}, 1)).rejects.toThrow();
    });
  });

  describe('listAttendance', () => {
    it('calls repository with no filters by default', async () => {
      mocks.listAttendances.mockResolvedValue([]);
      await listAttendance({});
      expect(mocks.listAttendances).toHaveBeenCalledWith({ userId: undefined, from: undefined, to: undefined });
    });

    it('passes userId filter through', async () => {
      mocks.listAttendances.mockResolvedValue([]);
      await listAttendance({ userId: 5 });
      expect(mocks.listAttendances).toHaveBeenCalledWith({ userId: 5, from: undefined, to: undefined });
    });
  });

  describe('listLeaveRequests', () => {
    it('calls repository with status filter', async () => {
      mocks.listLeaveRequests.mockResolvedValue([]);
      await listLeaveRequests({ status: 'PENDING' });
      expect(mocks.listLeaveRequests).toHaveBeenCalledWith({ userId: undefined, status: 'PENDING' });
    });
  });

  describe('createLeaveRequest', () => {
    it('creates leave request with PENDING status', async () => {
      mocks.createLeaveRequest.mockResolvedValue({ id: 1, status: 'PENDING' });
      const result = await createLeaveRequest(
        { userId: 1, leaveTypeId: 2, startDate: '2025-01-01', endDate: '2025-01-05' },
        1,
      );
      expect(mocks.createLeaveRequest).toHaveBeenCalledWith({
        userId: 1, leaveTypeId: 2,
        startDate: new Date('2025-01-01T00:00:00.000Z'),
        endDate: new Date('2025-01-05T00:00:00.000Z'),
        reason: null,
      });
      expect(result.id).toBe(1);
    });

    it('throws ValidationError on missing fields', async () => {
      await expect(createLeaveRequest({ userId: 1 }, 1)).rejects.toThrow();
    });
  });

  describe('updateLeaveRequest', () => {
    it('throws 400 when approver is required for APPROVED status', async () => {
      await expect(updateLeaveRequest({ id: 1, status: 'APPROVED' }, 0)).rejects.toMatchObject({ status: 400 });
    });

    it('updates leave request with approver info', async () => {
      mocks.updateLeaveRequest.mockResolvedValue({ id: 1, status: 'APPROVED' });
      const result = await updateLeaveRequest({ id: 1, status: 'APPROVED' }, 5);
      expect(mocks.updateLeaveRequest).toHaveBeenCalledWith(1, expect.objectContaining({
        status: 'APPROVED', approvedById: 5, approvedAt: expect.any(Date),
      }));
      expect(result.status).toBe('APPROVED');
    });
  });

  describe('listLeaveTypes', () => {
    it('calls repository', async () => {
      mocks.listActiveLeaveTypes.mockResolvedValue([]);
      await listLeaveTypes();
      expect(mocks.listActiveLeaveTypes).toHaveBeenCalled();
    });
  });

  describe('upsertLeaveType', () => {
    it('creates new leave type when no id', async () => {
      mocks.createLeaveType.mockResolvedValue({ id: 1, name: 'Vacation' });
      const result = await upsertLeaveType({ name: 'Vacation', daysPerYear: 10 }, 1);
      expect(mocks.createLeaveType).toHaveBeenCalledWith({ name: 'Vacation', daysPerYear: 10, isActive: true });
      expect(result.id).toBe(1);
    });

    it('throws 404 when updating non-existent leave type', async () => {
      mocks.findLeaveTypeById.mockResolvedValue(null);
      await expect(upsertLeaveType({ id: 999, name: 'Test' }, 1)).rejects.toMatchObject({ status: 404 });
    });

    it('updates existing leave type', async () => {
      mocks.findLeaveTypeById.mockResolvedValue({ id: 1, name: 'Old' });
      mocks.updateLeaveType.mockResolvedValue({ id: 1, name: 'New' });
      const result = await upsertLeaveType({ id: 1, name: 'New', daysPerYear: 5 }, 1);
      expect(mocks.updateLeaveType).toHaveBeenCalled();
      expect(result.name).toBe('New');
    });

    it('throws 409 on unique constraint error during create', async () => {
      const err = new Error('duplicate');
      (err as any).code = 'P2002';
      mocks.createLeaveType.mockRejectedValue(err);
      await expect(upsertLeaveType({ name: 'Duplicate' }, 1)).rejects.toMatchObject({ status: 409 });
    });
  });

  describe('listPerformanceReviews', () => {
    it('calls repository with no filters by default', async () => {
      mocks.listPerformanceReviews.mockResolvedValue([]);
      await listPerformanceReviews({});
      expect(mocks.listPerformanceReviews).toHaveBeenCalledWith({ userId: undefined });
    });
  });

  describe('createPerformanceReview', () => {
    it('creates review with reviewerId from approvedById', async () => {
      mocks.createPerformanceReview.mockResolvedValue({ id: 1, userId: 1, period: 'Q1' });
      const result = await createPerformanceReview(
        { userId: 1, period: 'Q1', rating: 5 },
        10,
      );
      expect(mocks.createPerformanceReview).toHaveBeenCalledWith({
        userId: 1, reviewerId: 10, period: 'Q1', rating: 5,
        strengths: null, improvements: null, goals: null, notes: null,
      });
      expect(result.id).toBe(1);
    });

    it('throws ValidationError on missing fields', async () => {
      await expect(createPerformanceReview({ userId: 1 }, 1)).rejects.toThrow();
    });

    it('throws ValidationError on invalid rating', async () => {
      await expect(createPerformanceReview({ userId: 1, period: 'Q1', rating: 10 }, 1)).rejects.toThrow();
    });
  });
});
