import { NextRequest, NextResponse } from 'next/server';
import { listLeaveRequests, createLeaveRequest, updateLeaveRequest } from '@/modules/hr/service';
import { requirePermission } from '@/lib/auth';
import { badRequest, serverError, unauthorized } from '@/lib/api-response';
import { ValidationError } from 'zod-validation-error';

export async function GET(req: NextRequest) {
  const auth = await requirePermission(req, 'staff');
  if (!auth) return unauthorized();

  try {
    const { searchParams } = new URL(req.url);
    const params: Record<string, unknown> = {};
    const userId = searchParams.get('userId');
    const status = searchParams.get('status');
    if (userId) params.userId = Number(userId);
    if (status) params.status = status;
    const requests = await listLeaveRequests(params);
    return NextResponse.json(requests);
  } catch (e) {
    return serverError(e);
  }
}

export async function POST(req: NextRequest) {
  const auth = await requirePermission(req, 'staff');
  if (!auth) return unauthorized();

  try {
    const body = await req.json();
    const request = await createLeaveRequest(body, auth.userId);
    return NextResponse.json(request, { status: 201 });
  } catch (e) {
    if (e instanceof ValidationError) {
      return badRequest(e.message);
    }
    return serverError(e, 'Failed to create leave request');
  }
}

export async function PUT(req: NextRequest) {
  const auth = await requirePermission(req, 'staff');
  if (!auth) return unauthorized();

  try {
    const body = await req.json();
    const updated = await updateLeaveRequest(body, auth.userId);
    return NextResponse.json(updated);
  } catch (e) {
    if (e instanceof ValidationError) {
      return badRequest(e.message);
    }
    const status = (e as { status?: number })?.status ?? 500;
    if (status === 400) return NextResponse.json({ error: String(e) }, { status: 400 });
    return serverError(e, 'Failed to update leave request');
  }
}
