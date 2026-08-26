import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requirePermission } from '@/lib/auth';

interface RouteParams {
  params: Promise<{ id: string }>;
}

// Always live: customers hit this every time they configure a drink.
export const dynamic = 'force-dynamic';

// GET /api/products/:id/option-groups — public: customers need this to see
// size/temp/add-on choices. Returns per-product options (same JSON shape as
// before so existing pickers need no changes).
export async function GET(req: NextRequest, { params }: RouteParams) {
  const { id } = await params;
  const productId = Number(id);

  // Fetch the groups attached to this product (in attachment order)
  const attachments = await prisma.productOptionGroup.findMany({
    where: { productId, group: { available: true } },
    include: {
      group: {
        select: { id: true, name: true, selectionType: true, sortOrder: true },
      },
    },
    orderBy: { sortOrder: 'asc' },
  });

  // Fetch all per-product options for this product in one query
  const allOptions = await prisma.productOption.findMany({
    where: { productId, available: true },
    orderBy: { sortOrder: 'asc' },
    select: { id: true, name: true, priceDelta: true, groupId: true },
  });

  // Index options by groupId
  const optionsByGroup = new Map<number, typeof allOptions>();
  for (const opt of allOptions) {
    const arr = optionsByGroup.get(opt.groupId) ?? [];
    arr.push(opt);
    optionsByGroup.set(opt.groupId, arr);
  }

  return NextResponse.json(
    attachments.map((a) => ({
      group: a.group,
      options: (optionsByGroup.get(a.groupId) ?? []).map(({ groupId: _, ...rest }) => rest),
    }))
  );
}

// POST /api/products/:id/option-groups — attach a group: { groupId }
export async function POST(req: NextRequest, { params }: RouteParams) {
  const user = await requirePermission(req, 'products');
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { id } = await params;
  try {
    const body = await req.json();
    const groupId = Number(body?.groupId);
    if (!Number.isInteger(groupId)) {
      return NextResponse.json({ error: 'groupId is required' }, { status: 400 });
    }

    const attachment = await prisma.productOptionGroup.create({
      data: { productId: Number(id), groupId },
      include: { group: true },
    });
    return NextResponse.json(attachment, { status: 201 });
  } catch (error: any) {
    if (error.code === 'P2002') {
      return NextResponse.json({ error: 'This group is already attached to the product' }, { status: 409 });
    }
    if (error.code === 'P2025') {
      return NextResponse.json({ error: 'Product or group not found' }, { status: 404 });
    }
    return NextResponse.json({ error: 'Failed to attach option group' }, { status: 500 });
  }
}

// DELETE /api/products/:id/option-groups?groupId=X — detach
export async function DELETE(req: NextRequest, { params }: RouteParams) {
  const user = await requirePermission(req, 'products');
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { id } = await params;
  const groupId = Number(new URL(req.url).searchParams.get('groupId'));
  if (!Number.isInteger(groupId)) {
    return NextResponse.json({ error: 'groupId query parameter is required' }, { status: 400 });
  }

  try {
    await prisma.productOptionGroup.delete({
      where: { productId_groupId: { productId: Number(id), groupId } },
    });
    return NextResponse.json({ success: true });
  } catch (error: any) {
    if (error.code === 'P2025') {
      return NextResponse.json({ error: 'Attachment not found' }, { status: 404 });
    }
    return NextResponse.json({ error: 'Failed to detach option group' }, { status: 500 });
  }
}
