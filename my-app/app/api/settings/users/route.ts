import { NextRequest, NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
import { prisma } from '@/lib/prisma';
import { badRequest, conflict } from '@/lib/api-response';
import { guardAdmin } from '@/lib/api-guards';

// GET /api/settings/users — list all users (ADMIN only)
export async function GET(req: NextRequest) {
  const { error } = await guardAdmin(req);
  if (error) return error;

  const users = await prisma.user.findMany({
    select: { id: true, name: true, email: true, role: true, active: true, createdAt: true },
    orderBy: { createdAt: 'asc' },
  });

  return NextResponse.json(users);
}

// POST /api/settings/users — create new user (ADMIN only)
export async function POST(req: NextRequest) {
  const { error } = await guardAdmin(req);
  if (error) return error;

  const { name, email, password, role } = await req.json();

  if (!name || !email || !password || !role) {
    return badRequest('All fields required');
  }

  const allowed = ['ADMIN', 'STAFF', 'KITCHEN'];
  if (!allowed.includes(role)) {
    return badRequest('Invalid role');
  }

  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) {
    return conflict('Email already in use');
  }

  const hashed = await bcrypt.hash(password, 10);
  const user = await prisma.user.create({
    data: { name, email, password: hashed, role },
    select: { id: true, name: true, email: true, role: true, active: true, createdAt: true },
  });

  return NextResponse.json(user, { status: 201 });
}
