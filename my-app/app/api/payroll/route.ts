import { NextRequest, NextResponse } from 'next/server';
import { listPayrolls, createPayroll, updatePayrollStatus } from '@/modules/finance/service';
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
    const records = await listPayrolls(params);
    return NextResponse.json(records);
  } catch (e) {
    return serverError(e);
  }
}

export async function POST(req: NextRequest) {
  const auth = await requirePermission(req, 'staff');
  if (!auth) return unauthorized();

  try {
    const body = await req.json();
    const payroll = await createPayroll(body, auth.userId);
    return NextResponse.json(payroll, { status: 201 });
  } catch (e) {
    if (e instanceof ValidationError) {
      return badRequest(e.message);
    }
    const status = (e as { status?: number })?.status ?? 500;
    if (status === 404) return NextResponse.json({ error: String(e) }, { status: 404 });
    return serverError(e, 'Failed to generate payroll');
  }
}

export async function PUT(req: NextRequest) {
  const auth = await requirePermission(req, 'staff');
  if (!auth) return unauthorized();

  try {
    const body = await req.json();
    const updated = await updatePayrollStatus(body);
    return NextResponse.json(updated);
  } catch (e) {
    if (e instanceof ValidationError) {
      return badRequest(e.message);
    }
    return serverError(e, 'Failed to update payroll');
  }
}
