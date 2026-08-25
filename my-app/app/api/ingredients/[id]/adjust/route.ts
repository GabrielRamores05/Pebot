import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requirePermission } from '@/lib/auth';
import { validateAdjustment } from '@/lib/ingredient-utils';
import { emitEvent } from '@/lib/socket';
import { productsUsingIngredient, recomputeProducts } from '@/lib/availability';

interface RouteParams {
  params: Promise<{ id: string }>;
}

export async function POST(req: NextRequest, { params }: RouteParams) {
  const user = await requirePermission(req, 'inventory');
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const { id } = await params;
    const ingredientId = parseInt(id);
    if (isNaN(ingredientId)) {
      return NextResponse.json({ error: 'Invalid ingredient ID' }, { status: 400 });
    }

    const body = await req.json();
    const { quantity, reason, notes } = body as {
      quantity: number; // signed: negative for waste, positive for correction
      reason?: 'WASTE' | 'SPOILAGE' | 'DAMAGED' | 'CORRECTION' | '';
      notes?: string;
    };

    const result = await prisma.$transaction(async (tx) => {
      const ingredient = await tx.ingredient.findUnique({
        where: { id: ingredientId },
      });

      if (!ingredient) {
        throw new Error('Ingredient not found');
      }

      // Validate: prevents negative stock
      const error = validateAdjustment(quantity, ingredient.currentStock, reason || '');
      if (error) {
        throw new Error(error);
      }

      const newStock = ingredient.currentStock + quantity;

      // Create adjustment transaction
      const transaction = await tx.ingredientTransaction.create({
        data: {
          ingredientId: ingredient.id,
          type: 'ADJUSTMENT',
          quantity, // signed value
          purchaseCost: null,
          unitCost: ingredient.costPerUnit,
          purchaseUnit: ingredient.baseUnit,
          notes: notes
            ? `${reason || 'ADJUSTMENT'}: ${notes}`
            : `${reason || 'ADJUSTMENT'}`,
          userId: user.userId,
        },
      });

      // Update ingredient stock
      const updated = await tx.ingredient.update({
        where: { id: ingredient.id },
        data: { currentStock: newStock },
      });

      // Recalculate derived sellable quantities for every product using this ingredient
      const affected = await productsUsingIngredient(tx, ingredient.id);
      await recomputeProducts(tx, affected);

      return { ingredient: updated, transaction };
    });

    emitEvent('ingredients-update', []);
    emitEvent('inventory-update', []);

    return NextResponse.json(result);
  } catch (error: any) {
    console.error('[INGREDIENT ADJUST] Error:', error);
    if (error.message === 'Ingredient not found') {
      return NextResponse.json({ error: 'Ingredient not found' }, { status: 404 });
    }
    if (error.message.includes('Insufficient stock') || error.message.includes('cannot be zero') || error.message.includes('Invalid reason')) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }
    return NextResponse.json({ error: 'Failed to adjust ingredient' }, { status: 500 });
  }
}
