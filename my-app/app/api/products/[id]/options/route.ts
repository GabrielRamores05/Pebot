import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requirePermission } from '@/lib/auth';

interface RouteParams {
  params: Promise<{ id: string }>;
}

// GET /api/products/:id/options?groupId=X — list per-product options for one group
export async function GET(req: NextRequest, { params }: RouteParams) {
  const { id } = await params;
  const groupId = Number(new URL(req.url).searchParams.get('groupId'));
  if (!Number.isInteger(groupId)) {
    return NextResponse.json({ error: 'groupId query parameter is required' }, { status: 400 });
  }
  const options = await prisma.productOption.findMany({
    where: { productId: Number(id), groupId },
    include: { ingredients: true },
    orderBy: { sortOrder: 'asc' },
  });
  return NextResponse.json(options);
}

// POST /api/products/:id/options?groupId=X — create a per-product option
export async function POST(req: NextRequest, { params }: RouteParams) {
  const user = await requirePermission(req, 'products');
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { id } = await params;
  const groupId = Number(new URL(req.url).searchParams.get('groupId'));
  if (!Number.isInteger(groupId)) {
    return NextResponse.json({ error: 'groupId query parameter is required' }, { status: 400 });
  }

  try {
    const body = await req.json();
    const { name, priceDelta, sortOrder, available } = body as {
      name?: string;
      priceDelta?: number;
      sortOrder?: number;
      available?: boolean;
    };

    if (!name?.trim()) {
      return NextResponse.json({ error: 'Option name is required' }, { status: 400 });
    }

    // Ensure the group is attached to this product
    const attachment = await prisma.productOptionGroup.findUnique({
      where: { productId_groupId: { productId: Number(id), groupId } },
    });
    if (!attachment) {
      return NextResponse.json({ error: 'This group is not attached to this product' }, { status: 400 });
    }

    const option = await prisma.productOption.create({
      data: {
        productId: Number(id),
        groupId,
        name: name.trim(),
        priceDelta: priceDelta ?? 0,
        sortOrder: sortOrder ?? 0,
        available: available ?? true,
      },
    });
    return NextResponse.json(option, { status: 201 });
  } catch (error: any) {
    if (error.code === 'P2002') {
      return NextResponse.json({ error: 'This product already has an option with that name in this group' }, { status: 409 });
    }
    return NextResponse.json({ error: 'Failed to create option' }, { status: 500 });
  }
}
