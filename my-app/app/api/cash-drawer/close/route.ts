import { NextRequest, NextResponse } from 'next/server';
import { guardPermission } from '@/lib/api-guards';
import { closeDrawer } from '@/modules/cash-drawer/service';
import { drawerError } from '../errors';

// POST /api/cash-drawer/close — count the drawer and close it
export async function POST(req: NextRequest) {
  const guard = await guardPermission(req, 'terminal');
  if (guard.error) return guard.error;
  try {
    const drawer = await closeDrawer(await req.json(), { userId: guard.user!.userId, name: guard.user!.name });
    return NextResponse.json({ drawer });
  } catch (e) {
    return drawerError(e);
  }
}
