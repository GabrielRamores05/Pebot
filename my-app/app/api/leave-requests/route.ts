import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requirePermission } from '@/lib/auth';
import { badRequest, serverError, unauthorized } from '@/lib/api-response';

// GET /api/leave-requests?userId=X&status=PENDING
export async function GET(req: NextRequest) {
  const auth = await requirePermission(req, 'staff');
  if (!auth) return unauthorized();

  const { searchParams } = new URL(req.url);
  const userId = searchParams.get('userId');
  const status = searchParams.get('status');

  const where: Record<string, unknown> = {};
  if (userId) where.userId = Number(userId);
  if (status) where.status = status;

  const requests = await prisma.leaveRequest.findMany({
    where,
    include: { user: { select: { id: true, name: true, position: true } }, leaveType: true },
    orderBy: { createdAt: 'desc' },
  });
  return NextResponse.json(requests);
}

// POST /api/leave-requests — create a leave request
export async function POST(req: NextRequest) {
  const auth = await requirePermission(req, 'staff');
  if (!auth) return unauthorized();

  try {
    const body = await req.json();
    const { userId, leaveTypeId, startDate, endDate, reason } = body;
    if (!userId || !leaveTypeId || !startDate || !endDate) {
      return badRequest('userId, leaveTypeId, startDate, endDate required');
    }
    const request = await prisma.leaveRequest.create({
      data: {
        userId, leaveTypeId, startDate: new Date(startDate), endDate: new Date(endDate),
        reason: reason || null, status: 'PENDING',
      },
      include: { user: { select: { id: true, name: true } }, leaveType: true },
    });
    return NextResponse.json(request, { status: 201 });
  } catch (e) {
    return serverError(e, 'Failed to create leave request');
  }
}

// PUT /api/leave-requests — approve/reject: { id, status, notes }
export async function PUT(req: NextRequest) {
  const auth = await requirePermission(req, 'staff');
  if (!auth) return unauthorized();

  try {
    const body = await req.json();
    const { id, status, notes } = body;
    if (!id || !status) return badRequest('id and status required');

    const updated = await prisma.leaveRequest.update({
      where: { id },
      data: {
        status, notes: notes || null,
        approvedById: auth.userId, approvedAt: new Date(),
      },
    });
    return NextResponse.json(updated);
  } catch (e) {
    return serverError(e, 'Failed to update leave request');
  }
}
