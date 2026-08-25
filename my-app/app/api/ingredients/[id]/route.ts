import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { emitEvent } from '@/lib/socket';
import { productsUsingIngredient, recomputeProducts } from '@/lib/availability';

interface RouteParams {
  params: Promise<{ id: string }>;
}

// GET /api/ingredients/[id] - Get single ingredient
export async function GET(request: Request, { params }: RouteParams) {
  try {
    const { id } = await params;
    const ingredient = await prisma.ingredient.findUnique({
      where: { id: parseInt(id) },
    });

    if (!ingredient) {
      return NextResponse.json({ error: 'Ingredient not found' }, { status: 404 });
    }

    return NextResponse.json(ingredient);
  } catch (error) {
    console.error('Error fetching ingredient:', error);
    return NextResponse.json({ error: 'Failed to fetch ingredient' }, { status: 500 });
  }
}

// PUT /api/ingredients/[id] - Update ingredient
export async function PUT(request: Request, { params }: RouteParams) {
  try {
    const { id } = await params;
    const body = await request.json();
    const { name, category, baseUnit, purchaseUnit, currentStock, minStock, costPerUnit, supplierId, supplier } = body;

    const resolvedSupplierId = supplierId
      ? parseInt(String(supplierId))
      : supplier && typeof supplier === 'string' && !isNaN(parseInt(supplier))
        ? parseInt(supplier)
        : supplier && typeof supplier === 'object' && 'id' in supplier
          ? (supplier as any).id
          : undefined;

    const ingredient = await prisma.ingredient.update({
      where: { id: parseInt(id) },
      data: {
        name,
        ...(category !== undefined ? { category } : {}),
        ...(purchaseUnit !== undefined ? { purchaseUnit } : {}),
        baseUnit,
        currentStock,
        minStock,
        costPerUnit,
        ...(resolvedSupplierId !== undefined ? { supplierId: resolvedSupplierId } : {}),
      },
    });

    // currentStock changed (manual edit) — recompute derived sellable quantities
    if (currentStock !== undefined) {
      const affected = await productsUsingIngredient(prisma, parseInt(id));
      await recomputeProducts(prisma, affected);
      emitEvent('ingredients-update', []);
      emitEvent('inventory-update', []);
    }

    return NextResponse.json(ingredient);
  } catch (error) {
    console.error('Error updating ingredient:', error);
    return NextResponse.json({ error: 'Failed to update ingredient' }, { status: 500 });
  }
}

// DELETE /api/ingredients/[id] - Delete ingredient
export async function DELETE(request: Request, { params }: RouteParams) {
  try {
    const { id } = await params;
    
    // First remove all product associations
    await prisma.productIngredient.deleteMany({
      where: { ingredientId: parseInt(id) },
    });

    await prisma.ingredient.delete({
      where: { id: parseInt(id) },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error deleting ingredient:', error);
    return NextResponse.json({ error: 'Failed to delete ingredient' }, { status: 500 });
  }
}
