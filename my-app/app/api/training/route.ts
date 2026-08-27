import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requirePermission } from '@/lib/auth';
import { badRequest, serverError, unauthorized } from '@/lib/api-response';

// GET /api/training — list courses with enrollment counts
export async function GET(req: NextRequest) {
  const auth = await requirePermission(req, 'staff');
  if (!auth) return unauthorized();

  const training = await prisma.training.findMany({
    where: { isActive: true },
    include: { enrollments: true },
    orderBy: { name: 'asc' },
  });
  return NextResponse.json(training);
}

// POST /api/training — create a course
export async function POST(req: NextRequest) {
  const auth = await requirePermission(req, 'staff');
  if (!auth) return unauthorized();

  try {
    const body = await req.json();
    const { name, description, duration } = body;
    if (!name) return badRequest('name required');
    const training = await prisma.training.create({
      data: { name, description: description || null, duration: duration || null },
    });
    return NextResponse.json(training, { status: 201 });
  } catch (e) {
    return serverError(e, 'Failed to create training');
  }
}
