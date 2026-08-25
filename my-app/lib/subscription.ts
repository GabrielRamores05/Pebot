import { PrismaClient } from './prisma-client';

const prisma = new PrismaClient();

export interface SubscriptionTier {
  id: number;
  tier: 'REGULAR' | 'MEDIUM' | 'PREMIUM';
  features: {
    analytics: boolean;
    inventory: boolean;
    staff: boolean;
    settings: boolean;
    kitchen: boolean;
    loyalty: boolean;
  };
  price: number;
  billingCycle: 'MONTHLY' | 'QUARTERLY' | 'YEARLY';
  isActive: boolean;
}

export async function getUserSubscription(userId: number): Promise<SubscriptionTier | null> {
  try {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      include: { subscription: true },
    });
    
    if (!user?.subscription) {
      return null;
    }
    
    return {
      id: user.subscription.id,
      tier: user.subscription.tier as 'REGULAR' | 'MEDIUM' | 'PREMIUM',
      features: JSON.parse(user.subscription.features),
      price: user.subscription.price,
      billingCycle: user.subscription.billingCycle as 'MONTHLY' | 'QUARTERLY' | 'YEARLY',
      isActive: user.subscription.isActive,
    };
  } catch (error) {
    console.error('Error fetching user subscription:', error);
    return null;
  }
}

export function hasFeatureAccess(subscription: SubscriptionTier | null, feature: keyof SubscriptionTier['features']): boolean {
  if (!subscription || !subscription.isActive) {
    return false;
  }
  
  return subscription.features[feature] ?? false;
}

export function requireFeature(feature: keyof SubscriptionTier['features']) {
  return async (userId: number): Promise<boolean> => {
    const subscription = await getUserSubscription(userId);
    return hasFeatureAccess(subscription, feature);
  };
}