import { NextRequest, NextResponse } from 'next/server';
import { guardPermission } from '@/lib/api-guards';
import { currentDrawer, openDrawer } from '@/modules/cash-drawer/service';
import { drawerError } from './errors';

// GET /api/cash-drawer — the open drawer, or null (spec 017)
export async function GET(req: NextRequest) {
  const guard = await guardPermission(req, 'terminal');
  if (guard.error) return guard.error;
  try {
    return NextResponse.json({ drawer: await currentDrawer() });
  } catch (e) {
    return drawerError(e);
  }
}

// POST /api/cash-drawer — open a drawer with starting cash
export async function POST(req: NextRequest) {
  const guard = await guardPermission(req, 'terminal');
  if (guard.error) return guard.error;
  try {
    const drawer = await openDrawer(await req.json(), { userId: guard.user!.userId, name: guard.user!.name });
    return NextResponse.json({ drawer }, { status: 201 });
  } catch (e) {
    return drawerError(e);
  }
}
