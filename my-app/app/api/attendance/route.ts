import { NextRequest, NextResponse } from 'next/server';
import { clockIn, clockOut, listAttendance } from '@/modules/hr/service';
import { requirePermission, getAuthUser } from '@/lib/auth';
import { badRequest, notFound, serverError, unauthorized } from '@/lib/api-response';
import { ValidationError } from 'zod-validation-error';

export async function POST(req: NextRequest) {
  const auth = await getAuthUser(req);
  if (!auth) return unauthorized();

  try {
    const body = await req.json();
    const record = await clockIn(body, auth.userId);
    return NextResponse.json(record, { status: 201 });
  } catch (e) {
    if (e instanceof ValidationError) {
      return badRequest(e.message);
    }
    const status = (e as { status?: number })?.status ?? 500;
    if (status === 404) return notFound(String(e));
    if (status === 409) return NextResponse.json({ error: String(e) }, { status: 409 });
    return serverError(e, 'Failed to clock in');
  }
}

export async function PUT(req: NextRequest) {
  const auth = await getAuthUser(req);
  if (!auth) return unauthorized();

  try {
    const body = await req.json();
    const updated = await clockOut(body, auth.userId);
    return NextResponse.json(updated);
  } catch (e) {
    if (e instanceof ValidationError) {
      return badRequest(e.message);
    }
    const status = (e as { status?: number })?.status ?? 500;
    if (status === 404) return notFound(String(e));
    return serverError(e, 'Failed to update attendance');
  }
}

export async function GET(req: NextRequest) {
  const auth = await requirePermission(req, 'staff');
  if (!auth) return unauthorized();

  try {
    const { searchParams } = new URL(req.url);
    const params: Record<string, unknown> = {};
    const userId = searchParams.get('userId');
    const from = searchParams.get('from');
    const to = searchParams.get('to');
    if (userId) params.userId = Number(userId);
    if (from) params.from = from;
    if (to) params.to = to;
    const records = await listAttendance(params);
    return NextResponse.json(records);
  } catch (e) {
    return serverError(e);
  }
}
