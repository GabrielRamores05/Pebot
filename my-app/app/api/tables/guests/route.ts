import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { emitEvent } from '@/lib/socket';

// POST /api/tables/guests
// Register a guest seated at a table with optional mood metadata
export async function POST(req: NextRequest) {
  try {
    const body = await req.json() as {
      tableId: number;
      sessionId: number;
      displayName: string;
      moodEmoji?: string | null;
      moodNote?: string | null;
    };

    const tableId = Number(body.tableId);
    const sessionId = Number(body.sessionId);
    const displayName = (body.displayName || '').trim();
    const moodEmoji = body.moodEmoji ?? null;
    const moodNote = body.moodNote ?? null;

    if (!tableId || !sessionId || !displayName) {
      return NextResponse.json(
        { error: 'tableId, sessionId and displayName are required' },
        { status: 400 }
      );
    }

    // Ensure table & session exist (lightweight checks)
    const [table, session] = await Promise.all([
      prisma.restaurantTable.findUnique({ where: { id: tableId } }),
      prisma.tableSession.findUnique({ where: { id: sessionId } }),
    ]);

    if (!table) {
      return NextResponse.json({ error: 'Table not found' }, { status: 404 });
    }
    if (!session || session.tableId !== tableId) {
      return NextResponse.json(
        { error: 'Session not found for this table' },
        { status: 404 }
      );
    }

    const guest = await prisma.tableGuest.create({
      data: {
        tableId,
        sessionId,
        displayName,
        moodEmoji,
        moodNote,
      },
    });

    emitEvent('table-guest-joined', {
      tableId,
      tableName: table.name,
      sessionId,
      guest,
      timestamp: new Date(),
    });

    return NextResponse.json(guest, { status: 201 });
  } catch (e) {
    console.error('❌ POST /api/tables/guests error:', e);
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
}

// PATCH /api/tables/guests
// Update guest mood or mark them as inactive
export async function PATCH(req: NextRequest) {
  try {
    const body = await req.json() as {
      id: number;
      moodEmoji?: string | null;
      moodNote?: string | null;
      active?: boolean;
    };

    const id = Number(body.id);
    if (!id) {
      return NextResponse.json({ error: 'Guest id is required' }, { status: 400 });
    }

    const updateData: Record<string, unknown> = {};
    if (body.moodEmoji !== undefined) updateData.moodEmoji = body.moodEmoji;
    if (body.moodNote !== undefined) updateData.moodNote = body.moodNote;
    if (body.active !== undefined) {
      updateData.active = body.active;
      if (body.active === false) {
        updateData.exitedAt = new Date();
      }
    }

    if (Object.keys(updateData).length === 0) {
      return NextResponse.json({ error: 'No fields to update' }, { status: 400 });
    }

    const existing = await prisma.tableGuest.findUnique({
      where: { id },
      include: { table: true, session: true },
    });

    if (!existing) {
      return NextResponse.json({ error: 'Guest not found' }, { status: 404 });
    }

    const guest = await prisma.tableGuest.update({
      where: { id },
      data: updateData,
    });

    const payload = {
      tableId: existing.tableId,
      tableName: existing.table.name,
      sessionId: existing.sessionId,
      guest,
      timestamp: new Date(),
    };

    if (body.active === false) {
      emitEvent('table-guest-left', payload);
    } else {
      emitEvent('table-guest-updated', payload);
    }

    return NextResponse.json(guest);
  } catch (e) {
    console.error('❌ PATCH /api/tables/guests error:', e);
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
}

