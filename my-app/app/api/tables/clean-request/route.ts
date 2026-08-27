import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { emitEvent } from '@/lib/socket';
import { badRequest, notFound, serverError } from '@/lib/api-response';

/**
 * POST /api/tables/clean-request
 * Customer requests that a table be marked as NEEDS_CLEANING.
 * Accepts either tableId or tableName (from QR/menu context).
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json() as { tableId?: number; tableName?: string };
    const tableId = body.tableId ? Number(body.tableId) : undefined;
    const tableName = body.tableName?.trim();

    if (!tableId && !tableName) {
      return badRequest('tableId or tableName is required');
    }

    const table = await prisma.restaurantTable.findFirst({
      where: tableId
        ? { id: tableId }
        : { name: tableName as string },
    });

    if (!table) {
      return notFound('Table not found');
    }

    // If already marked as NEEDS_CLEANING, just acknowledge and emit event
    if (table.status === 'NEEDS_CLEANING') {
      emitEvent('table-clean-request', {
        tableId: table.id,
        tableName: table.name,
        status: table.status,
        alreadyFlagged: true,
        timestamp: new Date(),
      });
      return NextResponse.json({ ok: true, table, alreadyFlagged: true });
    }

    const updated = await prisma.restaurantTable.update({
      where: { id: table.id },
      data: { status: 'NEEDS_CLEANING' },
    });

    emitEvent('table-clean-request', {
      tableId: updated.id,
      tableName: updated.name,
      status: updated.status,
      alreadyFlagged: false,
      timestamp: new Date(),
    });
    emitEvent('table-update', updated);

    return NextResponse.json({ ok: true, table: updated });
  } catch (e) {
    return serverError(e);
  }
}

