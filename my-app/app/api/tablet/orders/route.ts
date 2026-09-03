import { NextRequest, NextResponse } from 'next/server';
import { apiError, serverError, unauthorized } from '@/lib/api-response';
import { verifyTabletDeviceSecret } from '@/modules/system/service';
import { ingestTabletOrder } from '@/modules/orders/service';

// POST /api/tablet/orders — device-authenticated order ingest. The tablet sends
// only identities (product/option names, discount reason); the PC derives money,
// loyalty, stock and the canonical receipt sequence through the orders service,
// and the normal web socket events fire so PC screens update live.
export async function POST(req: NextRequest) {
  try {
    const auth = req.headers.get('authorization');
    const secret = auth?.startsWith('Bearer ') ? auth.slice(7) : null;
    const device = await verifyTabletDeviceSecret(secret);
    if (!device) return unauthorized('Unknown or revoked tablet device');

    const body = await req.json().catch(() => null);
    if (!body || typeof body !== 'object' || !Array.isArray(body.items) || body.items.length === 0) {
      return apiError('Invalid order payload', 400);
    }

    const result = await ingestTabletOrder(body);
    return NextResponse.json(result, { status: 201 });
  } catch (e: any) {
    if (e?.status && typeof e?.message === 'string') {
      return apiError(e.message, e.status);
    }
    console.error('[TABLET ORDERS] failed', e);
    return serverError(e, 'Failed to ingest tablet order');
  }
}
