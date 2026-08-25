import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { emitEvent } from '@/lib/socket';
import { recomputeProduct } from '@/lib/availability';

interface RouteParams {
  params: Promise<{ productId: string }>;
}

// GET /api/ingredients/product/[productId] - Get all ingredients for a product
export async function GET(request: Request, { params }: RouteParams) {
  try {
    const { productId } = await params;
    
    const productIngredients = await prisma.productIngredient.findMany({
      where: { productId: parseInt(productId) },
      include: {
        ingredient: true,
      },
    });

    return NextResponse.json(productIngredients);
  } catch (error) {
    console.error('Error fetching product ingredients:', error);
    return NextResponse.json({ error: 'Failed to fetch product ingredients' }, { status: 500 });
  }
}

// PUT /api/ingredients/product/[productId] - Update ingredients for a product
export async function PUT(request: Request, { params }: RouteParams) {
  try {
    const { productId } = await params;
    const body = await request.json();
    const { ingredients } = body; // Array of { ingredientId, quantity, required }

    // Delete existing product ingredients
    await prisma.productIngredient.deleteMany({
      where: { productId: parseInt(productId) },
    });

    // Create new product ingredients
    if (ingredients && ingredients.length > 0) {
      await prisma.productIngredient.createMany({
        data: ingredients.map((ing: { ingredientId: number; quantity: number; required?: boolean }) => ({
          productId: parseInt(productId),
          ingredientId: ing.ingredientId,
          quantity: ing.quantity,
          required: ing.required ?? true,
        })),
      });
    }

    // Recalculate derived sellable quantities for this product
    await recomputeProduct(prisma, parseInt(productId));

    // Return updated product ingredients
    const productIngredients = await prisma.productIngredient.findMany({
      where: { productId: parseInt(productId) },
      include: {
        ingredient: true,
      },
    });

    emitEvent('ingredients-update', []);
    emitEvent('inventory-update', [{ productId: parseInt(productId) }]);

    return NextResponse.json(productIngredients);
  } catch (error) {
    console.error('Error updating product ingredients:', error);
    return NextResponse.json({ error: 'Failed to update product ingredients' }, { status: 500 });
  }
}
