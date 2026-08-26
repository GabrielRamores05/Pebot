import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requirePermission } from '@/lib/auth';

// GET /api/option-groups — all groups with their options (ordered)
export async function GET(req: NextRequest) {
  const user = await requirePermission(req, 'products');
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const groups = await prisma.optionGroup.findMany({
    include: {
      options: { orderBy: { sortOrder: 'asc' } },
      _count: { select: { products: true } },
    },
    orderBy: { sortOrder: 'asc' },
  });
  return NextResponse.json(groups);
}

// POST /api/option-groups — create a group (optionally with options)
export async function POST(req: NextRequest) {
  const user = await requirePermission(req, 'products');
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  try {
    const body = await req.json();
    const { name, selectionType, scalesRecipe, sortOrder, available, options } = body as {
      name: string;
      selectionType?: 'single' | 'multi';
      scalesRecipe?: boolean;
      sortOrder?: number;
      available?: boolean;
      options?: { name: string; priceDelta?: number; sizeMultiplier?: number; sortOrder?: number }[];
    };

    if (!name?.trim()) {
      return NextResponse.json({ error: 'Group name is required' }, { status: 400 });
    }

    const group = await prisma.optionGroup.create({
      data: {
        name: name.trim(),
        selectionType: selectionType === 'multi' ? 'multi' : 'single',
        scalesRecipe: !!scalesRecipe,
        sortOrder: sortOrder ?? 0,
        available: available ?? true,
        ...(Array.isArray(options) && options.length > 0 && {
          options: {
            create: options.map((o, i) => ({
              name: o.name,
              priceDelta: o.priceDelta ?? 0,
              sizeMultiplier: o.sizeMultiplier ?? 1,
              sortOrder: o.sortOrder ?? i + 1,
            })),
          },
        }),
      },
      include: { options: { orderBy: { sortOrder: 'asc' } } },
    });

    return NextResponse.json(group, { status: 201 });
  } catch (error: any) {
    if (error.code === 'P2002') {
      return NextResponse.json({ error: 'A group with this name already exists' }, { status: 409 });
    }
    console.error('[OPTION-GROUPS] create failed:', error);
    return NextResponse.json({ error: 'Failed to create option group' }, { status: 500 });
  }
}
