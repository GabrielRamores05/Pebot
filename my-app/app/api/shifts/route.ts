import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requirePermission } from '@/lib/auth';

// GET /api/shifts — list all shift templates
export async function GET(req: NextRequest) {
  const auth = await requirePermission(req, 'staff');
  if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const shifts = await prisma.shift.findMany({ orderBy: { sortOrder: 'asc' } });
  return NextResponse.json(shifts);
}

// POST /api/shifts — create a shift template
export async function POST(req: NextRequest) {
  const auth = await requirePermission(req, 'staff');
  if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  try {
    const body = await req.json();
    const { name, startTime, endTime, breakMinutes, sortOrder } = body;
    if (!name || !startTime || !endTime) {
      return NextResponse.json({ error: 'name, startTime, endTime required' }, { status: 400 });
    }
    const shift = await prisma.shift.create({
      data: { name, startTime, endTime, breakMinutes: breakMinutes ?? 0, sortOrder: sortOrder ?? 0 },
    });
    return NextResponse.json(shift, { status: 201 });
  } catch (e) {
    return NextResponse.json({ error: 'Failed to create shift' }, { status: 500 });
  }
}

// PUT /api/shifts — update a shift (pass id in body)
export async function PUT(req: NextRequest) {
  const auth = await requirePermission(req, 'staff');
  if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  try {
    const body = await req.json();
    const { id, ...data } = body;
    if (!id) return NextResponse.json({ error: 'id required' }, { status: 400 });
    const shift = await prisma.shift.update({ where: { id }, data });
    return NextResponse.json(shift);
  } catch (e) {
    return NextResponse.json({ error: 'Failed to update shift' }, { status: 500 });
  }
}

// DELETE /api/shifts — delete a shift (pass id in body)
export async function DELETE(req: NextRequest) {
  const auth = await requirePermission(req, 'staff');
  if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  try {
    const body = await req.json();
    if (!body?.id) return NextResponse.json({ error: 'id required' }, { status: 400 });
    await prisma.shift.delete({ where: { id: body.id } });
    return NextResponse.json({ success: true });
  } catch (e) {
    return NextResponse.json({ error: 'Failed to delete shift' }, { status: 500 });
  }
}
