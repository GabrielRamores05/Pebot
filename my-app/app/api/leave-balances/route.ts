import { NextRequest, NextResponse } from 'next/server';
import { ValidationError } from 'zod-validation-error';
import { requirePermission } from '@/lib/auth';
import { badRequest, serverError, unauthorized } from '@/lib/api-response';
import { leaveBalances } from '@/modules/hr/service';

// GET /api/leave-balances?year=2026 (spec 021)
export async function GET(req: NextRequest) {
  const auth = await requirePermission(req, 'staff');
  if (!auth) return unauthorized();
  try {
    const year = Number(req.nextUrl.searchParams.get('year') || new Date().getFullYear());
    if (!Number.isInteger(year) || year < 2000 || year > 2100) return badRequest('Invalid year');
    return NextResponse.json(await leaveBalances(year));
  } catch (e) {
    if (e instanceof ValidationError) return badRequest(e.message);
    return serverError(e);
  }
}
