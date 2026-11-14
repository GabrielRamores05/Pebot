import { NextRequest, NextResponse } from 'next/server';
import { ValidationError } from 'zod-validation-error';
import { requirePermission } from '@/lib/auth';
import { badRequest, serverError, unauthorized } from '@/lib/api-response';
import { thirteenthMonthReport } from '@/modules/finance/service';

// GET /api/payroll/thirteenth-month?year=2026 (spec 021)
export async function GET(req: NextRequest) {
  const auth = await requirePermission(req, 'staff');
  if (!auth) return unauthorized();
  try {
    const year = Number(req.nextUrl.searchParams.get('year') || new Date().getFullYear());
    return NextResponse.json(await thirteenthMonthReport({ year }));
  } catch (e) {
    if (e instanceof ValidationError) return badRequest(e.message);
    return serverError(e);
  }
}
