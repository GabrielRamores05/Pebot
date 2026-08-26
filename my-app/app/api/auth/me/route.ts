import { NextRequest, NextResponse } from 'next/server';
import { getAuthUser } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

export async function GET(req: NextRequest) {
  const user = await getAuthUser(req);
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  return NextResponse.json({ user });
}

export async function DELETE(req: NextRequest) {
  const user = await getAuthUser(req);
  // Auto clock-out: close any open attendance record for this user.
  if (user) {
    try {
      const open = await prisma.attendance.findFirst({
        where: { userId: user.userId, clockOut: null },
      });
      if (open) {
        const out = new Date();
        const totalMs = out.getTime() - open.clockIn.getTime();
        await prisma.attendance.update({
          where: { id: open.id },
          data: { clockOut: out, totalHours: Math.round((totalMs / 3600000) * 100) / 100 },
        });
      }
    } catch (attErr) {
      console.error('[LOGOUT] auto clock-out failed:', attErr);
    }
  }

  const res = NextResponse.json({ ok: true });
  res.cookies.delete('cafeos-token');
  return res;
}
