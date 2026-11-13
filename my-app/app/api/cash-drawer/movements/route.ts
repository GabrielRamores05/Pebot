import { NextRequest, NextResponse } from 'next/server';
import { guardPermission } from '@/lib/api-guards';
import { recordMovement } from '@/modules/cash-drawer/service';
import { drawerError } from '../errors';

// POST /api/cash-drawer/movements — cash in or cash out of the open drawer
export async function POST(req: NextRequest) {
  const guard = await guardPermission(req, 'terminal');
  if (guard.error) return guard.error;
  try {
    const drawer = await recordMovement(await req.json(), { userId: guard.user!.userId, name: guard.user!.name });
    return NextResponse.json({ drawer }, { status: 201 });
  } catch (e) {
    return drawerError(e);
  }
}
