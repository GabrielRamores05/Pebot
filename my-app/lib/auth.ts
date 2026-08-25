import { SignJWT, jwtVerify } from 'jose';
import { cookies } from 'next/headers';
import { NextRequest, NextResponse } from 'next/server';
import { getUserSubscription, hasFeatureAccess } from '@/lib/subscription';

const JWT_SECRET = process.env.JWT_SECRET || 'cafeos-secret';
const secret = new TextEncoder().encode(JWT_SECRET);

export interface JWTPayload {
  userId: number;
  email: string;
  role: 'ADMIN' | 'STAFF' | 'KITCHEN';
  name: string;
  permissions?: Record<string, boolean>;
}

export async function signToken(payload: JWTPayload): Promise<string> {
  return new SignJWT({ ...payload })
    .setProtectedHeader({ alg: 'HS256' })
    .setExpirationTime('12h')
    .sign(secret);
}

export function verifyToken(token: string): JWTPayload | null {
  // jose jwtVerify is async — use this sync wrapper only in non-edge contexts via verifyTokenAsync
  // For middleware use verifyTokenAsync
  try {
    // Decode without verify as fallback (middleware uses verifyTokenAsync)
    const parts = token.split('.');
    if (parts.length !== 3) return null;
    const decoded = JSON.parse(atob(parts[1].replace(/-/g, '+').replace(/_/g, '/')));
    return decoded as JWTPayload;
  } catch {
    return null;
  }
}

export async function verifyTokenAsync(token: string): Promise<JWTPayload | null> {
  try {
    const { payload } = await jwtVerify(token, secret);
    return payload as unknown as JWTPayload;
  } catch (err) {
    console.error('[JWT VERIFY ERROR]', err);
    return null;
  }
}

export async function getAuthUser(req?: NextRequest): Promise<JWTPayload | null> {
  let token: string | undefined;

  if (req) {
    token = req.cookies.get('cafeos-token')?.value;
    if (!token) {
      const auth = req.headers.get('authorization');
      if (auth?.startsWith('Bearer ')) token = auth.slice(7);
    }
  } else {
    const cookieStore = await cookies();
    token = cookieStore.get('cafeos-token')?.value;
  }

  if (!token) return null;
  return verifyTokenAsync(token);
}

export function requireRole(user: JWTPayload | null, roles: string[]): boolean {
  if (!user) return false;
  return roles.includes(user.role);
}

// Subscription middleware
export async function withSubscriptionCheck(
  req: NextRequest,
  feature: keyof NonNullable<Awaited<ReturnType<typeof getUserSubscription>>>['features']
): Promise<{ user: JWTPayload | null; subscription: NonNullable<Awaited<ReturnType<typeof getUserSubscription>>> | null; hasAccess: boolean }> {
  const user = await getAuthUser(req);
  if (!user) {
    return { user: null, subscription: null, hasAccess: false };
  }

  const subscription = await getUserSubscription(user.userId);
  const hasAccess = user.role === 'ADMIN' || hasFeatureAccess(subscription, feature);

  return { user, subscription, hasAccess };
}

// Require a feature permission for the signed-in user.
// - ADMIN always passes.
// - STAFF/KITCHEN must have user.permissions.[feature] === true.
// - No signed-in user returns null (caller redirects to /login).
export async function requirePermission(
  req: NextRequest,
  feature: string
): Promise<JWTPayload | null> {
  const user = await getAuthUser(req);
  if (!user) return null;
  if (user.role === 'ADMIN') return user;
  // non-ADMIN: check the 10 permission flags from Staff Management
  const perms = user.permissions ?? {};
  if (perms[feature] === true) return user;
  return null;
}

// Helper function for API routes
export async function checkFeatureAccess(
  req: NextRequest,
  feature: keyof NonNullable<Awaited<ReturnType<typeof getUserSubscription>>>['features']
): Promise<{ user: JWTPayload | null; hasAccess: boolean }> {
  const { user, hasAccess } = await withSubscriptionCheck(req, feature);
  return { user, hasAccess };
}
