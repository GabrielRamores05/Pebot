import { NextRequest, NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
import { prisma } from '@/lib/prisma';
import { getAuthUser } from '@/lib/auth';

// PATCH /api/settings/users/[id] — update role, password, or active status
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const me = await getAuthUser(req);
  if (!me || me.role !== 'ADMIN') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const { id } = await params;
  const userId = parseInt(id);
  if (isNaN(userId)) return NextResponse.json({ error: 'Invalid id' }, { status: 400 });

  const body = await req.json();
  const data: Record<string, unknown> = {};

  if (body.role !== undefined) {
    const allowed = ['ADMIN', 'STAFF', 'KITCHEN'];
    if (!allowed.includes(body.role)) return NextResponse.json({ error: 'Invalid role' }, { status: 400 });
    if (userId === me.userId && body.role !== me.role) {
      return NextResponse.json({ error: 'You cannot change your own role' }, { status: 400 });
    }
    data.role = body.role;
  }

  if (body.active !== undefined) {
    data.active = Boolean(body.active);
  }

  if (body.password) {
    if (body.password.length < 4) {
      return NextResponse.json({ error: 'Password must be at least 4 characters' }, { status: 400 });
    }
    data.password = await bcrypt.hash(body.password, 10);
  }

  if (body.name !== undefined) data.name = body.name;

  const user = await prisma.user.update({
    where: { id: userId },
    data,
    select: { id: true, name: true, email: true, role: true, active: true, createdAt: true },
  });

  return NextResponse.json(user);
}

// DELETE /api/settings/users/[id] — delete user (cannot delete yourself)
export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const me = await getAuthUser(req);
  if (!me || me.role !== 'ADMIN') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const { id } = await params;
  const userId = parseInt(id);
  if (isNaN(userId)) return NextResponse.json({ error: 'Invalid id' }, { status: 400 });

  if (userId === me.userId) {
    return NextResponse.json({ error: 'Cannot delete your own account' }, { status: 400 });
  }

  await prisma.user.delete({ where: { id: userId } });
  return NextResponse.json({ ok: true });
}
