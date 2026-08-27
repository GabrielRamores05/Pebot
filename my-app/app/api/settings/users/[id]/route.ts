import { NextRequest, NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
import { prisma } from '@/lib/prisma';
import { badRequest } from '@/lib/api-response';
import { guardAdmin } from '@/lib/api-guards';

// PATCH /api/settings/users/[id] — update role, password, or active status
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { user: me, error } = await guardAdmin(req);
  if (error) return error;

  const { id } = await params;
  const userId = parseInt(id);
  if (isNaN(userId)) return badRequest('Invalid id');

  const body = await req.json();
  const data: Record<string, unknown> = {};

  if (body.role !== undefined) {
    const allowed = ['ADMIN', 'STAFF', 'KITCHEN'];
    if (!allowed.includes(body.role)) return badRequest('Invalid role');
    if (userId === me.userId && body.role !== me.role) {
      return badRequest('You cannot change your own role');
    }
    data.role = body.role;
  }

  if (body.active !== undefined) {
    data.active = Boolean(body.active);
  }

  if (body.password) {
    if (body.password.length < 4) {
      return badRequest('Password must be at least 4 characters');
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
  const { user: me, error } = await guardAdmin(req);
  if (error) return error;

  const { id } = await params;
  const userId = parseInt(id);
  if (isNaN(userId)) return badRequest('Invalid id');

  if (userId === me.userId) {
    return badRequest('Cannot delete your own account');
  }

  await prisma.user.delete({ where: { id: userId } });
  return NextResponse.json({ ok: true });
}
