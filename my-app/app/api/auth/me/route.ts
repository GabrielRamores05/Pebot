import { NextRequest, NextResponse } from 'next/server';
import { getAuthUser } from '@/lib/auth';

export async function GET(req: NextRequest) {
  const user = await getAuthUser(req);
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  return NextResponse.json({ user });
}

export async function DELETE() {
  const res = NextResponse.json({ ok: true });
  res.cookies.delete('cafeos-token');
  return res;
}
