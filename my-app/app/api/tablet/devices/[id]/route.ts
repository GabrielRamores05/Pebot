import { NextRequest, NextResponse } from 'next/server';
import { guardAdmin } from '@/lib/api-guards';
import { notFound, serverError } from '@/lib/api-response';
import { revokeTabletDevice } from '@/modules/system/service';

// DELETE /api/tablet/devices/[id] — admin: revoke a device credential.
export async function DELETE(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const { error } = await guardAdmin(req);
    if (error) return error;
    const revoked = await revokeTabletDevice(params.id);
    if (!revoked) return notFound('Device not found');
    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error('[TABLET DEVICES] DELETE failed', e);
    return serverError(e, 'Failed to revoke tablet device');
  }
}
