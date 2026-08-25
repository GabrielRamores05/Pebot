import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requirePermission } from '@/lib/auth';
import { convertToBase, calcPricePerUnit, calcWeightedAverage, validatePurchase, formatPeso } from '@/lib/ingredient-utils';
import { emitEvent } from '@/lib/socket';
import { productsUsingIngredient, recomputeProducts } from '@/lib/availability';

export async function POST(req: NextRequest) {
  const user = await requirePermission(req, 'inventory');
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const body = await req.json();
    const { ingredientId, quantity, purchaseUnit, purchaseCost, supplierId, purchaseDate, notes } = body as {
      ingredientId: number;
      quantity: number;
      purchaseUnit: string;
      purchaseCost: number;
      supplierId?: number | null;
      purchaseDate?: string;
      notes?: string;
    };

    // Validate inputs
    const error = validatePurchase(quantity, purchaseCost, purchaseUnit);
    if (error) {
      return NextResponse.json({ error }, { status: 400 });
    }

    const result = await prisma.$transaction(async (tx) => {
      // Fetch ingredient with current stock and cost
      const ingredient = await tx.ingredient.findUnique({
        where: { id: ingredientId },
        include: { supplier: true },
      });

      if (!ingredient) {
        throw new Error('Ingredient not found');
      }

      // Convert purchase quantity to base units
      const quantityInBase = convertToBase(quantity, purchaseUnit);
      if (quantityInBase <= 0) {
        throw new Error('Converted quantity must be greater than 0');
      }

      // Calculate unit cost per purchase unit
      const pricePerUnit = calcPricePerUnit(purchaseCost, quantity, purchaseUnit);

      // Calculate weighted average cost per base unit
      const newCostPerUnit = calcWeightedAverage(
        ingredient.costPerUnit,
        ingredient.currentStock,
        purchaseCost,
        quantityInBase,
      );

      // Calculate new stock
      const newStock = ingredient.currentStock + quantityInBase;

      // Create transaction record
      const transaction = await tx.ingredientTransaction.create({
        data: {
          ingredientId: ingredient.id,
          type: 'PURCHASE',
          quantity: quantityInBase,
          purchaseCost,
          unitCost: pricePerUnit ?? 0,
          purchaseUnit,
          referenceId: null,
          referenceType: null,
          notes: notes || null,
          userId: user.userId,
        },
      });

      // Update ingredient: stock increase + weighted average cost
      const updated = await tx.ingredient.update({
        where: { id: ingredient.id },
        data: {
          currentStock: newStock,
          costPerUnit: newCostPerUnit,
          ...(supplierId !== undefined ? { supplierId: supplierId || undefined } : {}),
        },
      });

      return {
        ingredient: updated,
        transaction,
        pricePerUnit,
        newStock,
        newWeightedCost: newCostPerUnit,
      };
    });

    // Recalculate derived sellable quantities for every product using this ingredient
    const affected = await productsUsingIngredient(prisma, ingredientId);
    await recomputeProducts(prisma, affected);

    emitEvent('ingredients-update', []);
    emitEvent('inventory-update', []);

    return NextResponse.json(result, { status: 201 });
  } catch (error: any) {
    console.error('[INGREDIENT PURCHASE] Error:', error);
    if (error.message === 'Ingredient not found') {
      return NextResponse.json({ error: 'Ingredient not found' }, { status: 404 });
    }
    return NextResponse.json({ error: 'Failed to record purchase' }, { status: 500 });
  }
}
