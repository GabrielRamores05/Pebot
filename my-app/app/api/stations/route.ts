import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

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
    console.error(e);
    return NextResponse.json({ error: 'Failed to fetch stations' }, { status: 500 });
  }
}

// POST /api/stations — create a new station
export async function POST(req: NextRequest) {
  try {
    const { stationType, staffCount, emoji } = (await req.json()) as { stationType: string; staffCount?: number; emoji?: string };

    const name = stationType?.trim().toLowerCase().replace(/[^a-z0-9_-]/g, '');
    if (!name || name.length < 2 || name.length > 30) {
      return NextResponse.json({ error: 'Station name must be 2-30 alphanumeric characters' }, { status: 400 });
    }

    const existing = await prisma.staffStationControl.findUnique({ where: { stationType: name } });
    if (existing) {
      return NextResponse.json({ error: 'Station already exists' }, { status: 409 });
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
    console.error(e);
    return NextResponse.json({ error: 'Failed to create station' }, { status: 500 });
  }
}

// PATCH /api/stations — update staff count or rename a station
export async function PATCH(req: NextRequest) {
  try {
    const { id, staffCount, stationType, emoji } = (await req.json()) as {
      id: number;
      staffCount?: number;
      stationType?: string;
      emoji?: string;
    };

    if (!id) {
      return NextResponse.json({ error: 'Missing station id' }, { status: 400 });
    }

    const data: Record<string, unknown> = {};
    if (typeof staffCount === 'number' && staffCount >= 0) data.staffCount = staffCount;
    if (stationType) {
      const name = stationType.trim().toLowerCase().replace(/[^a-z0-9_-]/g, '');
      if (name.length >= 2 && name.length <= 30) data.stationType = name;
    }
    if (emoji) data.emoji = emoji;

    if (Object.keys(data).length === 0) {
      return NextResponse.json({ error: 'Nothing to update' }, { status: 400 });
    }

    const station = await prisma.staffStationControl.update({
      where: { id },
      data,
    });

    return NextResponse.json(station);
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: 'Failed to update station' }, { status: 500 });
  }
}

// DELETE /api/stations — remove a station
export async function DELETE(req: NextRequest) {
  try {
    const { id } = (await req.json()) as { id: number };

    if (!id) {
      return NextResponse.json({ error: 'Missing station id' }, { status: 400 });
    }

    await prisma.staffStationControl.delete({ where: { id } });
    return NextResponse.json({ success: true });
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: 'Failed to delete station' }, { status: 500 });
  }
}
