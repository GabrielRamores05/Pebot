import { beforeEach, describe, expect, test, vi } from 'vitest';

const mocks = vi.hoisted(() => ({ userFindUnique: vi.fn() }));

vi.mock('../../lib/prisma-client', () => ({
  PrismaClient: class {
    user = { findUnique: mocks.userFindUnique };
  },
}));

import { getUserSubscription, hasFeatureAccess, requireFeature } from '../../lib/subscription';
import type { SubscriptionTier } from '../../lib/subscription';

const FEATURES = {
  analytics: true,
  inventory: true,
  staff: false,
  settings: false,
  kitchen: true,
  loyalty: false,
};

function tier(partial: Partial<SubscriptionTier> = {}): SubscriptionTier {
  return {
    id: 1,
    tier: 'PREMIUM',
    features: { ...FEATURES },
    price: 999,
    billingCycle: 'MONTHLY',
    isActive: true,
    ...partial,
  };
}

beforeEach(() => {
  mocks.userFindUnique.mockReset();
  vi.spyOn(console, 'error').mockImplementation(() => {});
});

describe('getUserSubscription', () => {
  test('maps the stored row, parsing the feature flags', async () => {
    mocks.userFindUnique.mockResolvedValue({
      id: 3,
      subscription: {
        id: 8,
        tier: 'MEDIUM',
        features: JSON.stringify(FEATURES),
        price: 499,
        billingCycle: 'YEARLY',
        isActive: true,
      },
    });

    await expect(getUserSubscription(3)).resolves.toEqual({
      id: 8,
      tier: 'MEDIUM',
      features: FEATURES,
      price: 499,
      billingCycle: 'YEARLY',
      isActive: true,
    });
    expect(mocks.userFindUnique).toHaveBeenCalledWith({
      where: { id: 3 },
      include: { subscription: true },
    });
  });

  test('is null for an unknown user or a user without a subscription', async () => {
    mocks.userFindUnique.mockResolvedValue(null);
    await expect(getUserSubscription(3)).resolves.toBeNull();

    mocks.userFindUnique.mockResolvedValue({ id: 3, subscription: null });
    await expect(getUserSubscription(3)).resolves.toBeNull();
  });

  test('is null when the lookup or the feature JSON fails', async () => {
    mocks.userFindUnique.mockRejectedValue(new Error('db down'));
    await expect(getUserSubscription(3)).resolves.toBeNull();

    mocks.userFindUnique.mockResolvedValue({
      id: 3,
      subscription: { id: 8, tier: 'REGULAR', features: 'not json', price: 0, billingCycle: 'MONTHLY', isActive: true },
    });
    await expect(getUserSubscription(3)).resolves.toBeNull();
    expect(console.error).toHaveBeenCalled();
  });
});

describe('hasFeatureAccess', () => {
  test('grants a feature the active tier includes', () => {
    expect(hasFeatureAccess(tier(), 'analytics')).toBe(true);
  });

  test('denies a feature the tier excludes', () => {
    expect(hasFeatureAccess(tier(), 'loyalty')).toBe(false);
  });

  test('denies everything without a subscription or once it lapses', () => {
    expect(hasFeatureAccess(null, 'analytics')).toBe(false);
    expect(hasFeatureAccess(tier({ isActive: false }), 'analytics')).toBe(false);
  });

  test('denies a flag missing from the stored features', () => {
    const partial = tier({ features: {} as SubscriptionTier['features'] });
    expect(hasFeatureAccess(partial, 'kitchen')).toBe(false);
  });
});

describe('requireFeature', () => {
  test('looks the subscription up for the given user and answers for that feature', async () => {
    mocks.userFindUnique.mockResolvedValue({
      id: 3,
      subscription: {
        id: 8,
        tier: 'MEDIUM',
        features: JSON.stringify(FEATURES),
        price: 499,
        billingCycle: 'MONTHLY',
        isActive: true,
      },
    });

    await expect(requireFeature('inventory')(3)).resolves.toBe(true);
    await expect(requireFeature('staff')(3)).resolves.toBe(false);
  });

  test('denies when there is no subscription to check', async () => {
    mocks.userFindUnique.mockResolvedValue(null);
    await expect(requireFeature('inventory')(3)).resolves.toBe(false);
  });
});
