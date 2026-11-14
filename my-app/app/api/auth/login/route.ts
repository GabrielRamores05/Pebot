import { NextRequest, NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
import { prisma } from '@/lib/prisma';
import { signToken, JWTPayload } from '@/lib/auth';
import { apiError, badRequest, serverError, unauthorized } from '@/lib/api-response';
import { clientIp, rateLimit, resetRateLimit } from '@/lib/rate-limit';

const MAX_ATTEMPTS = 10;
const WINDOW_MS = 15 * 60 * 1000;

export async function POST(req: NextRequest) {
  try {
    const { email, password } = await req.json();

    if (!email || !password) {
      return badRequest('Email and password required');
    }

    // Password guessing over the shop LAN is otherwise unlimited.
    const limitKey = `login:${clientIp(req)}:${String(email).toLowerCase()}`;
    const { allowed, retryAfterSeconds } = rateLimit(limitKey, MAX_ATTEMPTS, WINDOW_MS);
    if (!allowed) {
      return apiError(
        `Too many sign-in attempts. Try again in ${Math.ceil(retryAfterSeconds / 60)} minute(s).`,
        429,
      );
    }

    const user = await prisma.user.findUnique({ where: { email } });
    if (!user || !user.active) {
      return unauthorized('Invalid credentials');
    }

    const valid = await bcrypt.compare(password, user.password);
    if (!valid) {
      return unauthorized('Invalid credentials');
    }

    resetRateLimit(limitKey);

    // Parse permissions from JSON string
    let permissions: Record<string, boolean> = {};
    if (user.permissions) {
      try {
        permissions = typeof user.permissions === 'string' 
          ? JSON.parse(user.permissions) 
          : user.permissions;
      } catch (e) {
        // Signing in with no permissions is safe, but the stored value is broken
        // and someone has to know which account to repair.
        console.error(`[LOGIN] Corrupt permissions for user ${user.id} (${user.email}), signing in with none:`, e);
      }
    }
    console.log('[LOGIN] User:', user.email);

    const payload: JWTPayload = {
      userId: user.id,
      email: user.email,
      role: user.role as JWTPayload['role'],
      name: user.name,
      permissions,
    };

    const token = await signToken(payload);

    // Signing in no longer clocks a person in: an owner checking reports from home
    // is not on shift. Staff clock in from the sidebar (spec 020).

    const res = NextResponse.json({ user: payload, token });
    res.cookies.set('cafeos-token', token, {
      httpOnly: true,
      sameSite: 'lax',
      // Only over HTTPS deployments (deploy/Caddyfile); the LAN install is plain
      // HTTP, where a secure cookie would never be sent back.
      secure: req.nextUrl.protocol === 'https:',
      maxAge: 60 * 60 * 12, // 12 hours
      path: '/',
    });

    return res;
  } catch (e) {
    return serverError(e);
  }
}
