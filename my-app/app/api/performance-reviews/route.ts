import { NextRequest, NextResponse } from 'next/server';
import { listPerformanceReviews, createPerformanceReview } from '@/modules/hr/service';
import { requirePermission } from '@/lib/auth';
import { badRequest, serverError, unauthorized } from '@/lib/api-response';
import { ValidationError } from 'zod-validation-error';

export async function GET(req: NextRequest) {
  const auth = await requirePermission(req, 'staff');
  if (!auth) return unauthorized();

  try {
    const { searchParams } = new URL(req.url);
    const userId = searchParams.get('userId');
    const params: Record<string, unknown> = {};
    if (userId) params.userId = Number(userId);
    const reviews = await listPerformanceReviews(params);
    return NextResponse.json(reviews);
  } catch (e) {
    return serverError(e);
  }
}

export async function POST(req: NextRequest) {
  const auth = await requirePermission(req, 'staff');
  if (!auth) return unauthorized();

  try {
    const body = await req.json();
    const review = await createPerformanceReview(body, auth.userId);
    return NextResponse.json(review, { status: 201 });
  } catch (e) {
    if (e instanceof ValidationError) {
      return badRequest(e.message);
    }
    return serverError(e, 'Failed to create review');
  }
}
