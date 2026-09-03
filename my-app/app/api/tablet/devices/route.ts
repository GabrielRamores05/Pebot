import { NextRequest, NextResponse } from 'next/server';
import { guardAdmin } from '@/lib/api-guards';
import { badRequest, serverError } from '@/lib/api-response';
import { createTabletDevice, listTabletDevices } from '@/modules/system/service';

// GET /api/tablet/devices — admin: list paired tablet devices (no secrets)
// POST /api/tablet/devices — admin: create a device credential; the secret is
//   returned exactly once and must be copied into the tablet.
export async function GET(req: NextRequest) {
  try {
    const { error } = await guardAdmin(req);
    if (error) return error;
    return NextResponse.json({ devices: await listTabletDevices() });
  } catch (e) {
    console.error('[TABLET DEVICES] GET failed', e);
    return serverError(e, 'Failed to list tablet devices');
  }
}

export async function POST(req: NextRequest) {
  try {
    const { error } = await guardAdmin(req);
    if (error) return error;
    const body = await req.json().catch(() => null);
    const name: unknown = body?.name;
    if (typeof name !== 'string' || name.trim().length === 0) {
      return badRequest('A device name is required');
    }
    const device = await createTabletDevice(name);
    return NextResponse.json({ device }, { status: 201 });
  } catch (e) {
    console.error('[TABLET DEVICES] POST failed', e);
    return serverError(e, 'Failed to create tablet device');
  }
}
