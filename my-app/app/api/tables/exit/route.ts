import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { badRequest, notFound, serverError } from '@/lib/api-response';

/**
 * POST /api/tables/exit
 * Customer scans exit QR and confirms which table they were at
 * Reduces occupant count and marks table AVAILABLE when count reaches 0
 */
export async function POST(req: NextRequest) {
  try {
    const { tableId, occupants } = await req.json() as { 
    tableId: number; 
    occupants?: number;
  };

    if (!tableId) {
      return badRequest('Valid tableId required');
    }

    // Default to 1 occupant if not specified, but allow explicit override
    const exitingOccupants = occupants && occupants > 0 ? occupants : 1;

    // Fetch table
    const table = await prisma.restaurantTable.findUnique({
      where: { id: tableId }
    });

    if (!table) {
      return notFound('Table not found');
    }

    // Validate table is occupied
    if (table.status !== 'OCCUPIED' || table.currentOccupants <= 0) {
      return badRequest('This table is not currently occupied.');
    }

    // Validate we can't exit more occupants than currently present
    if (exitingOccupants > table.currentOccupants) {
      return NextResponse.json({ 
        error: `Cannot exit ${exitingOccupants} occupants - only ${table.currentOccupants} present` 
      }, { status: 400 });
    }

    // Reduce occupant count by the number of exiting occupants
    const newOccupants = table.currentOccupants - exitingOccupants;
    const newStatus = newOccupants === 0 ? 'AVAILABLE' : 'OCCUPIED';

    // Find the most recent active session for this table
    const activeSession = await prisma.tableSession.findFirst({
      where: {
        tableId,
        exitTime: null
      },
      orderBy: { entryTime: 'desc' }
    });

    // Update table
    const updatedTable = await prisma.restaurantTable.update({
      where: { id: tableId },
      data: {
        status: newStatus,
        currentOccupants: newOccupants,
        occupiedSince: newOccupants > 0 ? table.occupiedSince : null
      }
    });

    // Mark all active guests as inactive for this session
    let activeGuests: any[] = [];
    if (activeSession) {
      // Find all active guests for this session
      activeGuests = await prisma.tableGuest.findMany({
        where: {
          sessionId: activeSession.id,
          active: true
        },
        orderBy: { createdAt: 'desc' },
        take: exitingOccupants
      });
      
      if (activeGuests.length > 0) {
        const guestIds = activeGuests.map(g => g.id);
        await prisma.tableGuest.updateMany({
          where: { id: { in: guestIds } },
          data: {
            active: false,
            exitedAt: new Date()
          }
        });
      } else {
        // Log warning but don't fail - this can happen if session was created but no guest registered
        console.warn(`[Exit] No active guests found for session ${activeSession.id}, table ${tableId}`);
      }
    }

    // Update the session if this is the last person
    let exitedSession = null;
    if (activeSession && newOccupants === 0) {
      const exitTime = new Date();
      const dwellMinutes = Math.round(
        (exitTime.getTime() - activeSession.entryTime.getTime()) / 60000
      );

      exitedSession = await prisma.tableSession.update({
        where: { id: activeSession.id },
        data: {
          exitTime,
          dwellMinutes
        }
      });
    }

    // Emit event to notify admin dashboard
    const { emitEvent } = await import('@/lib/socket');
    
    // Get names of guests who left
    const leftGuestNames = activeGuests.map((g: any) => g.displayName).join(', ');
    
    const payload = {
      tableId,
      tableName: table.name,
      newOccupants,
      newStatus,
      dwellMinutes: exitedSession?.dwellMinutes || null,
      timestamp: new Date(),
    };
    emitEvent('table-exit', payload);
    // Also emit guest-left event so admin knows who left (with names)
    emitEvent('table-guest-left', { 
      tableId, 
      tableName: table.name, 
      guestNames: leftGuestNames 
    });
    // Also emit generic table-update so admin table page refreshes
    emitEvent('table-update', updatedTable);

    return NextResponse.json({
      success: true,
      table: updatedTable,
      session: exitedSession,
      message: newOccupants === 0 ? `Table ${table.name} is now available` : `${newOccupants} occupant(s) remain at ${table.name}`
    });

  } catch (e) {
    return serverError(e);
  }
}
