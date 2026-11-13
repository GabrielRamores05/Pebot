import { beforeEach, describe, expect, test, vi } from 'vitest';

vi.mock('zustand/middleware', () => ({
  persist: (initializer: unknown) => initializer,
  devtools: (initializer: unknown) => initializer,
}));

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

function jsonResponse(body: unknown, status = 200): Response {
  return { ok: status >= 200 && status < 300, status, json: async () => body } as unknown as Response;
}

const fetchMock = vi.fn();
vi.stubGlobal('fetch', fetchMock);

beforeEach(() => {
  fetchMock.mockReset();
  useSubscriptionStore.setState({ subscription: null, loading: false, error: null });
  vi.spyOn(console, 'error').mockImplementation(() => {});
});

describe('fetchSubscription', () => {
  test('stores the subscription from the API and clears loading', async () => {
    const subscription = tier();
    fetchMock.mockResolvedValue(jsonResponse(subscription));

    await useSubscriptionStore.getState().fetchSubscription(3);

    expect(fetchMock).toHaveBeenCalledWith('/api/subscription', { cache: 'no-store' });
    expect(useSubscriptionStore.getState()).toMatchObject({
      subscription,
      loading: false,
      error: null,
    });
  });

  test('records the failure message instead of leaving it loading forever', async () => {
    fetchMock.mockRejectedValue(new Error('db down'));

    await useSubscriptionStore.getState().fetchSubscription(3);

    expect(useSubscriptionStore.getState()).toMatchObject({
      subscription: null,
      loading: false,
      error: 'db down',
    });
  });

  test('an HTTP error is surfaced with its status', async () => {
    fetchMock.mockResolvedValue(jsonResponse({}, 500));

    await useSubscriptionStore.getState().fetchSubscription(3);

    expect(useSubscriptionStore.getState()).toMatchObject({
      subscription: null,
      loading: false,
      error: 'Failed to load subscription (500)',
    });
  });

  test('a non-Error failure gets a plain message', async () => {
    fetchMock.mockRejectedValue('offline');

    await useSubscriptionStore.getState().fetchSubscription(3);

    expect(useSubscriptionStore.getState().error).toBe('Failed to fetch subscription');
  });

  test('a previous error is cleared when the next fetch succeeds', async () => {
    useSubscriptionStore.setState({ error: 'db down' });
    fetchMock.mockResolvedValue(jsonResponse(tier()));

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

test('refreshSubscription fetches again', async () => {
  fetchMock.mockResolvedValue(jsonResponse(tier({ id: 2 })));

  await useSubscriptionStore.getState().refreshSubscription(9);
  await useSubscriptionStore.getState().refreshSubscription(9);

  expect(fetchMock).toHaveBeenCalledTimes(2);
  expect(useSubscriptionStore.getState().subscription).toMatchObject({ id: 2 });
});
