import { NextRequest, NextResponse } from 'next/server';
import { apiError, badRequest, serverError } from '@/lib/api-response';
import { guardAdmin } from '@/lib/api-guards';
import { DeactivateInputSchema } from '@/modules/license/schema';
import { deactivateLicense, isLocalRequest } from '@/modules/license/service';

export const dynamic = 'force-dynamic';

// POST /api/license/deactivate { confirm: true }: move the license off this PC (admin, main PC only).
export async function POST(req: NextRequest) {
  const { error } = await guardAdmin(req);
  if (error) return error;
  const parsed = DeactivateInputSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return badRequest('Confirmation is required');
  try {
    const result = await deactivateLicense(isLocalRequest(req), req);
    if (!result.ok) return apiError(result.message, result.status, { reason: result.reason });
    return NextResponse.json(result.value);
  } catch (e) {
    return serverError(e, 'Failed to deactivate the license');
  }
}
