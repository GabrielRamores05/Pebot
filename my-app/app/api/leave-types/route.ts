import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requirePermission } from '@/lib/auth';
import { badRequest, conflict, serverError, unauthorized } from '@/lib/api-response';

// GET /api/leave-types
export async function GET() {
  const types = await prisma.leaveType.findMany({ where: { isActive: true }, orderBy: { name: 'asc' } });
  return NextResponse.json(types);
}

// POST /api/leave-types — create or update leave type
export async function POST(req: NextRequest) {
  const auth = await requirePermission(req, 'staff');
  if (!auth) return unauthorized();

  try {
    const body = await req.json();
    const { id, name, daysPerYear, isActive } = body;
    if (!name) return badRequest('name required');

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
    if (e.code === 'P2002') return conflict('Leave type name already exists');
    return serverError(e, 'Failed');
  }
}
