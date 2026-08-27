import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requirePermission } from '@/lib/auth';
import { badRequest, serverError, unauthorized } from '@/lib/api-response';

// POST /api/training/[id]/enroll — { userId }
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requirePermission(req, 'staff');
  if (!auth) return unauthorized();

  try {
    const { id } = await params;
    const body = await req.json();
    if (!body?.userId) return badRequest('userId required');
    const enrollment = await prisma.staffTraining.upsert({
      where: { userId_trainingId: { userId: Number(body.userId), trainingId: Number(id) } },
      update: { status: 'ENROLLED', completedAt: null, expiryDate: null },
      create: { userId: Number(body.userId), trainingId: Number(id), status: 'ENROLLED' },
    });
    return NextResponse.json(enrollment, { status: 201 });
  } catch (e) {
    return serverError(e, 'Failed to enroll');
  }
}

// PUT /api/training/[id]/enroll — mark complete: { userId, status, completedAt, expiryDate }
export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requirePermission(req, 'staff');
  if (!auth) return unauthorized();

  try {
    const { id } = await params;
    const body = await req.json();
    if (!body?.userId) return badRequest('userId required');
    const updateData: Record<string, unknown> = {};
    if (body.status) updateData.status = body.status;
    if (body.completedAt) updateData.completedAt = new Date(body.completedAt);
    if (body.expiryDate) updateData.expiryDate = new Date(body.expiryDate);
    const enrollment = await prisma.staffTraining.update({
      where: { userId_trainingId: { userId: Number(body.userId), trainingId: Number(id) } },
      data: updateData,
    });
    return NextResponse.json(enrollment);
  } catch (e) {
    return serverError(e, 'Failed to update enrollment');
  }
}
