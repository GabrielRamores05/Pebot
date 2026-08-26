import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requirePermission } from '@/lib/auth';

interface RouteParams {
  params: Promise<{ id: string }>;
}

// GET /api/option-groups/:id/options — list options in a group
export async function GET(req: NextRequest, { params }: RouteParams) {
  const user = await requirePermission(req, 'products');
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { id } = await params;
  const options = await prisma.option.findMany({
    where: { groupId: Number(id) },
    orderBy: { sortOrder: 'asc' },
  });
  return NextResponse.json(options);
}

// POST /api/option-groups/:id/options — add an option to the group
export async function POST(req: NextRequest, { params }: RouteParams) {
  const user = await requirePermission(req, 'products');
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { id } = await params;
  try {
    const body = await req.json();
    const { name, priceDelta, sizeMultiplier, sortOrder, available } = body as {
      name?: string;
      priceDelta?: number;
      sizeMultiplier?: number;
      sortOrder?: number;
      available?: boolean;
    };

    if (!name?.trim()) {
      return NextResponse.json({ error: 'Option name is required' }, { status: 400 });
    }

    const option = await prisma.option.create({
      data: {
        groupId: Number(id),
        name: name.trim(),
        priceDelta: priceDelta ?? 0,
        sizeMultiplier: sizeMultiplier ?? 1,
        sortOrder: sortOrder ?? 0,
        available: available ?? true,
      },
    });
    return NextResponse.json(option, { status: 201 });
  } catch (error: any) {
    if (error.code === 'P2002') {
      return NextResponse.json({ error: 'This group already has an option with that name' }, { status: 409 });
    }
    return NextResponse.json({ error: 'Failed to create option' }, { status: 500 });
  }
}
