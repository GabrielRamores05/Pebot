import { NextRequest, NextResponse } from 'next/server';
import { getAuthUser } from '@/lib/auth';
import { unauthorized } from '@/lib/api-response';

export async function GET(req: NextRequest) {
  const user = await getAuthUser(req);
  if (!user) return unauthorized();
  return NextResponse.json({ user });
}

export async function DELETE() {
  // Signing out no longer clocks a person out: with PIN switching, cashiers sign
  // out mid-shift. Staff clock out from the sidebar (spec 020).
  const res = NextResponse.json({ ok: true });
  res.cookies.delete('cafeos-token');
  return res;
}
