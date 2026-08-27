import { beforeEach, describe, expect, test, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  checkFeatureAccess: vi.fn(),
  getAuthUser: vi.fn(),
}));

vi.mock('@/lib/auth', () => ({
  checkFeatureAccess: mocks.checkFeatureAccess,
  getAuthUser: mocks.getAuthUser,
}));

vi.mock('@/lib/subscription', () => ({ getUserSubscription: vi.fn() }));

import { NextRequest } from 'next/server';
import { guardAdmin, guardFeature } from '../../lib/api-guards';
import type { JWTPayload } from '../../lib/auth';

const req = new NextRequest('http://localhost/api/analytics');

function user(role: JWTPayload['role']): JWTPayload {
  return { userId: 1, email: 'ana@example.com', role, name: 'Ana' };
}

beforeEach(() => {
  mocks.checkFeatureAccess.mockReset();
  mocks.getAuthUser.mockReset();
});

describe('guardFeature', () => {
  test('passes the caller through when their tier includes the feature', async () => {
    const staff = user('STAFF');
    mocks.checkFeatureAccess.mockResolvedValue({ user: staff, hasAccess: true });

    const result = await guardFeature(req, 'analytics');

    expect(result.user).toBe(staff);
    expect(result.error).toBeUndefined();
    expect(mocks.checkFeatureAccess).toHaveBeenCalledWith(req, 'analytics');
  });

  test('answers 401 when nobody is signed in', async () => {
    mocks.checkFeatureAccess.mockResolvedValue({ user: null, hasAccess: false });

    const result = await guardFeature(req, 'analytics');

    expect(result.user).toBeUndefined();
    expect(result.error?.status).toBe(401);
    await expect(result.error?.json()).resolves.toEqual({ error: 'Unauthorized' });
  });

  test('answers 403 when the tier does not include the feature', async () => {
    mocks.checkFeatureAccess.mockResolvedValue({ user: user('STAFF'), hasAccess: false });

    const result = await guardFeature(req, 'loyalty');

    expect(result.error?.status).toBe(403);
    await expect(result.error?.json()).resolves.toEqual({
      error: 'Feature not available in your subscription tier',
    });
  });
});

describe('guardAdmin', () => {
  test('passes an ADMIN through', async () => {
    const admin = user('ADMIN');
    mocks.getAuthUser.mockResolvedValue(admin);

    const result = await guardAdmin(req);

    expect(result.user).toBe(admin);
    expect(result.error).toBeUndefined();
  });

  test('answers 403 for other roles and for nobody signed in', async () => {
    mocks.getAuthUser.mockResolvedValue(user('KITCHEN'));
    expect((await guardAdmin(req)).error?.status).toBe(403);

    mocks.getAuthUser.mockResolvedValue(null);
    const anonymous = await guardAdmin(req);
    expect(anonymous.error?.status).toBe(403);
    await expect(anonymous.error?.json()).resolves.toEqual({ error: 'Forbidden' });
  });
});
