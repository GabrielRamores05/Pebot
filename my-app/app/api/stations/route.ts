import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { badRequest, conflict, serverError, unauthorized } from '@/lib/api-response';
import { requirePermission } from '@/lib/auth';

const DEFAULT_STATIONS = ['coffee', 'kitchen', 'bar', 'pastry', 'general'];

// GET /api/stations — list all station controls (auto-seed defaults if empty)
export async function GET() {
  try {
    let stations = await prisma.staffStationControl.findMany({
      orderBy: { stationType: 'asc' },
    });

    // Seed default stations if table is empty
    if (stations.length === 0) {
      await prisma.staffStationControl.createMany({
        data: DEFAULT_STATIONS.map((s) => ({ stationType: s, staffCount: 1 })),
      });
      stations = await prisma.staffStationControl.findMany({
        orderBy: { stationType: 'asc' },
      });
    }

    return NextResponse.json(stations);
  } catch (e) {
    return serverError(e, 'Failed to fetch stations');
  }
}

// POST /api/stations — create a new station
export async function POST(req: NextRequest) {
  const user = await requirePermission(req, 'products');
  if (!user) return unauthorized();

  try {
    const { stationType, staffCount, emoji } = (await req.json()) as { stationType: string; staffCount?: number; emoji?: string };

    const name = stationType?.trim().toLowerCase().replace(/[^a-z0-9_-]/g, '');
    if (!name || name.length < 2 || name.length > 30) {
      return badRequest('Station name must be 2-30 alphanumeric characters');
    }

    const existing = await prisma.staffStationControl.findUnique({ where: { stationType: name } });
    if (existing) {
      return conflict('Station already exists');
    }

    const station = await prisma.staffStationControl.create({
      data: { 
        stationType: name, 
        staffCount: Math.max(0, staffCount ?? 1),
        emoji: emoji ?? '📦',
      },
    });

    return NextResponse.json(station, { status: 201 });
  } catch (e) {
    return serverError(e, 'Failed to create station');
  }
}

// PATCH /api/stations — update staff count or rename a station
export async function PATCH(req: NextRequest) {
  const user = await requirePermission(req, 'products');
  if (!user) return unauthorized();

  try {
    const { id, staffCount, stationType, emoji } = (await req.json()) as {
      id: number;
      staffCount?: number;
      stationType?: string;
      emoji?: string;
    };

    if (!id) {
      return badRequest('Missing station id');
    }

    const data: Record<string, unknown> = {};
    if (typeof staffCount === 'number' && staffCount >= 0) data.staffCount = staffCount;
    if (stationType) {
      const name = stationType.trim().toLowerCase().replace(/[^a-z0-9_-]/g, '');
      if (name.length >= 2 && name.length <= 30) data.stationType = name;
    }
    if (emoji) data.emoji = emoji;

    if (Object.keys(data).length === 0) {
      return badRequest('Nothing to update');
    }

    const station = await prisma.staffStationControl.update({
      where: { id },
      data,
    });

    return NextResponse.json(station);
  } catch (e) {
    return serverError(e, 'Failed to update station');
  }
}

// DELETE /api/stations — remove a station
export async function DELETE(req: NextRequest) {
  const user = await requirePermission(req, 'products');
  if (!user) return unauthorized();

  try {
    const { id } = (await req.json()) as { id: number };

    if (!id) {
      return badRequest('Missing station id');
    }

    await prisma.staffStationControl.delete({ where: { id } });
    return NextResponse.json({ success: true });
  } catch (e) {
    return serverError(e, 'Failed to delete station');
  }
}
