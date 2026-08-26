import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requirePermission } from '@/lib/auth';

// GET /api/leave-types
export async function GET() {
  const types = await prisma.leaveType.findMany({ where: { isActive: true }, orderBy: { name: 'asc' } });
  return NextResponse.json(types);
}

// POST /api/leave-types — create or update leave type
export async function POST(req: NextRequest) {
  const auth = await requirePermission(req, 'staff');
  if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  try {
    const body = await req.json();
    const { id, name, daysPerYear, isActive } = body;
    if (!name) return NextResponse.json({ error: 'name required' }, { status: 400 });

    if (id) {
      const updated = await prisma.leaveType.update({
        where: { id },
        data: { name, daysPerYear: daysPerYear ?? undefined, isActive: isActive ?? undefined },
      });
      return NextResponse.json(updated);
    }
    const created = await prisma.leaveType.create({
      data: { name, daysPerYear: daysPerYear ?? 0, isActive: isActive ?? true },
    });
    return NextResponse.json(created, { status: 201 });
  } catch (e: any) {
    if (e.code === 'P2002') return NextResponse.json({ error: 'Leave type name already exists' }, { status: 409 });
    return NextResponse.json({ error: 'Failed' }, { status: 500 });
  }
}
