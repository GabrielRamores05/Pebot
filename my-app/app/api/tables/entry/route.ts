import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

/**
 * POST /api/tables/entry
 * Customer scans table QR and enters:
 * - number of occupants
 * - customer name (required for new guests)
 * - mood emoji (optional)
 * - mood note/expression (optional)
 */
export async function POST(req: NextRequest) {
  try {
    const { tableId, occupants, customerName, moodEmoji, moodNote, sessionId } = await req.json() as { 
      tableId: number; 
      occupants: number;
      customerName?: string;
      moodEmoji?: string;
      moodNote?: string;
      sessionId?: number | null;
    };

    if (!tableId || !occupants || occupants < 1) {
      return NextResponse.json({ error: 'Valid tableId and occupants (≥1) required' }, { status: 400 });
    }

    // Require customer name for new guests
    if (!customerName || !customerName.trim()) {
      return NextResponse.json({ error: 'Please enter your name' }, { status: 400 });
    }

    const trimmedName = customerName.trim();

    // Fetch table
    const table = await prisma.restaurantTable.findUnique({
      where: { id: tableId }
    });

    if (!table) {
      return NextResponse.json({ error: 'Table not found' }, { status: 404 });
    }

    const current = table.currentOccupants ?? 0;
    const newTotalOccupants = current + occupants;

    // Validate we don't exceed capacity when adding this group
    if (newTotalOccupants > table.capacity) {
      const remaining = Math.max(table.capacity - current, 0);
      const seatText = remaining === 1 ? 'seat' : 'seats';
      return NextResponse.json(
        { error: remaining > 0
            ? `Only ${remaining} ${seatText} left at this table.`
            : 'This table is already full.' },
        { status: 400 }
      );
    }

    // Update table: mark as OCCUPIED and bump currentOccupants
    const updatedTable = await prisma.restaurantTable.update({
      where: { id: tableId },
      data: {
        status: 'OCCUPIED',
        currentOccupants: newTotalOccupants,
        occupiedSince: table.occupiedSince ?? new Date()
      }
    });

    // Reuse a remembered visit only if the device supplies a session id that is
    // still open for THIS table. Otherwise start a fresh visit — a new group must
    // never be mixed with the previous group's orders, even if the previous group
    // left without scanning out. The device's own remembered id is what keeps a
    // refresh or a second order in the same visit.
    let session: { id: number; occupants: number } | null = null;

    if (sessionId) {
      const remembered = await prisma.tableSession.findFirst({
        where: { id: sessionId, tableId, exitTime: null },
      });
      if (remembered) {
        session = await prisma.tableSession.update({
          where: { id: remembered.id },
          data: { occupants: remembered.occupants + occupants },
        });
      }
    }

    if (!session) {
      session = await prisma.tableSession.create({
        data: {
          tableId,
          occupants,
        },
      });
    }

    // Create TableGuest record for each occupant (batch insert)
    const guestData = Array(occupants).fill(null).map(() => ({
      tableId,
      sessionId: session.id,
      displayName: trimmedName,
      moodEmoji: moodEmoji || null,
      moodNote: moodNote || null,
      active: true,
    }));

    // Create guests for each occupant using batch insert
    await prisma.tableGuest.createMany({
      data: guestData,
    });

    // Fetch back the created guests for the response
    const guests = await prisma.tableGuest.findMany({
      where: { sessionId: session.id, active: true },
      orderBy: { createdAt: 'asc' },
      take: occupants,
    });

    // Emit event to notify admin dashboard
    const { emitEvent } = await import('@/lib/socket');
    const payload = {
      tableId,
      tableName: table.name,
      occupants,
      status: updatedTable.status,
      currentOccupants: updatedTable.currentOccupants,
      timestamp: new Date(),
    };
    emitEvent('table-occupied', payload);
    emitEvent('table-guest-joined', { tableId, guests });
    // Also emit generic table-update so admin table page refreshes
    emitEvent('table-update', updatedTable);

    return NextResponse.json({
      success: true,
      table: updatedTable,
      session: session,
      guests: guests
    });

  } catch (e) {
    console.error('❌ Entry endpoint error:', e);
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
}
