import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requirePermission } from '@/lib/auth';

interface RouteParams {
  params: Promise<{ id: string }>;
}

// PUT /api/option-groups/:id — update group fields
export async function PUT(req: NextRequest, { params }: RouteParams) {
  const user = await requirePermission(req, 'products');
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { id } = await params;
  try {
    const body = await req.json();
    const { name, selectionType, sortOrder, available } = body as {
      name?: string;
      selectionType?: 'single' | 'multi';
      sortOrder?: number;
      available?: boolean;
    };

    const group = await prisma.optionGroup.update({
      where: { id: Number(id) },
      data: {
        ...(name !== undefined && { name: name.trim() }),
        ...(selectionType !== undefined && { selectionType }),
        ...(sortOrder !== undefined && { sortOrder }),
        ...(available !== undefined && { available }),
      },
    });
    return NextResponse.json(group);
  } catch (error: any) {
    if (error.code === 'P2002') {
      return NextResponse.json({ error: 'A group with this name already exists' }, { status: 409 });
    }
    if (error.code === 'P2025') {
      return NextResponse.json({ error: 'Option group not found' }, { status: 404 });
    }
    return NextResponse.json({ error: 'Failed to update option group' }, { status: 500 });
  }
}

// DELETE /api/option-groups/:id — deletes the group, its product options and
// all product attachments (cascades). Orders keep their stored selections JSON.
export async function DELETE(req: NextRequest, { params }: RouteParams) {
  const user = await requirePermission(req, 'products');
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { id } = await params;
  try {
    await prisma.optionGroup.delete({ where: { id: Number(id) } });
    return NextResponse.json({ success: true });
  } catch (error: any) {
    if (error.code === 'P2025') {
      return NextResponse.json({ error: 'Option group not found' }, { status: 404 });
    }
    return NextResponse.json({ error: 'Failed to delete option group' }, { status: 500 });
  }
}
