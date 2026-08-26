import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requirePermission } from '@/lib/auth';

interface RouteParams {
  params: Promise<{ id: string }>;
}

// GET /api/product-options/:id/ingredients — list ingredient deltas for an option
export async function GET(req: NextRequest, { params }: RouteParams) {
  const { id } = await params;
  const deltas = await prisma.productOptionIngredient.findMany({
    where: { productOptionId: Number(id) },
    include: { ingredient: { select: { id: true, name: true, baseUnit: true } } },
  });
  return NextResponse.json(deltas);
}

// POST /api/product-options/:id/ingredients — upsert an ingredient delta
// Body: { ingredientId: number, deltaQty: number }
export async function POST(req: NextRequest, { params }: RouteParams) {
  const user = await requirePermission(req, 'products');
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { id } = await params;
  try {
    const body = await req.json();
    const rawIngredientId = Number(body?.ingredientId);
    const rawDeltaQty = body?.deltaQty;

    if (!Number.isInteger(rawIngredientId) || rawIngredientId <= 0) {
      return NextResponse.json({ error: 'ingredientId is required' }, { status: 400 });
    }
    if (typeof rawDeltaQty !== 'number') {
      return NextResponse.json({ error: 'deltaQty is required (number in g/ml)' }, { status: 400 });
    }
    const ingredientId = rawIngredientId;
    const deltaQty = rawDeltaQty;

    // If deltaQty is 0, delete the row instead of creating it
    if (deltaQty === 0) {
      await prisma.productOptionIngredient.deleteMany({
        where: { productOptionId: Number(id), ingredientId },
      });
      return NextResponse.json({ deleted: true });
    }

    const delta = await prisma.productOptionIngredient.upsert({
      where: {
        productOptionId_ingredientId: {
          productOptionId: Number(id),
          ingredientId,
        },
      },
      update: { deltaQty },
      create: {
        productOptionId: Number(id),
        ingredientId,
        deltaQty,
      },
    });
    return NextResponse.json(delta, { status: 201 });
  } catch (error: any) {
    if (error.code === 'P2003') {
      return NextResponse.json({ error: 'Option or ingredient not found' }, { status: 404 });
    }
    return NextResponse.json({ error: 'Failed to save ingredient delta' }, { status: 500 });
  }
}

// DELETE /api/product-options/:id/ingredients?ingredientId=X — remove a delta
export async function DELETE(req: NextRequest, { params }: RouteParams) {
  const user = await requirePermission(req, 'products');
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { id } = await params;
  const ingredientId = Number(new URL(req.url).searchParams.get('ingredientId'));
  if (!Number.isInteger(ingredientId)) {
    return NextResponse.json({ error: 'ingredientId query parameter is required' }, { status: 400 });
  }

  try {
    await prisma.productOptionIngredient.delete({
      where: {
        productOptionId_ingredientId: {
          productOptionId: Number(id),
          ingredientId,
        },
      },
    });
    return NextResponse.json({ success: true });
  } catch (error: any) {
    if (error.code === 'P2025') {
      return NextResponse.json({ error: 'Delta not found' }, { status: 404 });
    }
    return NextResponse.json({ error: 'Failed to delete ingredient delta' }, { status: 500 });
  }
}
