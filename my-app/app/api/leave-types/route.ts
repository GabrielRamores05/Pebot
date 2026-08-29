import { NextRequest, NextResponse } from 'next/server';
import { listLeaveTypes, upsertLeaveType } from '@/modules/hr/service';
import { requirePermission } from '@/lib/auth';
import { conflict, serverError, unauthorized } from '@/lib/api-response';
import { ValidationError } from 'zod-validation-error';

export async function GET() {
  const types = await listLeaveTypes();
  return NextResponse.json(types);
}

export async function POST(req: NextRequest) {
  const auth = await requirePermission(req, 'staff');
  if (!auth) return unauthorized();

  try {
    const body = await req.json();
    const result = await upsertLeaveType(body, auth.userId);
    if ((body as { id?: number }).id) {
      return NextResponse.json(result);
    }
    return NextResponse.json(result, { status: 201 });
  } catch (e) {
    if (e instanceof ValidationError) {
      return NextResponse.json({ error: e.message }, { status: 400 });
    }
    const status = (e as { status?: number })?.status ?? 500;
    if (status === 409) return conflict(String(e));
    if (status === 404) return NextResponse.json({ error: String(e) }, { status: 404 });
    return serverError(e, 'Failed');
  }
}
