import { NextRequest, NextResponse } from 'next/server';
import { ValidationError } from 'zod-validation-error';
import { requirePermission } from '@/lib/auth';
import { badRequest, serverError, unauthorized } from '@/lib/api-response';
import { listHolidays, removeHoliday, saveHoliday } from '@/modules/hr/service';

// Holidays used by payroll (spec 021)
export async function GET(req: NextRequest) {
  const auth = await requirePermission(req, 'staff');
  if (!auth) return unauthorized();
  try {
    const year = Number(req.nextUrl.searchParams.get('year') || new Date().getFullYear());
    if (!Number.isInteger(year) || year < 2000 || year > 2100) return badRequest('Invalid year');
    return NextResponse.json(await listHolidays(year));
  } catch (e) {
    if (e instanceof ValidationError) return badRequest(e.message);
    return serverError(e);
  }
}

export async function POST(req: NextRequest) {
  const auth = await requirePermission(req, 'staff');
  if (!auth) return unauthorized();
  try {
    return NextResponse.json(await saveHoliday(await req.json()), { status: 201 });
  } catch (e) {
    if (e instanceof ValidationError) return badRequest(e.message);
    return serverError(e);
  }
}

export async function DELETE(req: NextRequest) {
  const auth = await requirePermission(req, 'staff');
  if (!auth) return unauthorized();
  try {
    const id = Number(req.nextUrl.searchParams.get('id'));
    if (!Number.isInteger(id) || id <= 0) return badRequest('Invalid holiday');
    await removeHoliday(id);
    return NextResponse.json({ ok: true });
  } catch (e) {
    if (e instanceof ValidationError) return badRequest(e.message);
    return serverError(e);
  }
}
