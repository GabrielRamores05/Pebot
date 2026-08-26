import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requirePermission } from '@/lib/auth';

// GET /api/training — list courses with enrollment counts
export async function GET(req: NextRequest) {
  const auth = await requirePermission(req, 'staff');
  if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

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
  if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  try {
    const body = await req.json();
    const { name, description, duration } = body;
    if (!name) return NextResponse.json({ error: 'name required' }, { status: 400 });
    const training = await prisma.training.create({
      data: { name, description: description || null, duration: duration || null },
    });
    return NextResponse.json(training, { status: 201 });
  } catch (e) {
    return NextResponse.json({ error: 'Failed to create training' }, { status: 500 });
  }
}
