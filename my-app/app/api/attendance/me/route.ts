import { NextRequest, NextResponse } from 'next/server';
import { getAuthUser } from '@/lib/auth';
import { apiError, serverError, unauthorized } from '@/lib/api-response';
import { myShift, toggleMyShift } from '@/modules/hr/service';

// GET  /api/attendance/me — am I clocked in? (spec 020)
// POST /api/attendance/me — clock in, or clock out if already in.
export async function GET(req: NextRequest) {
  const user = await getAuthUser(req);
  if (!user) return unauthorized();
  try {
    return NextResponse.json(await myShift(user.userId));
  } catch (e) {
    return serverError(e);
  }
}

export async function POST(req: NextRequest) {
  const user = await getAuthUser(req);
  if (!user) return unauthorized();
  try {
    return NextResponse.json(await toggleMyShift(user.userId));
  } catch (e) {
    const status = (e as { status?: number })?.status;
    if (status && status < 500) return apiError((e as Error).message, status);
    return serverError(e);
  }
}
