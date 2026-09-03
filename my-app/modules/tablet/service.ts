// modules/tablet/service.ts — tablet gateway service (spec 013 Phase 2).
// Shape/bootstrap the payload for paired tablet devices and scrub anything a
// mirror must never hold: password hashes and the PC-only AI key.

import { findTabletSnapshotRows, TabletRows } from '@/modules/tablet/repository';

function scrubStaff(row: Record<string, unknown>): Record<string, unknown> {
  const { password: _password, ...rest } = row;
  return rest;
}

function scrubBusinessSettings(row: Record<string, unknown>): Record<string, unknown> {
  const { aiApiKey: _aiApiKey, ...rest } = row;
  return rest;
}

export async function buildTabletSnapshot(): Promise<{
  version: number;
  exportedAt: string;
  data: TabletRows;
}> {
  const rows = await findTabletSnapshotRows();
  const data: TabletRows = {
    ...rows,
    staffUsers: rows.staffUsers.map(scrubStaff),
    businessSettings: rows.businessSettings.map(scrubBusinessSettings),
  };
  return { version: 1, exportedAt: new Date().toISOString(), data };
}
