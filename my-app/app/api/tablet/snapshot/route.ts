import { NextRequest, NextResponse } from 'next/server';
import { serverError, unauthorized } from '@/lib/api-response';
import { verifyTabletDeviceSecret } from '@/modules/system/service';
import { buildTabletSnapshot } from '@/modules/tablet/service';

// GET /api/tablet/snapshot — device-authenticated bootstrap mirror payload
// (menu/catalog/settings/staff, scrubbed; orders flow over the live channel).
export async function GET(req: NextRequest) {
  try {
    const auth = req.headers.get('authorization');
    const secret = auth?.startsWith('Bearer ') ? auth.slice(7) : null;
    const device = await verifyTabletDeviceSecret(secret);
    if (!device) return unauthorized('Unknown or revoked tablet device');

    const snapshot = await buildTabletSnapshot();
    return NextResponse.json(snapshot);
  } catch (e) {
    console.error('[TABLET SNAPSHOT] failed', e);
    return serverError(e, 'Failed to build tablet snapshot');
  }
}
