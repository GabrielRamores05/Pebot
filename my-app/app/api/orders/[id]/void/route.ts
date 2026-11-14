import { NextRequest, NextResponse } from 'next/server';
import { ValidationError } from 'zod-validation-error';
import { guardPermission } from '@/lib/api-guards';
import { apiError, serverError } from '@/lib/api-response';
import { voidOrder } from '@/modules/orders/service';

// POST /api/orders/:id/void { reason, pin } — void or refund with a manager PIN (spec 020)
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const guard = await guardPermission(req, 'terminal');
  if (guard.error) return guard.error;
  try {
    const { id } = await params;
    const order = await voidOrder(id, await req.json(), { userId: guard.user!.userId, name: guard.user!.name });
    return NextResponse.json(order);
  } catch (e) {
    if (e instanceof ValidationError) return apiError(e.message, 400);
    const status = (e as { status?: number })?.status;
    if (status && status >= 400 && status < 500) return apiError((e as Error).message, status);
    return serverError(e, 'Could not void the order');
  }
}
