import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requirePermission } from '@/lib/auth';
import { badRequest, serverError, unauthorized } from '@/lib/api-response';

// GET /api/performance-reviews?userId=X
export async function GET(req: NextRequest) {
  const auth = await requirePermission(req, 'staff');
  if (!auth) return unauthorized();

  const { searchParams } = new URL(req.url);
  const userId = searchParams.get('userId');
  const where: Record<string, unknown> = {};
  if (userId) where.userId = Number(userId);

  const reviews = await prisma.performanceReview.findMany({
    where,
    include: {
      user: { select: { id: true, name: true, position: true } },
      reviewer: { select: { id: true, name: true } },
    },
    orderBy: { createdAt: 'desc' },
  });
  return NextResponse.json(reviews);
}

// POST /api/performance-reviews — create a review
export async function POST(req: NextRequest) {
  const auth = await requirePermission(req, 'staff');
  if (!auth) return unauthorized();

  try {
    const body = await req.json();
    const { userId, period, rating, strengths, improvements, goals, notes } = body;
    if (!userId || !period || !rating) {
      return badRequest('userId, period, rating required');
    }
    const review = await prisma.performanceReview.create({
      data: {
        userId, reviewerId: auth.userId, period, rating: Number(rating),
        strengths: strengths || null, improvements: improvements || null,
        goals: goals || null, notes: notes || null,
      },
      include: { user: { select: { id: true, name: true } }, reviewer: { select: { id: true, name: true } } },
    });
    return NextResponse.json(review, { status: 201 });
  } catch (e) {
    return serverError(e, 'Failed to create review');
  }
}
