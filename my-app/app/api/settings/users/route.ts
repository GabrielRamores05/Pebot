import { NextRequest, NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
import { prisma } from '@/lib/prisma';
import { getAuthUser } from '@/lib/auth';

// GET /api/settings/users — list all users (ADMIN only)
export async function GET(req: NextRequest) {
  const me = await getAuthUser(req);
  if (!me || me.role !== 'ADMIN') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const users = await prisma.user.findMany({
    select: { id: true, name: true, email: true, role: true, active: true, createdAt: true },
    orderBy: { createdAt: 'asc' },
  });

  return NextResponse.json(users);
}

// POST /api/settings/users — create new user (ADMIN only)
export async function POST(req: NextRequest) {
  const me = await getAuthUser(req);
  if (!me || me.role !== 'ADMIN') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const { name, email, password, role } = await req.json();

  if (!name || !email || !password || !role) {
    return NextResponse.json({ error: 'All fields required' }, { status: 400 });
  }

  const allowed = ['ADMIN', 'STAFF', 'KITCHEN'];
  if (!allowed.includes(role)) {
    return NextResponse.json({ error: 'Invalid role' }, { status: 400 });
  }

  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) {
    return NextResponse.json({ error: 'Email already in use' }, { status: 409 });
  }

  const hashed = await bcrypt.hash(password, 10);
  const user = await prisma.user.create({
    data: { name, email, password: hashed, role },
    select: { id: true, name: true, email: true, role: true, active: true, createdAt: true },
  });

  return NextResponse.json(user, { status: 201 });
}
