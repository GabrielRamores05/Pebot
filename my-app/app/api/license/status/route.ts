import { NextRequest, NextResponse } from 'next/server';
import { serverError } from '@/lib/api-response';
import { getLicenseStatus, isLocalRequest } from '@/modules/license/service';

export const dynamic = 'force-dynamic';

// GET /api/license/status: license state. The Machine Code is only shown to the main PC.
export async function GET(req: NextRequest) {
  try {
    return NextResponse.json(getLicenseStatus(isLocalRequest(req)), { headers: { 'Cache-Control': 'no-store' } });
  } catch (e) {
    return serverError(e, 'Failed to read license status');
  }
}
