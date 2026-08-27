import { beforeEach, describe, expect, test, vi } from 'vitest';

const mocks = vi.hoisted(() => ({ getUserSubscription: vi.fn() }));

vi.mock('zustand/middleware', () => ({
  persist: (initializer: unknown) => initializer,
  devtools: (initializer: unknown) => initializer,
}));

vi.mock('@/lib/subscription', () => ({ getUserSubscription: mocks.getUserSubscription }));

import { useSubscriptionStore } from '../../store/subscriptionStore';
import type { SubscriptionTier } from '../../lib/subscription';

function tier(partial: Partial<SubscriptionTier> = {}): SubscriptionTier {
  return {
    id: 1,
    tier: 'MEDIUM',
    features: {
      analytics: true,
      inventory: true,
      staff: false,
      settings: false,
      kitchen: true,
      loyalty: false,
    },
    price: 499,
    billingCycle: 'MONTHLY',
    isActive: true,
    ...partial,
  };
}

beforeEach(() => {
  mocks.getUserSubscription.mockReset();
  useSubscriptionStore.setState({ subscription: null, loading: false, error: null });
  vi.spyOn(console, 'error').mockImplementation(() => {});
});

describe('fetchSubscription', () => {
  test('stores the subscription and clears loading', async () => {
    const subscription = tier();
    mocks.getUserSubscription.mockResolvedValue(subscription);

    await useSubscriptionStore.getState().fetchSubscription(3);

    expect(mocks.getUserSubscription).toHaveBeenCalledWith(3);
    expect(useSubscriptionStore.getState()).toMatchObject({
      subscription,
      loading: false,
      error: null,
    });
  });

  test('records the failure message instead of leaving it loading forever', async () => {
    mocks.getUserSubscription.mockRejectedValue(new Error('db down'));

    await useSubscriptionStore.getState().fetchSubscription(3);

    expect(useSubscriptionStore.getState()).toMatchObject({
      subscription: null,
      loading: false,
      error: 'db down',
    });
  });

  test('a non-Error failure gets a plain message', async () => {
    mocks.getUserSubscription.mockRejectedValue('offline');

    await useSubscriptionStore.getState().fetchSubscription(3);

    expect(useSubscriptionStore.getState().error).toBe('Failed to fetch subscription');
  });

  test('a previous error is cleared when the next fetch succeeds', async () => {
    useSubscriptionStore.setState({ error: 'db down' });
    mocks.getUserSubscription.mockResolvedValue(tier());

    await useSubscriptionStore.getState().fetchSubscription(3);

    expect(useSubscriptionStore.getState().error).toBeNull();
  });
});

describe('hasFeature', () => {
  test('follows the stored tier while it is active', () => {
    useSubscriptionStore.setState({ subscription: tier() });

    expect(useSubscriptionStore.getState().hasFeature('analytics')).toBe(true);
    expect(useSubscriptionStore.getState().hasFeature('loyalty')).toBe(false);
  });

  test('denies everything with no subscription or a lapsed one', () => {
    expect(useSubscriptionStore.getState().hasFeature('analytics')).toBe(false);

    useSubscriptionStore.setState({ subscription: tier({ isActive: false }) });
    expect(useSubscriptionStore.getState().hasFeature('analytics')).toBe(false);
  });

  test('denies a flag missing from the stored features', () => {
    useSubscriptionStore.setState({
      subscription: tier({ features: {} as SubscriptionTier['features'] }),
    });

    expect(useSubscriptionStore.getState().hasFeature('kitchen')).toBe(false);
  });
});

test('refreshSubscription fetches again for the same user', async () => {
  mocks.getUserSubscription.mockResolvedValue(tier({ id: 2 }));

  await useSubscriptionStore.getState().refreshSubscription(9);

  expect(mocks.getUserSubscription).toHaveBeenCalledWith(9);
  expect(useSubscriptionStore.getState().subscription).toMatchObject({ id: 2 });
});
