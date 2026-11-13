import { NextRequest, NextResponse } from 'next/server';
import { apiError, badRequest, serverError } from '@/lib/api-response';
import { ActivateInputSchema } from '@/modules/license/schema';
import { activateLicense, isLocalRequest } from '@/modules/license/service';

export const dynamic = 'force-dynamic';

// POST /api/license/activate { key }: activate this PC (main PC only).
export async function POST(req: NextRequest) {
  const parsed = ActivateInputSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return badRequest(parsed.error.issues[0]?.message ?? 'Paste your license key');
  try {
    const result = await activateLicense(parsed.data.key, isLocalRequest(req), req);
    if (!result.ok) return apiError(result.message, result.status, { reason: result.reason });
    return NextResponse.json({ state: 'active', licenseNo: result.value.licenseNo });
  } catch (e) {
    return serverError(e, 'Failed to activate the license');
  }
}
