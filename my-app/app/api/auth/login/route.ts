import { NextRequest, NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
import { prisma } from '@/lib/prisma';
import { signToken, JWTPayload } from '@/lib/auth';

export async function POST(req: NextRequest) {
  try {
    const { email, password } = await req.json();

    if (!email || !password) {
      return NextResponse.json({ error: 'Email and password required' }, { status: 400 });
    }

    const user = await prisma.user.findUnique({ where: { email } });
    if (!user || !user.active) {
      return NextResponse.json({ error: 'Invalid credentials' }, { status: 401 });
    }

    const valid = await bcrypt.compare(password, user.password);
    if (!valid) {
      return NextResponse.json({ error: 'Invalid credentials' }, { status: 401 });
    }

    // Parse permissions from JSON string
    let permissions: Record<string, boolean> = {};
    if (user.permissions) {
      try {
        permissions = typeof user.permissions === 'string' 
          ? JSON.parse(user.permissions) 
          : user.permissions;
      } catch (e) {
        console.error('Error parsing permissions:', e);
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

    const res = NextResponse.json({ user: payload, token });
    res.cookies.set('cafeos-token', token, {
      httpOnly: true,
      sameSite: 'lax',
      maxAge: 60 * 60 * 12, // 12 hours
      path: '/',
    });

    return res;
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
}
