import { NextRequest, NextResponse } from 'next/server';
import { apiError, serverError, unauthorized } from '@/lib/api-response';
import { verifyTabletDeviceSecret } from '@/modules/system/service';
import { updateOrder } from '@/modules/orders/service';

// PATCH /api/tablet/orders/[orderNumber] — device-authenticated status change
// (PREPARING / READY / COMPLETED / CANCELLED per web rules). The PC applies its
// own transition, stock-reversal, and voucher-release rules.
export async function PATCH(req: NextRequest, { params }: { params: { orderNumber: string } }) {
  try {
    const auth = req.headers.get('authorization');
    const secret = auth?.startsWith('Bearer ') ? auth.slice(7) : null;
    const device = await verifyTabletDeviceSecret(secret);
    if (!device) return unauthorized('Unknown or revoked tablet device');

    const body = await req.json().catch(() => null);
    const status: unknown = body?.status;
    if (typeof status !== 'string' || !['PENDING', 'PREPARING', 'READY', 'COMPLETED', 'CANCELLED'].includes(status)) {
      return apiError('A valid status is required', 400);
    }

    const updated = await updateOrder(params.orderNumber, { status });
    return NextResponse.json({ ok: true, orderNumber: updated.orderNumber, status: updated.status });
  } catch (e: any) {
    if (e?.status && typeof e?.message === 'string') {
      return apiError(e.message, e.status);
    }
    console.error('[TABLET ORDER STATUS] failed', e);
    return serverError(e, 'Failed to update tablet order status');
  }
}
