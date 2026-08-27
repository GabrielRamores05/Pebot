import { NextRequest, NextResponse } from 'next/server';
import { JWTPayload, checkFeatureAccess, getAuthUser } from '@/lib/auth';
import { featureUnavailable, forbidden, unauthorized } from '@/lib/api-response';
import { getUserSubscription } from '@/lib/subscription';

type SubscriptionFeature = keyof NonNullable<Awaited<ReturnType<typeof getUserSubscription>>>['features'];

/** Either the authorised caller or the error response the route should return as-is. */
type Guard = { user: JWTPayload; error?: undefined } | { user?: undefined; error: NextResponse };

/** Caller whose subscription tier includes the feature, or a 401/403 response. */
export async function guardFeature(req: NextRequest, feature: SubscriptionFeature): Promise<Guard> {
  const { user, hasAccess } = await checkFeatureAccess(req, feature);
  if (!user) return { error: unauthorized() };
  if (!hasAccess) return { error: featureUnavailable() };
  return { user };
}

/** ADMIN caller, or a 403 response. */
export async function guardAdmin(req: NextRequest): Promise<Guard> {
  const user = await getAuthUser(req);
  if (!user || user.role !== 'ADMIN') return { error: forbidden() };
  return { user };
}
