import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requirePermission } from '@/lib/auth';
import { badRequest, conflict, serverError, unauthorized } from '@/lib/api-response';

// GET /api/option-groups — all groups with product counts (ordered)
export async function GET(req: NextRequest) {
  const user = await requirePermission(req, 'products');
  if (!user) return unauthorized();

  const groups = await prisma.optionGroup.findMany({
    include: {
      _count: { select: { products: true, productOptions: true } },
    },
    orderBy: { sortOrder: 'asc' },
  });
  return NextResponse.json(groups);
}

// POST /api/option-groups — create a group
export async function POST(req: NextRequest) {
  const user = await requirePermission(req, 'products');
  if (!user) return unauthorized();

  try {
    const body = await req.json();
    const { name, selectionType, sortOrder, available } = body as {
      name: string;
      selectionType?: 'single' | 'multi';
      sortOrder?: number;
      available?: boolean;
    };

    if (!name?.trim()) {
      return badRequest('Group name is required');
    }

    const group = await prisma.optionGroup.create({
      data: {
        name: name.trim(),
        selectionType: selectionType === 'multi' ? 'multi' : 'single',
        sortOrder: sortOrder ?? 0,
        available: available ?? true,
      },
    });

    return NextResponse.json(group, { status: 201 });
  } catch (error: any) {
    if (error.code === 'P2002') {
      return conflict('A group with this name already exists');
    }
    return serverError(error, 'Failed to create option group');
  }
}
