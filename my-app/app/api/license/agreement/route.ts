import { NextRequest, NextResponse } from 'next/server';
import { apiError, badRequest, serverError } from '@/lib/api-response';
import { AcceptAgreementInputSchema, AgreementLangSchema } from '@/modules/license/schema';
import { acceptAgreement, getAgreement, isLocalRequest } from '@/modules/license/service';

export const dynamic = 'force-dynamic';

// GET /api/license/agreement?lang=en|fil: the license agreement text.
export async function GET(req: NextRequest) {
  const lang = AgreementLangSchema.safeParse(req.nextUrl.searchParams.get('lang') ?? 'en');
  if (!lang.success) return badRequest('lang must be "en" or "fil"');
  try {
    return NextResponse.json(getAgreement(lang.data));
  } catch (e) {
    return serverError(e, 'Failed to load the license agreement');
  }
}

// POST /api/license/agreement { version }: record acceptance (main PC only).
export async function POST(req: NextRequest) {
  const parsed = AcceptAgreementInputSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return badRequest('version is required');
  try {
    const result = acceptAgreement(parsed.data.version, isLocalRequest(req));
    if (!result.ok) return apiError(result.message, result.status, { reason: result.reason });
    return NextResponse.json(result.value);
  } catch (e) {
    return serverError(e, 'Failed to save agreement acceptance');
  }
}
