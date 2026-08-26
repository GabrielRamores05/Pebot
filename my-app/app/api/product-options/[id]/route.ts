import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requirePermission } from '@/lib/auth';

interface RouteParams {
  params: Promise<{ id: string }>;
}

// GET /api/product-options/:id — fetch a single per-product option with ingredients
export async function GET(req: NextRequest, { params }: RouteParams) {
  const { id } = await params;
  try {
    const option = await prisma.productOption.findUnique({
      where: { id: Number(id) },
      include: { ingredients: true, group: true },
    });
    if (!option) return NextResponse.json({ error: 'Option not found' }, { status: 404 });
    return NextResponse.json(option);
  } catch {
    return NextResponse.json({ error: 'Failed to fetch option' }, { status: 500 });
  }
}

// PUT /api/product-options/:id — update a per-product option
export async function PUT(req: NextRequest, { params }: RouteParams) {
  const user = await requirePermission(req, 'products');
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { id } = await params;
  try {
    const body = await req.json();
    const { name, priceDelta, sortOrder, available } = body as {
      name?: string;
      priceDelta?: number;
      sortOrder?: number;
      available?: boolean;
    };

    const option = await prisma.productOption.update({
      where: { id: Number(id) },
      data: {
        ...(name !== undefined && { name: name.trim() }),
        ...(priceDelta !== undefined && { priceDelta }),
        ...(sortOrder !== undefined && { sortOrder }),
        ...(available !== undefined && { available }),
      },
    });
    return NextResponse.json(option);
  } catch (error: any) {
    if (error.code === 'P2002') {
      return NextResponse.json({ error: 'This product already has an option with that name in this group' }, { status: 409 });
    }
    if (error.code === 'P2025') {
      return NextResponse.json({ error: 'Option not found' }, { status: 404 });
    }
    return NextResponse.json({ error: 'Failed to update option' }, { status: 500 });
  }
}

// DELETE /api/product-options/:id
export async function DELETE(req: NextRequest, { params }: RouteParams) {
  const user = await requirePermission(req, 'products');
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { id } = await params;
  try {
    await prisma.productOption.delete({ where: { id: Number(id) } });
    return NextResponse.json({ success: true });
  } catch (error: any) {
    if (error.code === 'P2025') {
      return NextResponse.json({ error: 'Option not found' }, { status: 404 });
    }
    return NextResponse.json({ error: 'Failed to delete option' }, { status: 500 });
  }
}
