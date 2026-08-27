import { beforeEach, expect, test, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  auditCreate: vi.fn(),
  getAuthUser: vi.fn(),
}));

vi.mock('@/lib/prisma', () => ({
  prisma: { auditLog: { create: mocks.auditCreate } },
}));

vi.mock('@/lib/auth', () => ({ getAuthUser: mocks.getAuthUser }));

import { logAction } from '../../lib/audit-log';

type FakeRequest = Parameters<typeof logAction>[0]['req'];

function request(options: { ip?: string; forwardedFor?: string } = {}): FakeRequest {
  return {
    ip: options.ip,
    headers: { get: (name: string) => (name === 'x-forwarded-for' ? options.forwardedFor ?? null : null) },
  } as unknown as FakeRequest;
}

function created() {
  return mocks.auditCreate.mock.calls[0][0].data;
}

beforeEach(() => {
  mocks.auditCreate.mockReset();
  mocks.getAuthUser.mockReset();
  mocks.auditCreate.mockResolvedValue({ id: 1 });
  mocks.getAuthUser.mockResolvedValue(null);
  vi.spyOn(console, 'error').mockImplementation(() => {});
});

test('writes the action with a serialised details object', async () => {
  await logAction({ userId: 4, action: 'ORDER_PAID', resource: 'order', resourceId: 9, details: { total: 250 } });

  expect(created()).toEqual({
    userId: 4,
    action: 'ORDER_PAID',
    resource: 'order',
    resourceId: 9,
    details: JSON.stringify({ total: 250 }),
    ip: undefined,
  });
  expect(mocks.getAuthUser).not.toHaveBeenCalled();
});

test('a details string is stored as given', async () => {
  await logAction({ action: 'LOGIN', resource: 'auth', details: 'manual note' });
  expect(created().details).toBe('manual note');
});

test('missing optional fields are left unset rather than null', async () => {
  await logAction({ action: 'LOGIN', resource: 'auth' });
  expect(created()).toEqual({
    userId: null,
    action: 'LOGIN',
    resource: 'auth',
    resourceId: undefined,
    details: undefined,
    ip: undefined,
  });
});

test('falls back to the signed-in user from the request', async () => {
  mocks.getAuthUser.mockResolvedValue({ userId: 11 });

  await logAction({ action: 'VOID_ORDER', resource: 'order', req: request({ ip: '10.0.0.5' }) });

  expect(created().userId).toBe(11);
  expect(created().ip).toBe('10.0.0.5');
});

test('an explicit userId wins over the signed-in user', async () => {
  mocks.getAuthUser.mockResolvedValue({ userId: 11 });

  await logAction({ userId: 2, action: 'VOID_ORDER', resource: 'order', req: request() });

  expect(created().userId).toBe(2);
});

test('takes the first x-forwarded-for hop when there is no direct ip', async () => {
  await logAction({
    action: 'LOGIN',
    resource: 'auth',
    req: request({ forwardedFor: ' 203.0.113.7 , 10.0.0.1 ' }),
  });

  expect(created().ip).toBe('203.0.113.7');
});

test('a failing audit write never breaks the caller', async () => {
  mocks.auditCreate.mockRejectedValue(new Error('db locked'));

  await expect(logAction({ action: 'LOGIN', resource: 'auth' })).resolves.toBeUndefined();
  expect(console.error).toHaveBeenCalledWith(
    '[AUDIT LOG] Failed to write audit log:',
    expect.any(Error),
  );
});
