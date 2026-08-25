import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { emitEvent } from '@/lib/socket';

function slugify(name: string): string {
  return name
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

export async function GET(_req: NextRequest) {
  try {
    const tables = await prisma.restaurantTable.findMany({
      orderBy: { name: 'asc' },
      include: {
        guests: {
          where: { active: true },
          orderBy: { createdAt: 'asc' },
        },
        sessions: {
          where: { exitTime: null },
          orderBy: { entryTime: 'desc' },
          include: {
            orders: {
              orderBy: { createdAt: 'asc' },
            },
          },
        },
      },
    });
    return NextResponse.json(tables);
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const body = await req.json() as { id: number; status?: string; name?: string; capacity?: number; section?: string; positionX?: number; positionY?: number };
    const { id, status, name, capacity, section, positionX, positionY } = body;
    
    console.log('🔧 PATCH request received:', { id, status, name, capacity, section, positionX, positionY });

    const data: Record<string, unknown> = {};
    if (status) data.status = status;
    if (name) data.name = name;
    if (capacity !== undefined) data.capacity = capacity;
    if (section) data.section = section;
    if (positionX !== undefined) data.positionX = positionX;
    if (positionY !== undefined) data.positionY = positionY;

    console.log('📝 Update data:', data);

    const table = await prisma.restaurantTable.update({
      where: { id },
      data,
    });

    console.log('✅ Table updated:', table);
    emitEvent('table-update', table);
    return NextResponse.json(table);
  } catch (e) {
    console.error('❌ PATCH Error:', e);
    const errorMessage = e instanceof Error ? e.message : 'Unknown error';
    return NextResponse.json({ error: errorMessage, details: String(e) }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const { name, capacity } = await req.json() as { name: string; capacity: number };

    const trimmedName = name?.trim();
    if (!trimmedName) {
      return NextResponse.json({ error: 'Table name is required' }, { status: 400 });
    }

    const safeCapacity = typeof capacity === 'number' && capacity > 0 ? capacity : 4;

    console.log('📝 Creating table (minimal fields):', { name: trimmedName, capacity: safeCapacity });

    // Build a stable slug from the name. If the slug already exists, append a
    // short suffix so every table's QR link stays unique and stable.
    const baseSlug = slugify(trimmedName) || `table-${Date.now()}`;
    let slug = baseSlug;
    let slugTaken = await prisma.restaurantTable.findUnique({ where: { slug } });
    let suffix = 2;
    while (slugTaken) {
      slug = `${baseSlug}-${suffix}`;
      slugTaken = await prisma.restaurantTable.findUnique({ where: { slug } });
      suffix += 1;
    }

    // Use only columns that are guaranteed to exist and rely on DB defaults
    const table = await prisma.restaurantTable.create({
      data: {
        name: trimmedName,
        slug,
        capacity: safeCapacity,
      },
    });
    console.log('✅ Table created:', table);
    emitEvent('table-update', table);
    return NextResponse.json(table, { status: 201 });
  } catch (e) {
    console.error('❌ POST Error:', e);

    // Handle common Prisma unique constraint for table name
    const errorMsg = String(e);
    if (errorMsg.includes('Unique constraint') || errorMsg.includes('P2002')) {
      return NextResponse.json({ error: 'A table with this name already exists. Please use a different name.' }, { status: 400 });
    }

    const errorMessage = e instanceof Error ? e.message : 'Unknown error';
    return NextResponse.json({ error: errorMessage, details: String(e) }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const { id, force } = await req.json() as { id: number; force?: boolean };
    const table = await prisma.restaurantTable.findUnique({ where: { id } });
    if (!table) return NextResponse.json({ error: 'Not found' }, { status: 404 });
    
    // If force is true or table is occupied, just reset the table status before delete
    if (force || table.status === 'OCCUPIED') {
      await prisma.restaurantTable.update({
        where: { id },
        data: {
          status: 'AVAILABLE',
          currentOccupants: 0,
          occupiedSince: null,
          assignedOrderId: null,
        }
      });
    }
    
    // Now try to delete - if there are related records, it might fail
    // but that's expected if not using cascade delete
    await prisma.restaurantTable.delete({ where: { id } });
    emitEvent('table-update', { id, deleted: true });
    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error('DELETE Error:', e);
    const errorMessage = e instanceof Error ? e.message : 'Unknown error';
    return NextResponse.json({ error: errorMessage }, { status: 500 });
  }
}

// PUT /api/tables - Manual occupant adjustment or clear guests
export async function PUT(req: NextRequest) {
  try {
    const { id, action, occupantCount, customerName } = await req.json() as { 
      id: number; 
      action?: 'add' | 'remove' | 'set' | 'clear';
      occupantCount?: number;
      customerName?: string;
    };
    
    const table = await prisma.restaurantTable.findUnique({ where: { id } });
    if (!table) return NextResponse.json({ error: 'Not found' }, { status: 404 });
    
    // Handle clear action - remove all guests and reset table
    if (action === 'clear') {
      const activeSession = await prisma.tableSession.findFirst({
        where: { tableId: id, exitTime: null },
        orderBy: { entryTime: 'desc' },
      });
      const activeGuests = activeSession
        ? await prisma.tableGuest.findMany({ where: { sessionId: activeSession.id, active: true } })
        : [];
      if (activeGuests.length > 0) {
        return NextResponse.json({ error: 'Cannot clear table with active guests. Please dismiss guests first.' }, { status: 400 });
      }
      
      await prisma.$transaction([
        prisma.tableGuest.updateMany({
          where: { tableId: id, active: true },
          data: { active: false, exitedAt: new Date() }
        }),
        prisma.tableSession.updateMany({
          where: { tableId: id, exitTime: null },
          data: { exitTime: new Date() }
        })
      ]);
      
      const updatedTable = await prisma.restaurantTable.update({
        where: { id },
        data: {
          currentOccupants: 0,
          status: 'AVAILABLE',
          occupiedSince: null,
        }
      });
      
      emitEvent('table-update', updatedTable);
      emitEvent('table-guest-updated', { tableId: id });
      return NextResponse.json(updatedTable);
    }
    
    let newOccupants = table.currentOccupants || 0;
    
    if (action === 'add') {
      newOccupants += 1;
    } else if (action === 'remove') {
      // Only decrement if there's an active session with guests
      const activeSession = await prisma.tableSession.findFirst({
        where: { tableId: id, exitTime: null },
        orderBy: { entryTime: 'desc' },
      });
      
      // If no active session, don't decrement - just return current state
      if (!activeSession) {
        return NextResponse.json(table);
      }
      
      // Find active guests in this session
      const activeGuests = await prisma.tableGuest.findMany({
        where: { sessionId: activeSession.id, active: true }
      });
      
      // If no active guests, don't decrement
      if (activeGuests.length === 0) {
        return NextResponse.json(table);
      }
      
      newOccupants = newOccupants - 1;
      
      // First try to find the guest by name (if provided)
      let leavingGuest = null;
      if (customerName) {
        leavingGuest = await prisma.tableGuest.findFirst({
          where: { 
            sessionId: activeSession.id, 
            active: true,
            displayName: { equals: customerName }
          },
          orderBy: { createdAt: 'desc' },
        });
      }
      
      // Fall back to most recent guest if name not specified or not found
      if (!leavingGuest) {
        leavingGuest = await prisma.tableGuest.findFirst({
          where: { sessionId: activeSession.id, active: true },
          orderBy: { createdAt: 'desc' },
        });
      }
      
      if (leavingGuest) {
        await prisma.tableGuest.update({
          where: { id: leavingGuest.id },
          data: { active: false, exitedAt: new Date() }
        });
        
        console.log(`[Table] Guest "${leavingGuest.displayName}" deactivated from table ${table.name}`);
        
        // Emit guest-left event for admin notifications
        const { emitEvent } = await import('@/lib/socket');
        emitEvent('table-guest-left', { 
          tableId: id, 
          tableName: table.name, 
          guestNames: leavingGuest.displayName 
        });
        // Also emit guest-updated so admin refreshes the guests list
        emitEvent('table-guest-updated', { tableId: id });
      }
    } else if (action === 'set' && occupantCount !== undefined) {
      newOccupants = Math.max(0, Math.min(occupantCount, table.capacity));
    }
    
    const updatedTable = await prisma.restaurantTable.update({
      where: { id },
      data: {
        currentOccupants: newOccupants,
        status: newOccupants > 0 ? 'OCCUPIED' : 'AVAILABLE',
        occupiedSince: newOccupants > 0 ? (table.occupiedSince || new Date()) : null,
      }
    });
    
    emitEvent('table-update', updatedTable);
    return NextResponse.json(updatedTable);
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
}
