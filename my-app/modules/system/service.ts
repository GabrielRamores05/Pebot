// modules/system/service.ts — system domain service layer.
// The only thing route handlers under app/api/system|tablet may call.
// Constitution Principle IV: routes parse → call one service → serialize.

import { randomBytes, randomUUID } from 'crypto';
import bcrypt from 'bcryptjs';
import {
  createAuditEvent,
  getTabletDevicesDoc,
  saveTabletDevicesDoc,
} from '@/modules/system/repository';

// ---------------------------------------------------------------------------
// Tablet device credentials (spec 013 Phase 2 — the tablet ↔ PC ledger bridge).
// Stored as a single Setting kv document (JSON array). Secrets are bcrypt-hashed
// and returned in full exactly once, at creation. Revoked devices stop working.
// ---------------------------------------------------------------------------

interface TabletDevice {
  id: string;
  name: string;
  secretHash: string;
  createdAt: string;
  revoked: boolean;
}

type PublicTabletDevice = Omit<TabletDevice, 'secretHash'>;

async function readDevices(): Promise<TabletDevice[]> {
  return (await getTabletDevicesDoc()) as TabletDevice[];
}

async function writeDevices(devices: TabletDevice[]) {
  await saveTabletDevicesDoc(devices as Array<Record<string, any>>);
}

export async function listTabletDevices(): Promise<PublicTabletDevice[]> {
  const devices = await readDevices();
  return devices.map(({ secretHash: _secretHash, ...rest }) => rest);
}

export async function createTabletDevice(name: string): Promise<PublicTabletDevice & { secret: string }> {
  const trimmed = name.trim();
  if (!trimmed) throw new Error('Device name is required');
  const secret = randomBytes(24).toString('base64url');
  const secretHash = await bcrypt.hash(secret, 10);
  const device: TabletDevice = {
    id: randomUUID(),
    name: trimmed.slice(0, 80),
    secretHash,
    createdAt: new Date().toISOString(),
    revoked: false,
  };
  const devices = await readDevices();
  devices.push(device);
  await writeDevices(devices);
  await createAuditEvent({
    action: 'TABLET_DEVICE_CREATE',
    resource: 'tablet_device',
    details: JSON.stringify({ deviceId: device.id, name: device.name }),
  });
  const { secretHash: _secretHash, ...rest } = device;
  return { ...rest, secret };
}

export async function revokeTabletDevice(deviceId: string): Promise<boolean> {
  const devices = await readDevices();
  const target = devices.find((d) => d.id === deviceId);
  if (!target) return false;
  const updated = devices.map((d) => (d.id === deviceId ? { ...d, revoked: true } : d));
  await writeDevices(updated);
  await createAuditEvent({
    action: 'TABLET_DEVICE_REVOKE',
    resource: 'tablet_device',
    details: JSON.stringify({ deviceId, name: target.name }),
  });
  return true;
}

/** Returns the device when the presented secret matches an active (non-revoked)
 *  device credential; otherwise null. Never returns hashes. */
export async function verifyTabletDeviceSecret(secret?: string | null): Promise<PublicTabletDevice | null> {
  if (!secret) return null;
  const devices = await readDevices();
  for (const device of devices) {
    if (device.revoked) continue;
    const valid = await bcrypt.compare(secret, device.secretHash);
    if (valid) {
      const { secretHash: _secretHash, ...rest } = device;
      return rest;
    }
  }
  return null;
}
