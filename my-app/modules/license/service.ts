import type { NextRequest } from 'next/server';
import { logAction } from '@/lib/audit-log';
import { getLicenseStore } from '@/lib/license/state.js';
import { readAgreement } from '@/lib/license/agreement.js';
import { LICENSE_REASON_MESSAGES, type AgreementLang } from './schema';

type Store = ReturnType<typeof getLicenseStore>;

/** server.js strips any client-sent value and sets this only for loopback requests. */
export function isLocalRequest(req: Pick<NextRequest, 'headers'>): boolean {
  return req.headers.get('x-pebot-local') === '1';
}

export interface LicenseStatusView {
  state: 'no-agreement' | 'agreement-accepted' | 'active';
  reason: string | null;
  message: string | null;
  licenseNo: number | null;
  activatedAt: string | null;
  agreementVersion: string;
  local: boolean;
  /** Only shown on the main PC itself (FR-007). */
  machineCode?: string | null;
}

export function getLicenseStatus(local: boolean, store: Store = getLicenseStore()): LicenseStatusView {
  const s = store.get();
  return {
    state: s.state,
    reason: s.reason,
    message: s.reason ? LICENSE_REASON_MESSAGES[s.reason] ?? null : null,
    licenseNo: s.licenseNo,
    activatedAt: s.activatedAt,
    agreementVersion: s.agreementVersion,
    local,
    ...(local ? { machineCode: s.machineCode } : {}),
  };
}

export function getAgreement(lang: AgreementLang, filePath?: string) {
  return readAgreement(lang, filePath);
}

export type LicenseResult<T> = { ok: true; value: T } | { ok: false; status: number; reason: string; message: string };

const fail = (status: number, reason: string, message?: string): { ok: false; status: number; reason: string; message: string } => ({
  ok: false,
  status,
  reason,
  message: message ?? LICENSE_REASON_MESSAGES[reason] ?? 'Something went wrong.',
});

const LOCAL_ONLY = 'Activation can only be done on the main Pebot computer.';

export function acceptAgreement(
  version: string,
  local: boolean,
  store: Store = getLicenseStore(),
): LicenseResult<LicenseStatusView> {
  if (!local) return fail(403, 'local-only', LOCAL_ONLY);
  const result = store.acceptAgreement(version);
  if (!result.ok) return fail(409, 'outdated-agreement', 'The agreement was updated. Reload the page and read the new version.');
  return { ok: true, value: getLicenseStatus(local, store) };
}

export async function activateLicense(
  key: string,
  local: boolean,
  req?: NextRequest,
  store: Store = getLicenseStore(),
): Promise<LicenseResult<{ licenseNo: number }>> {
  if (!local) return fail(403, 'local-only', LOCAL_ONLY);
  const result = store.activate(key);
  if (!result.ok) return fail(422, result.reason);
  await logAction({
    action: 'LICENSE_ACTIVATED',
    resource: 'license',
    resourceId: result.licenseNo,
    details: { licenseNo: result.licenseNo, machineCode: result.status.machineCode },
    req,
  });
  return { ok: true, value: { licenseNo: result.licenseNo } };
}

export async function deactivateLicense(
  local: boolean,
  req?: NextRequest,
  store: Store = getLicenseStore(),
): Promise<LicenseResult<{ deactivationCode: string; licenseNo: number }>> {
  if (!local) return fail(403, 'local-only', LOCAL_ONLY);
  const result = store.deactivate();
  if (!result.ok) return fail(409, 'not-active', 'There is no active license on this computer to move.');
  await logAction({
    action: 'LICENSE_DEACTIVATED',
    resource: 'license',
    resourceId: result.licenseNo,
    details: { licenseNo: result.licenseNo, machineCode: result.status.machineCode },
    req,
  });
  // Live connections opened while licensed must not outlive the license.
  const io = (globalThis as { io?: { disconnectSockets: (close?: boolean) => void } }).io;
  io?.disconnectSockets(true);
  return { ok: true, value: { deactivationCode: result.deactivationCode, licenseNo: result.licenseNo } };
}
