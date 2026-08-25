import { create } from 'zustand';
import { devtools, persist } from 'zustand/middleware';
import { getUserSubscription, SubscriptionTier } from '@/lib/subscription';

interface SubscriptionState {
  subscription: SubscriptionTier | null;
  loading: boolean;
  error: string | null;
  fetchSubscription: (userId: number) => Promise<void>;
  hasFeature: (feature: keyof SubscriptionTier['features']) => boolean;
  refreshSubscription: (userId: number) => Promise<void>;
}

export const useSubscriptionStore = create<SubscriptionState>()(
  devtools(
    persist(
      (set, get) => ({
        subscription: null,
        loading: false,
        error: null,
        
        fetchSubscription: async (userId: number) => {
          set({ loading: true, error: null });
          try {
            const subscription = await getUserSubscription(userId);
            set({ subscription, loading: false });
          } catch (error) {
            console.error('Failed to fetch subscription:', error);
            set({ 
              error: error instanceof Error ? error.message : 'Failed to fetch subscription',
              loading: false 
            });
          }
        },
        
        hasFeature: (feature: keyof SubscriptionTier['features']) => {
          const { subscription } = get();
          if (!subscription?.isActive) return false;
          return subscription.features[feature] ?? false;
        },
        
        refreshSubscription: async (userId: number) => {
          await get().fetchSubscription(userId);
        },
      }),
      {
        name: 'subscription-storage',
        skipHydration: true,
      }
    )
  )
);