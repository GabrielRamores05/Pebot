import { NextRequest, NextResponse } from 'next/server';
import { listTables, createTable, updateTable, deleteTable, adjustOccupants } from '@/modules/tables/service';
import { badRequest, serverError, unauthorized } from '@/lib/api-response';
import { requirePermission } from '@/lib/auth';
import { ValidationError } from 'zod-validation-error';

export async function GET(_req: NextRequest) {
  try {
    const tables = await listTables();
    return NextResponse.json(tables);
  } catch (e) {
    return serverError(e);
  }
}

export async function PATCH(req: NextRequest) {
  const user = await requirePermission(req, 'tables');
  if (!user) return unauthorized();

  try {
    const body = await req.json();
    const table = await updateTable(body);
    return NextResponse.json(table);
  } catch (e) {
    if (e instanceof ValidationError) {
      return badRequest(e.message);
    }
    const status = (e as { status?: number })?.status ?? 500;
    if (status === 400) {
      return NextResponse.json({ error: String(e) }, { status: 400 });
    }
    return serverError(e, 'Failed to update table');
  }
}

export async function POST(req: NextRequest) {
  const user = await requirePermission(req, 'tables');
  if (!user) return unauthorized();

  try {
    const body = await req.json();
    const table = await createTable(body);
    return NextResponse.json(table, { status: 201 });
  } catch (e) {
    if (e instanceof ValidationError) {
      return badRequest(e.message);
    }
    const status = (e as { status?: number })?.status ?? 500;
    if (status === 400) {
      return NextResponse.json({ error: String(e) }, { status: 400 });
    }
    return serverError(e, 'Failed to create table');
  }
}

export async function DELETE(req: NextRequest) {
  const user = await requirePermission(req, 'tables');
  if (!user) return unauthorized();

  try {
    const body = await req.json();
    await deleteTable(body);
    return NextResponse.json({ ok: true });
  } catch (e) {
    if (e instanceof ValidationError) {
      return badRequest(e.message);
    }
    const status = (e as { status?: number })?.status ?? 500;
    if (status === 404) {
      return NextResponse.json({ error: String(e) }, { status: 404 });
    }
    if (status === 400) {
      return NextResponse.json({ error: String(e) }, { status: 400 });
    }
    return serverError(e, 'Failed to delete table');
  }
}

export async function PUT(req: NextRequest) {
  try {
    const body = await req.json();
    const table = await adjustOccupants(body);
    return NextResponse.json(table);
  } catch (e) {
    if (e instanceof ValidationError) {
      return badRequest(e.message);
    }
    const status = (e as { status?: number })?.status ?? 500;
    if (status === 404) {
      return NextResponse.json({ error: String(e) }, { status: 404 });
    }
    if (status === 400) {
      return NextResponse.json({ error: String(e) }, { status: 400 });
    }
    return serverError(e);
  }
}
