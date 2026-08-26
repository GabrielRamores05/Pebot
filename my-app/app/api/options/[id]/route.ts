import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requirePermission } from '@/lib/auth';

interface RouteParams {
  params: Promise<{ id: string }>;
}

// PUT /api/options/:id — update an option
export async function PUT(req: NextRequest, { params }: RouteParams) {
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

    const option = await prisma.option.update({
      where: { id: Number(id) },
      data: {
        ...(name !== undefined && { name: name.trim() }),
        ...(priceDelta !== undefined && { priceDelta }),
        ...(sizeMultiplier !== undefined && { sizeMultiplier }),
        ...(sortOrder !== undefined && { sortOrder }),
        ...(available !== undefined && { available }),
      },
    });
    return NextResponse.json(option);
  } catch (error: any) {
    if (error.code === 'P2002') {
      return NextResponse.json({ error: 'This group already has an option with that name' }, { status: 409 });
    }
    if (error.code === 'P2025') {
      return NextResponse.json({ error: 'Option not found' }, { status: 404 });
    }
    return NextResponse.json({ error: 'Failed to update option' }, { status: 500 });
  }
}

// DELETE /api/options/:id
export async function DELETE(req: NextRequest, { params }: RouteParams) {
  const user = await requirePermission(req, 'products');
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { id } = await params;
  try {
    await prisma.option.delete({ where: { id: Number(id) } });
    return NextResponse.json({ success: true });
  } catch (error: any) {
    if (error.code === 'P2025') {
      return NextResponse.json({ error: 'Option not found' }, { status: 404 });
    }
    return NextResponse.json({ error: 'Failed to delete option' }, { status: 500 });
  }
}
