import { NextRequest, NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
import { prisma } from '@/lib/prisma';
import { signToken, JWTPayload } from '@/lib/auth';
import { badRequest, serverError, unauthorized } from '@/lib/api-response';

export async function POST(req: NextRequest) {
  try {
    const { email, password } = await req.json();

    if (!email || !password) {
      return badRequest('Email and password required');
    }

    const user = await prisma.user.findUnique({ where: { email } });
    if (!user || !user.active) {
      return unauthorized('Invalid credentials');
    }

    const valid = await bcrypt.compare(password, user.password);
    if (!valid) {
      return unauthorized('Invalid credentials');
    }

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
    console.log('[LOGIN] User:', user.email, 'Permissions from DB:', JSON.stringify(permissions));

    const payload: JWTPayload = {
      userId: user.id,
      email: user.email,
      role: user.role as JWTPayload['role'],
      name: user.name,
      permissions,
    };

    const token = await signToken(payload);

    // Auto clock-in: record an attendance entry when a staff member logs in
    // (if they don't already have an open shift today).
    try {
      const open = await prisma.attendance.findFirst({
        where: { userId: user.id, clockOut: null },
      });
      if (!open) {
        await prisma.attendance.create({ data: { userId: user.id, clockIn: new Date() } });
      }
    } catch (attErr) {
      console.error('[LOGIN] auto clock-in failed:', attErr);
    }

    const res = NextResponse.json({ user: payload, token });
    res.cookies.set('cafeos-token', token, {
      httpOnly: true,
      sameSite: 'lax',
      maxAge: 60 * 60 * 12, // 12 hours
      path: '/',
    });

    return res;
  } catch (e) {
    return serverError(e);
  }
}
