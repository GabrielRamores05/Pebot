import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requirePermission } from '@/lib/auth';
import { badRequest, notFound, serverError, unauthorized } from '@/lib/api-response';

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
  if (!user) return unauthorized();

  const { id } = await params;
  try {
    const body = await req.json();
    const rawIngredientId = Number(body?.ingredientId);
    const rawDeltaQty = body?.deltaQty;

    if (!Number.isInteger(rawIngredientId) || rawIngredientId <= 0) {
      return badRequest('ingredientId is required');
    }
    if (typeof rawDeltaQty !== 'number') {
      return badRequest('deltaQty is required (number in g/ml)');
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
      return notFound('Option or ingredient not found');
    }
    return serverError(error, 'Failed to save ingredient delta');
  }
}

// DELETE /api/product-options/:id/ingredients?ingredientId=X — remove a delta
export async function DELETE(req: NextRequest, { params }: RouteParams) {
  const user = await requirePermission(req, 'products');
  if (!user) return unauthorized();

  const { id } = await params;
  const ingredientId = Number(new URL(req.url).searchParams.get('ingredientId'));
  if (!Number.isInteger(ingredientId)) {
    return badRequest('ingredientId query parameter is required');
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
      return notFound('Delta not found');
    }
    return serverError(error, 'Failed to delete ingredient delta');
  }
}
