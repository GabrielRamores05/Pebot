import { NextRequest, NextResponse } from 'next/server';
import { guardPermission } from '@/lib/api-guards';
import { apiError, serverError } from '@/lib/api-response';
import { profitReport } from '@/modules/reports/service';

// GET /api/reports/profit?from=YYYY-MM-DD&to=YYYY-MM-DD (spec 022). Analytics permission.
export async function GET(req: NextRequest) {
  const guard = await guardPermission(req, 'analytics');
  if (guard.error) return guard.error;
  try {
    const q = req.nextUrl.searchParams;
    return NextResponse.json(await profitReport(q.get('from') ?? '', q.get('to') ?? ''));
  } catch (e) {
    const status = (e as { status?: number })?.status;
    if (status === 400) return apiError((e as Error).message, 400);
    return serverError(e, 'Failed to build the profit report');
  }
}
