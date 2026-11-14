import { NextRequest, NextResponse } from 'next/server';
import { signToken, type JWTPayload } from '@/lib/auth';
import { apiError, badRequest, serverError, unauthorized } from '@/lib/api-response';
import { clientIp, rateLimit, resetRateLimit, undoAttempt } from '@/lib/rate-limit';
import { findUserByPin } from '@/modules/pins/service';

// POST /api/auth/pin-login { pin } — quick sign-in on a shared register (spec 020).
// PINs are short, so guessing is limited hard: 5 tries per device per 15 minutes.
const MAX_ATTEMPTS = 5;
const WINDOW_MS = 15 * 60 * 1000;
const MAX_ATTEMPTS_ALL_DEVICES = 30;

export async function POST(req: NextRequest) {
  try {
    const { pin } = await req.json();
    if (typeof pin !== 'string' || !/^\d{4,6}$/.test(pin)) return badRequest('Enter your 4 to 6 digit PIN.');

    const limitKey = `pin-login:${clientIp(req)}`;
    const { allowed, retryAfterSeconds } = rateLimit(limitKey, MAX_ATTEMPTS, WINDOW_MS);
    // Also cap guesses from all devices together, so many devices cannot share the work.
    const all = rateLimit('pin-login:all', MAX_ATTEMPTS_ALL_DEVICES, WINDOW_MS);
    if (!allowed || !all.allowed) {
      return apiError(`Too many PIN attempts. Try again in ${Math.ceil(Math.max(retryAfterSeconds, all.retryAfterSeconds) / 60)} minute(s), or sign in with email.`, 429);
    }

    const user = await findUserByPin(pin);
    if (!user) return unauthorized('That PIN did not match anyone.');
    resetRateLimit(limitKey);
    undoAttempt('pin-login:all');

    let permissions: Record<string, boolean> = {};
    try {
      permissions = typeof user.permissions === 'string' ? JSON.parse(user.permissions) : (user.permissions as Record<string, boolean>);
    } catch (e) {
      console.error(`[PIN LOGIN] Corrupt permissions for user ${user.id}, signing in with none:`, e);
    }
    const payload: JWTPayload = {
      userId: user.id,
      email: user.email,
      role: user.role as JWTPayload['role'],
      name: user.name,
      permissions,
    };
    const token = await signToken(payload);
    const res = NextResponse.json({ user: payload });
    res.cookies.set('cafeos-token', token, {
      httpOnly: true,
      sameSite: 'lax',
      secure: req.nextUrl.protocol === 'https:',
      maxAge: 60 * 60 * 12,
      path: '/',
    });
    return res;
  } catch (e) {
    return serverError(e);
  }
}
