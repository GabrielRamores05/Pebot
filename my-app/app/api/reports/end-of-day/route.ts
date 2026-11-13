import { NextRequest, NextResponse } from 'next/server';
import { guardPermission } from '@/lib/api-guards';
import { apiError, serverError } from '@/lib/api-response';
import { endOfDay } from '@/modules/reports/service';

// GET /api/reports/end-of-day?date=YYYY-MM-DD (spec 017, US5). Analytics permission.
export async function GET(req: NextRequest) {
  const guard = await guardPermission(req, 'analytics');
  if (guard.error) return guard.error;
  try {
    const date = req.nextUrl.searchParams.get('date') ?? '';
    return NextResponse.json(await endOfDay(date));
  } catch (e) {
    const status = (e as { status?: number })?.status;
    if (status === 400) return apiError((e as Error).message, 400);
    return serverError(e, 'Failed to build the end-of-day summary');
  }
}
