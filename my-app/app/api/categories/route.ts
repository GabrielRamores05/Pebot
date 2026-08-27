import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { badRequest, serverError } from '@/lib/api-response';

export async function GET() {
  try {
    const categories = await prisma.category.findMany({
      orderBy: { sortOrder: 'asc' },
      include: {
        products: {
          where: { available: true },
          orderBy: { name: 'asc' },
          include: { inventory: true },
        },
      },
    });
    return NextResponse.json(categories);
  } catch (e) {
    return serverError(e, 'Failed to fetch categories');
  }
}

export async function POST(req: NextRequest) {
  try {
    const { name, icon, sortOrder } = await req.json() as { name: string; icon?: string; sortOrder?: number };
    const trimmedName = name?.trim();
    if (!trimmedName) {
      return badRequest('Name is required');
    }

    // Optional: you could also enforce uniqueness by name here, but Prisma will
    // already enforce unique constraint if defined in schema.
    const category = await prisma.category.create({
      data: { name: trimmedName, icon: icon?.trim() || null, sortOrder: sortOrder ?? 0 },
    });
    return NextResponse.json(category, { status: 201 });
  } catch (e) {
    console.error(e);

    const msg = String(e);
    // Prisma unique constraint error (e.g. duplicate category name)
    if (msg.includes('P2002') || msg.toLowerCase().includes('unique constraint')) {
      return NextResponse.json(
        { error: 'A category with this name already exists. Please choose a different name.' },
        { status: 400 },
      );
    }

    return serverError(e, 'Failed to create category');
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const { id, name, icon, sortOrder } = await req.json() as { id: number; name?: string; icon?: string; sortOrder?: number };
    const data: Record<string, unknown> = {};
    if (name !== undefined) data.name = name.trim();
    if (icon !== undefined) data.icon = icon.trim() || null;
    if (sortOrder !== undefined) data.sortOrder = sortOrder;
    const category = await prisma.category.update({ where: { id }, data });
    return NextResponse.json(category);
  } catch (e) {
    return serverError(e, 'Failed to update category');
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const body = await req.json();
    const id = parseInt(body.id);
    
    if (!id || isNaN(id)) {
      return badRequest('Invalid category ID provided');
    }
    
    // Check if category exists
    const existingCategory = await prisma.category.findUnique({ where: { id } });
    if (!existingCategory) {
      return NextResponse.json({ error: `Category with ID ${id} not found` }, { status: 404 });
    }
    
    const count = await prisma.product.count({ where: { categoryId: id } });
    if (count > 0) {
      return NextResponse.json({ error: `Cannot delete category with ${count} product(s). Remove products first.` }, { status: 400 });
    }
    
    const category = await prisma.category.delete({ where: { id } });
    console.log(`[DELETE CATEGORY] Successfully deleted category ${id}: ${category.name}`);
    return NextResponse.json({ ok: true, category });
  } catch (e) {
    console.error('[DELETE CATEGORY ERROR]', e);
    const message = e instanceof Error ? e.message : 'Unknown error';
    return NextResponse.json({ error: `Failed to delete category: ${message}` }, { status: 500 });
  }
}
