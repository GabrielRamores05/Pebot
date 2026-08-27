import { beforeEach, describe, expect, test, vi } from 'vitest';

const mocks = vi.hoisted(() => {
  // auth.ts reads JWT_SECRET when the module loads.
  process.env.JWT_SECRET = 'test-secret-for-unit-tests-0123456789';
  return {
    cookies: vi.fn(),
    getUserSubscription: vi.fn(),
    hasFeatureAccess: vi.fn(),
  };
});

vi.mock('next/headers', () => ({ cookies: mocks.cookies }));

vi.mock('@/lib/subscription', () => ({
  getUserSubscription: mocks.getUserSubscription,
  hasFeatureAccess: mocks.hasFeatureAccess,
}));

import { NextRequest } from 'next/server';
import {
  checkFeatureAccess,
  getAuthUser,
  requirePermission,
  requireRole,
  signToken,
  verifyTokenAsync,
  withSubscriptionCheck,
} from '../../lib/auth';
import type { JWTPayload } from '../../lib/auth';

function payload(partial: Partial<JWTPayload> = {}): JWTPayload {
  return { userId: 7, email: 'ana@example.com', role: 'STAFF', name: 'Ana', ...partial };
}

function request(headers: Record<string, string> = {}) {
  return new NextRequest('http://localhost/api/orders', { headers });
}

beforeEach(() => {
  mocks.cookies.mockReset();
  mocks.getUserSubscription.mockReset();
  mocks.hasFeatureAccess.mockReset();
  vi.spyOn(console, 'error').mockImplementation(() => {});
});

describe('signToken / verifyTokenAsync', () => {
  test('a signed token verifies back to the same person', async () => {
    const token = await signToken(payload({ permissions: { analytics: true } }));

    const verified = await verifyTokenAsync(token);

    expect(verified).toMatchObject({
      userId: 7,
      email: 'ana@example.com',
      role: 'STAFF',
      name: 'Ana',
      permissions: { analytics: true },
    });
  });

  test('a tampered or unreadable token verifies to null', async () => {
    const token = await signToken(payload());

    await expect(verifyTokenAsync(`${token}x`)).resolves.toBeNull();
    await expect(verifyTokenAsync('not-a-token')).resolves.toBeNull();
  });
});

describe('getAuthUser', () => {
  test('reads the token from the request cookie', async () => {
    const token = await signToken(payload());

    await expect(getAuthUser(request({ cookie: `cafeos-token=${token}` }))).resolves.toMatchObject({
      userId: 7,
    });
  });

  test('falls back to the Authorization bearer token', async () => {
    const token = await signToken(payload({ userId: 12 }));

    await expect(getAuthUser(request({ authorization: `Bearer ${token}` }))).resolves.toMatchObject({
      userId: 12,
    });
  });

  test('is null with no cookie and no usable Authorization header', async () => {
    await expect(getAuthUser(request())).resolves.toBeNull();
    await expect(getAuthUser(request({ authorization: 'Basic abc' }))).resolves.toBeNull();
  });

  test('without a request it reads the server-side cookie store', async () => {
    const token = await signToken(payload({ role: 'ADMIN' }));
    mocks.cookies.mockResolvedValue({ get: () => ({ value: token }) });

    await expect(getAuthUser()).resolves.toMatchObject({ role: 'ADMIN' });

    mocks.cookies.mockResolvedValue({ get: () => undefined });
    await expect(getAuthUser()).resolves.toBeNull();
  });
});

describe('requireRole', () => {
  test('allows only the listed roles', () => {
    expect(requireRole(payload({ role: 'ADMIN' }), ['ADMIN'])).toBe(true);
    expect(requireRole(payload({ role: 'STAFF' }), ['ADMIN', 'STAFF'])).toBe(true);
    expect(requireRole(payload({ role: 'KITCHEN' }), ['ADMIN'])).toBe(false);
    expect(requireRole(null, ['ADMIN'])).toBe(false);
  });
});

describe('withSubscriptionCheck', () => {
  test('nobody signed in has no access and no subscription looked up', async () => {
    await expect(withSubscriptionCheck(request(), 'analytics')).resolves.toEqual({
      user: null,
      subscription: null,
      hasAccess: false,
    });
    expect(mocks.getUserSubscription).not.toHaveBeenCalled();
  });

  test('an ADMIN gets access whatever the tier says', async () => {
    const token = await signToken(payload({ role: 'ADMIN' }));
    mocks.getUserSubscription.mockResolvedValue(null);
    mocks.hasFeatureAccess.mockReturnValue(false);

    const result = await withSubscriptionCheck(
      request({ cookie: `cafeos-token=${token}` }),
      'analytics',
    );

    expect(result.hasAccess).toBe(true);
    expect(mocks.getUserSubscription).toHaveBeenCalledWith(7);
  });

  test('other roles fall back to the subscription tier', async () => {
    const token = await signToken(payload({ role: 'STAFF' }));
    const subscription = { isActive: true, features: { analytics: true } };
    mocks.getUserSubscription.mockResolvedValue(subscription);
    mocks.hasFeatureAccess.mockReturnValue(true);

    const result = await withSubscriptionCheck(
      request({ cookie: `cafeos-token=${token}` }),
      'analytics',
    );

    expect(result.hasAccess).toBe(true);
    expect(result.subscription).toBe(subscription);
    expect(mocks.hasFeatureAccess).toHaveBeenCalledWith(subscription, 'analytics');
  });
});

describe('checkFeatureAccess', () => {
  test('reports the caller and whether the feature is available', async () => {
    const token = await signToken(payload({ role: 'STAFF' }));
    mocks.getUserSubscription.mockResolvedValue(null);
    mocks.hasFeatureAccess.mockReturnValue(false);

    await expect(
      checkFeatureAccess(request({ cookie: `cafeos-token=${token}` }), 'loyalty'),
    ).resolves.toEqual({ user: expect.objectContaining({ userId: 7 }), hasAccess: false });
  });
});

describe('requirePermission', () => {
  test('an ADMIN passes without any permission flags', async () => {
    const token = await signToken(payload({ role: 'ADMIN' }));

    await expect(
      requirePermission(request({ cookie: `cafeos-token=${token}` }), 'inventory'),
    ).resolves.toMatchObject({ role: 'ADMIN' });
  });

  test('staff pass only with the flag set to true', async () => {
    const allowed = await signToken(payload({ permissions: { inventory: true } }));
    const denied = await signToken(payload({ permissions: { inventory: false } }));
    const noFlags = await signToken(payload());

    await expect(
      requirePermission(request({ cookie: `cafeos-token=${allowed}` }), 'inventory'),
    ).resolves.toMatchObject({ userId: 7 });
    await expect(
      requirePermission(request({ cookie: `cafeos-token=${denied}` }), 'inventory'),
    ).resolves.toBeNull();
    await expect(
      requirePermission(request({ cookie: `cafeos-token=${noFlags}` }), 'inventory'),
    ).resolves.toBeNull();
  });

  test('nobody signed in gets null', async () => {
    await expect(requirePermission(request(), 'inventory')).resolves.toBeNull();
  });
});
