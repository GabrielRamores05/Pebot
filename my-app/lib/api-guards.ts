import { NextRequest, NextResponse } from 'next/server';
import { FeatureKey, JWTPayload, checkFeatureAccess, getAuthUser } from '@/lib/auth';
import { featureUnavailable, forbidden, unauthorized } from '@/lib/api-response';

/** Either the authorised caller or the error response the route should return as-is. */
type Guard = { user: JWTPayload; error?: undefined } | { user?: undefined; error: NextResponse };

/** ADMIN, or staff with the Staff Management flag for the feature; else a 401/403 response. */
export async function guardFeature(req: NextRequest, feature: FeatureKey): Promise<Guard> {
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

/** Any signed-in staff member (ADMIN, STAFF or KITCHEN), or a 401 response. */
export async function guardStaff(req: NextRequest): Promise<Guard> {
  const user = await getAuthUser(req);
  if (!user) return { error: unauthorized() };
  return { user };
}

/** Caller holding a Staff Management permission flag (ADMIN always passes), or a 401/403 response. */
export async function guardPermission(req: NextRequest, feature: string): Promise<Guard> {
  const user = await getAuthUser(req);
  if (!user) return { error: unauthorized() };
  if (user.role === 'ADMIN') return { user };
  if ((user.permissions ?? {})[feature] === true) return { user };
  return { error: forbidden() };
}
