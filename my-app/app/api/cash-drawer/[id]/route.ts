import { NextRequest, NextResponse } from 'next/server';
import { guardPermission } from '@/lib/api-guards';
import { badRequest } from '@/lib/api-response';
import { getDrawer } from '@/modules/cash-drawer/service';
import { drawerError } from '../errors';

// GET /api/cash-drawer/:id — one drawer with its totals (for the shift report)
export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  const guard = await guardPermission(req, 'terminal');
  if (guard.error) return guard.error;
  const id = Number(params.id);
  if (!Number.isInteger(id) || id <= 0) return badRequest('Invalid cash drawer id');
  try {
    return NextResponse.json({ drawer: await getDrawer(id) });
  } catch (e) {
    return drawerError(e);
  }
}
