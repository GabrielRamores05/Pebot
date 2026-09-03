import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { emitEvent } from '@/lib/socket';
import { productsUsingIngredient, recomputeProducts } from '@/lib/availability';
import { notFound, serverError, unauthorized } from '@/lib/api-response';
import { requirePermission } from '@/lib/auth';

interface RouteParams {
  params: Promise<{ id: string }>;
}

// GET /api/ingredients/[id] - Get single ingredient
export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    const { id } = await params;
    const ingredient = await prisma.ingredient.findUnique({
      where: { id: parseInt(id) },
    });

    if (!ingredient) {
      return notFound('Ingredient not found');
    }

    return NextResponse.json(ingredient);
  } catch (error) {
    return serverError(error, 'Failed to fetch ingredient');
  }
}

// PUT /api/ingredients/[id] - Update ingredient
export async function PUT(request: NextRequest, { params }: RouteParams) {
  const user = await requirePermission(request, 'inventory');
  if (!user) return unauthorized();

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

    // stock/cost/threshold changed — recompute derived sellable quantities,
    // the derived capital cost (costPerUnit drives product capital), and let
    // every surface (ingredient page, alerts, analytics inventory summary)
    // refresh: spec 014 US5 keeps low/high state consistent everywhere.
    if (currentStock !== undefined || costPerUnit !== undefined || minStock !== undefined) {
      const affected = await productsUsingIngredient(prisma, parseInt(id));
      await recomputeProducts(prisma, affected);
      emitEvent('ingredients-update', []);
      emitEvent('inventory-update', []);
    }

    return NextResponse.json(ingredient);
  } catch (error) {
    return serverError(error, 'Failed to update ingredient');
  }
}

// DELETE /api/ingredients/[id] - Delete ingredient
export async function DELETE(request: NextRequest, { params }: RouteParams) {
  const user = await requirePermission(request, 'inventory');
  if (!user) return unauthorized();

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
    return serverError(error, 'Failed to delete ingredient');
  }
}
