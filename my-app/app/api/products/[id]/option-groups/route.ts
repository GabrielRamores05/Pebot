import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requirePermission } from '@/lib/auth';
import { badRequest, conflict, notFound, serverError, unauthorized } from '@/lib/api-response';

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
    include: {
      ingredients: {
        select: { ingredientId: true, deltaQty: true },
      },
    },
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
  if (!user) return unauthorized();

  const { id } = await params;
  try {
    const body = await req.json();
    const groupId = Number(body?.groupId);
    if (!Number.isInteger(groupId)) {
      return badRequest('groupId is required');
    }

    const attachment = await prisma.productOptionGroup.create({
      data: { productId: Number(id), groupId },
      include: { group: true },
    });
    return NextResponse.json(attachment, { status: 201 });
  } catch (error: any) {
    if (error.code === 'P2002') {
      return conflict('This group is already attached to the product');
    }
    if (error.code === 'P2025') {
      return notFound('Product or group not found');
    }
    return serverError(error, 'Failed to attach option group');
  }
}

// DELETE /api/products/:id/option-groups?groupId=X — detach
export async function DELETE(req: NextRequest, { params }: RouteParams) {
  const user = await requirePermission(req, 'products');
  if (!user) return unauthorized();

  const { id } = await params;
  const groupId = Number(new URL(req.url).searchParams.get('groupId'));
  if (!Number.isInteger(groupId)) {
    return badRequest('groupId query parameter is required');
  }

  try {
    await prisma.productOptionGroup.delete({
      where: { productId_groupId: { productId: Number(id), groupId } },
    });
    return NextResponse.json({ success: true });
  } catch (error: any) {
    if (error.code === 'P2025') {
      return notFound('Attachment not found');
    }
    return serverError(error, 'Failed to detach option group');
  }
}
