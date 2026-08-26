import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requirePermission, getAuthUser } from '@/lib/auth';

// POST /api/attendance/clock-in — { userId }
export async function POST(req: NextRequest) {
  const auth = await getAuthUser(req);
  if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  try {
    const body = await req.json();
    const { userId, notes } = body;
    if (!userId) return NextResponse.json({ error: 'userId required' }, { status: 400 });

    const user = await prisma.user.findUnique({ where: { id: Number(userId) } });
    if (!user) return NextResponse.json({ error: 'User not found' }, { status: 404 });

    // Check for an active (unclocked) session
    const active = await prisma.attendance.findFirst({
      where: { userId: Number(userId), clockOut: null },
      orderBy: { clockIn: 'desc' },
    });
    if (active) {
      return NextResponse.json({ error: 'Already clocked in. Clock out first.', activeId: active.id }, { status: 409 });
    }

    const record = await prisma.attendance.create({
      data: { userId, clockIn: new Date(), notes: notes || null },
    });
    return NextResponse.json(record, { status: 201 });
  } catch (e) {
    return NextResponse.json({ error: 'Failed to clock in' }, { status: 500 });
  }
}

// PUT /api/attendance/clock-in — clock out: { attendanceId, breakStart, breakEnd }
// Also serves as general attendance update
export async function PUT(req: NextRequest) {
  const auth = await getAuthUser(req);
  if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  try {
    const body = await req.json();
    const { attendanceId, clockOut, breakStart, breakEnd, notes } = body;
    if (!attendanceId) return NextResponse.json({ error: 'attendanceId required' }, { status: 400 });

    const record = await prisma.attendance.findUnique({ where: { id: attendanceId } });
    if (!record) return NextResponse.json({ error: 'Record not found' }, { status: 404 });

    const updateData: Record<string, unknown> = {};
    if (notes !== undefined) updateData.notes = notes;

    // Clock out
    const outTime = clockOut ? new Date(clockOut) : new Date();
    if (!record.clockOut) {
      updateData.clockOut = outTime;
      // Calculate total hours
      const breakMins = (breakStart && breakEnd)
        ? (new Date(breakEnd).getTime() - new Date(breakStart).getTime()) / 60000
        : (record.breakStart && record.breakEnd)
          ? (record.breakEnd.getTime() - record.breakStart.getTime()) / 60000
          : 0;
      const totalMs = outTime.getTime() - record.clockIn.getTime() - breakMins * 60000;
      updateData.totalHours = Math.round((totalMs / 3600000) * 100) / 100;
    }
    if (breakStart) updateData.breakStart = new Date(breakStart);
    if (breakEnd) updateData.breakEnd = new Date(breakEnd);

    const updated = await prisma.attendance.update({ where: { id: attendanceId }, data: updateData });
    return NextResponse.json(updated);
  } catch (e) {
    return NextResponse.json({ error: 'Failed to update attendance' }, { status: 500 });
  }
}

// GET /api/attendance?userId=X&from=Y&to=Z
export async function GET(req: NextRequest) {
  const auth = await requirePermission(req, 'staff');
  if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const userId = searchParams.get('userId');
  const from = searchParams.get('from');
  const to = searchParams.get('to');

  const where: Record<string, unknown> = {};
  if (userId) where.userId = Number(userId);
  if (from || to) {
    where.clockIn = {};
    if (from) (where.clockIn as Record<string, Date>).gte = new Date(from);
    if (to) (where.clockIn as Record<string, Date>).lte = new Date(to + 'T23:59:59');
  }

  const records = await prisma.attendance.findMany({
    where,
    include: { user: { select: { id: true, name: true, position: true } } },
    orderBy: { clockIn: 'desc' },
    take: 500,
  });
  return NextResponse.json(records);
}
