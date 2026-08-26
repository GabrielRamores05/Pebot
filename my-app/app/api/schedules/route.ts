import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requirePermission } from '@/lib/auth';

// GET /api/schedules?from=YYYY-MM-DD&to=YYYY-MM-DD&userId=X
export async function GET(req: NextRequest) {
  const auth = await requirePermission(req, 'staff');
  if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const from = searchParams.get('from');
  const to = searchParams.get('to');
  const userId = searchParams.get('userId');

  const where: Record<string, unknown> = {};
  if (from || to) {
    where.date = {};
    if (from) (where.date as Record<string, Date>).gte = new Date(from);
    if (to) (where.date as Record<string, Date>).lte = new Date(to);
  }
  if (userId) where.userId = Number(userId);

  const schedules = await prisma.schedule.findMany({
    where,
    include: { user: { select: { id: true, name: true, position: true } }, shift: true },
    orderBy: { date: 'asc' },
  });
  return NextResponse.json(schedules);
}

// POST /api/schedules — create schedule entries
export async function POST(req: NextRequest) {
  const auth = await requirePermission(req, 'staff');
  if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  try {
    const body = await req.json();
    const { userId, shiftId, dates, status } = body as {
      userId: number; shiftId: number; dates: string[]; status?: string;
    };
    if (!userId || !shiftId || !dates?.length) {
      return NextResponse.json({ error: 'userId, shiftId, dates required' }, { status: 400 });
    }

    const results = [];
    for (const d of dates) {
      const entry = await prisma.schedule.upsert({
        where: { userId_date: { userId, date: new Date(d) } },
        update: { shiftId, status: status ?? 'SCHEDULED' },
        create: { userId, shiftId, date: new Date(d), status: status ?? 'SCHEDULED' },
      });
      results.push(entry);
    }
    return NextResponse.json({ count: results.length }, { status: 201 });
  } catch (e) {
    return NextResponse.json({ error: 'Failed to create schedules' }, { status: 500 });
  }
}

// PUT /api/schedules — update a schedule entry (pass id in body)
export async function PUT(req: NextRequest) {
  const auth = await requirePermission(req, 'staff');
  if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  try {
    const body = await req.json();
    const { id, ...data } = body;
    if (!id) return NextResponse.json({ error: 'id required' }, { status: 400 });
    if (data.shiftId) data.shiftId = Number(data.shiftId);
    if (data.userId) data.userId = Number(data.userId);
    const schedule = await prisma.schedule.update({ where: { id }, data });
    return NextResponse.json(schedule);
  } catch (e) {
    return NextResponse.json({ error: 'Failed to update schedule' }, { status: 500 });
  }
}

// DELETE /api/schedules — delete a schedule entry (pass id in body)
export async function DELETE(req: NextRequest) {
  const auth = await requirePermission(req, 'staff');
  if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  try {
    const body = await req.json();
    if (!body?.id) return NextResponse.json({ error: 'id required' }, { status: 400 });
    await prisma.schedule.delete({ where: { id: body.id } });
    return NextResponse.json({ success: true });
  } catch (e) {
    return NextResponse.json({ error: 'Failed to delete schedule' }, { status: 500 });
  }
}
