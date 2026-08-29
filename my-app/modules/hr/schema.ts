import { z } from 'zod';

export const ClockInInputSchema = z.object({
  userId: z.number({ message: 'userId is required' }),
  notes: z.string().nullable().optional(),
});

export type ClockInInput = z.infer<typeof ClockInInputSchema>;

export const ClockOutInputSchema = z.object({
  attendanceId: z.number({ message: 'attendanceId is required' }),
  clockOut: z.string().datetime().optional(),
  breakStart: z.string().datetime().optional(),
  breakEnd: z.string().datetime().optional(),
  notes: z.string().nullable().optional(),
});

export type ClockOutInput = z.infer<typeof ClockOutInputSchema>;

export const ListAttendanceParamsSchema = z.object({
  userId: z.number().optional(),
  from: z.string().optional(),
  to: z.string().optional(),
});

export type ListAttendanceParams = z.infer<typeof ListAttendanceParamsSchema>;

export const CreateLeaveRequestInputSchema = z.object({
  userId: z.number({ message: 'userId is required' }),
  leaveTypeId: z.number({ message: 'leaveTypeId is required' }),
  startDate: z.string().min(1, 'startDate is required'),
  endDate: z.string().min(1, 'endDate is required'),
  reason: z.string().nullable().optional(),
});

export type CreateLeaveRequestInput = z.infer<typeof CreateLeaveRequestInputSchema>;

export const UpdateLeaveRequestInputSchema = z.object({
  id: z.number({ message: 'id is required' }),
  status: z.string().min(1, 'status is required'),
  notes: z.string().nullable().optional(),
});

export type UpdateLeaveRequestInput = z.infer<typeof UpdateLeaveRequestInputSchema>;

export const ListLeaveRequestsParamsSchema = z.object({
  userId: z.number().optional(),
  status: z.string().optional(),
});

export type ListLeaveRequestsParams = z.infer<typeof ListLeaveRequestsParamsSchema>;

export const UpsertLeaveTypeInputSchema = z.object({
  id: z.number().optional(),
  name: z.string().min(1, 'name is required'),
  daysPerYear: z.number().int().nonnegative().optional(),
  isActive: z.boolean().optional(),
});

export type UpsertLeaveTypeInput = z.infer<typeof UpsertLeaveTypeInputSchema>;

export const CreatePerformanceReviewInputSchema = z.object({
  userId: z.number({ message: 'userId is required' }),
  period: z.string().min(1, 'period is required'),
  rating: z.number().int().min(1).max(5),
  strengths: z.string().nullable().optional(),
  improvements: z.string().nullable().optional(),
  goals: z.string().nullable().optional(),
  notes: z.string().nullable().optional(),
});

export type CreatePerformanceReviewInput = z.infer<typeof CreatePerformanceReviewInputSchema>;

export const ListPerformanceReviewsParamsSchema = z.object({
  userId: z.number().optional(),
});

export type ListPerformanceReviewsParams = z.infer<typeof ListPerformanceReviewsParamsSchema>;
