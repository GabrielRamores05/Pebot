import { SignJWT, jwtVerify } from 'jose';
import { randomBytes } from 'node:crypto';
import { cookies } from 'next/headers';
import { NextRequest, NextResponse } from 'next/server';

// Resolved on first use, not at import: `next build` loads every route without
// a secret, and a production server must still refuse to run without one.
let secretBytes: Uint8Array | null = null;
function getSecret(): Uint8Array {
  if (secretBytes) return secretBytes;
  const configured = process.env.JWT_SECRET?.trim() || null;
  if (!configured && process.env.NODE_ENV === 'production') {
    throw new Error('JWT_SECRET must be set in production');
  }
  const value = configured ?? (() => {
    const cached = (globalThis as any).__cafeos_jwt_secret;
    if (cached) return cached as string;
    const generatedSecret = randomBytes(32).toString('hex');
    console.warn('[AUTH] JWT_SECRET is not set; generated a development-only secret. Tokens will not survive a server restart.');
    (globalThis as any).__cafeos_jwt_secret = generatedSecret;
    return generatedSecret;
  })();
  secretBytes = new TextEncoder().encode(value);
  return secretBytes;
}

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
    .sign(getSecret());
}

export async function verifyTokenAsync(token: string): Promise<JWTPayload | null> {
  try {
    const { payload } = await jwtVerify(token, getSecret());
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

/** Features the owner switches on per staff member in Staff Management. */
export type FeatureKey = 'analytics' | 'inventory' | 'staff' | 'settings' | 'kitchen' | 'loyalty';

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

// Feature access for API routes (spec 015, FR-019). Pebot is sold as one license with
// every feature, so access is no longer a pricing tier. It is who may use what:
// ADMIN always, everyone else only with the Staff Management flag for that feature.
export async function checkFeatureAccess(
  req: NextRequest,
  feature: FeatureKey
): Promise<{ user: JWTPayload | null; hasAccess: boolean }> {
  const user = await getAuthUser(req);
  if (!user) return { user: null, hasAccess: false };
  return { user, hasAccess: user.role === 'ADMIN' || (user.permissions ?? {})[feature] === true };
}
