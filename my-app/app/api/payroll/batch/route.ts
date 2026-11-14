import { NextRequest, NextResponse } from 'next/server';
import { ValidationError } from 'zod-validation-error';
import { requirePermission } from '@/lib/auth';
import { badRequest, serverError, unauthorized } from '@/lib/api-response';
import { runPayrollForAll } from '@/modules/finance/service';

// POST /api/payroll/batch { periodStart, periodEnd, includeServiceCharge } (spec 021)
export async function POST(req: NextRequest) {
  const auth = await requirePermission(req, 'staff');
  if (!auth) return unauthorized();
  try {
    return NextResponse.json(await runPayrollForAll(await req.json(), auth.userId), { status: 201 });
  } catch (e) {
    if (e instanceof ValidationError) return badRequest(e.message);
    return serverError(e);
  }
}
