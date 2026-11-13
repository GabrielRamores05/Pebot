import { beforeEach, describe, expect, test, vi } from 'vitest';

const mocks = vi.hoisted(() => ({ logAction: vi.fn() }));
vi.mock('@/lib/audit-log', () => ({ logAction: mocks.logAction }));

import {
  acceptAgreement,
  activateLicense,
  deactivateLicense,
  getAgreement,
  getLicenseStatus,
  isLocalRequest,
} from '../../modules/license/service';

type Store = Parameters<typeof getLicenseStatus>[1];

function fakeStore(overrides: Record<string, unknown> = {}) {
  const status = {
    state: 'agreement-accepted',
    reason: 'no-key',
    licenseNo: null,
    activatedAt: null,
    agreementVersion: '1.0-draft',
    machineCode: 'PBT-AAAA-BBBB-CCCC',
  };
  return {
    get: vi.fn(() => status),
    refresh: vi.fn(() => status),
    isActive: vi.fn(() => false),
    acceptAgreement: vi.fn(() => ({ ok: true, status })),
    activate: vi.fn(() => ({ ok: true, licenseNo: 1001, status: { ...status, state: 'active', machineCode: 'PBT-AAAA-BBBB-CCCC' } })),
    deactivate: vi.fn(() => ({ ok: true, deactivationCode: 'DEACT-XXXX', licenseNo: 1001, status })),
    ...overrides,
  } as unknown as Store;
}

beforeEach(() => {
  mocks.logAction.mockReset();
});

describe('isLocalRequest', () => {
  test('trusts only the header server.js sets', () => {
    expect(isLocalRequest({ headers: new Headers({ 'x-pebot-local': '1' }) })).toBe(true);
    expect(isLocalRequest({ headers: new Headers({ 'x-pebot-local': 'yes' }) })).toBe(false);
    expect(isLocalRequest({ headers: new Headers() })).toBe(false);
  });
});

describe('getLicenseStatus', () => {
  test('shows the Machine Code and a plain message on the main PC', () => {
    expect(getLicenseStatus(true, fakeStore())).toMatchObject({
      state: 'agreement-accepted',
      machineCode: 'PBT-AAAA-BBBB-CCCC',
      message: 'Enter the license key you received from Pebot support.',
      local: true,
    });
  });

  test('hides the Machine Code from other devices', () => {
    expect(getLicenseStatus(false, fakeStore())).not.toHaveProperty('machineCode');
  });
});

describe('acceptAgreement', () => {
  test('is refused from other devices', () => {
    const store = fakeStore();
    expect(acceptAgreement('1.0-draft', false, store)).toMatchObject({ ok: false, status: 403, reason: 'local-only' });
    expect(store.acceptAgreement).not.toHaveBeenCalled();
  });

  test('reports an outdated version', () => {
    const store = fakeStore({ acceptAgreement: vi.fn(() => ({ ok: false, reason: 'outdated-agreement' })) });
    expect(acceptAgreement('0.1', true, store)).toMatchObject({ ok: false, status: 409 });
  });

  test('returns the new status', () => {
    expect(acceptAgreement('1.0-draft', true, fakeStore())).toMatchObject({ ok: true, value: { state: 'agreement-accepted' } });
  });
});

describe('activateLicense', () => {
  test('is refused from other devices', async () => {
    await expect(activateLicense('PEBOT-X', false, undefined, fakeStore())).resolves.toMatchObject({ ok: false, status: 403 });
  });

  test('explains a key for another computer', async () => {
    const store = fakeStore({ activate: vi.fn(() => ({ ok: false, reason: 'wrong-machine' })) });
    const r = await activateLicense('PEBOT-X', true, undefined, store);
    expect(r).toMatchObject({ ok: false, status: 422, reason: 'wrong-machine' });
    if (!r.ok) expect(r.message).toContain('different computer');
    expect(mocks.logAction).not.toHaveBeenCalled();
  });

  test('activates and records an audit event', async () => {
    await expect(activateLicense('PEBOT-X', true, undefined, fakeStore())).resolves.toEqual({ ok: true, value: { licenseNo: 1001 } });
    expect(mocks.logAction).toHaveBeenCalledWith(expect.objectContaining({ action: 'LICENSE_ACTIVATED', resourceId: 1001 }));
  });
});

describe('deactivateLicense', () => {
  test('is refused from other devices', async () => {
    await expect(deactivateLicense(false, undefined, fakeStore())).resolves.toMatchObject({ ok: false, status: 403 });
  });

  test('reports when there is no active license', async () => {
    const store = fakeStore({ deactivate: vi.fn(() => ({ ok: false, reason: 'not-active' })) });
    await expect(deactivateLicense(true, undefined, store)).resolves.toMatchObject({ ok: false, status: 409 });
  });

  test('returns the code, audits, and drops live connections', async () => {
    const disconnectSockets = vi.fn();
    (globalThis as { io?: unknown }).io = { disconnectSockets };
    try {
      await expect(deactivateLicense(true, undefined, fakeStore())).resolves.toEqual({
        ok: true,
        value: { deactivationCode: 'DEACT-XXXX', licenseNo: 1001 },
      });
      expect(disconnectSockets).toHaveBeenCalledWith(true);
      expect(mocks.logAction).toHaveBeenCalledWith(expect.objectContaining({ action: 'LICENSE_DEACTIVATED' }));
    } finally {
      delete (globalThis as { io?: unknown }).io;
    }
  });
});

test('getAgreement reads the shipped text', () => {
  expect(getAgreement('en').text).toContain('PEBOT SOFTWARE LICENSE AGREEMENT');
});
