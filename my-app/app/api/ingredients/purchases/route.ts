import { NextRequest, NextResponse } from 'next/server';
import { requirePermission } from '@/lib/auth';
import { validatePurchase } from '@/lib/ingredient-utils';
import { emitEvent } from '@/lib/socket';
import { recomputeProducts } from '@/lib/availability';
import { productsUsingIngredient } from '@/lib/availability';
import { prisma } from '@/lib/prisma';
import { recordIngredientPurchase } from '@/modules/inventory/repository';
import { notFound, serverError, unauthorized } from '@/lib/api-response';

export async function POST(req: NextRequest) {
  const user = await requirePermission(req, 'inventory');
  if (!user) {
    return unauthorized();
  }

  try {
    const body = await req.json();
    const { ingredientId, quantity, purchaseUnit, purchaseCost, supplierId, notes } = body as {
      ingredientId: number;
      quantity: number;
      purchaseUnit: string;
      purchaseCost: number;
      supplierId?: number | null;
      notes?: string;
    };

    const error = validatePurchase(quantity, purchaseCost, purchaseUnit);
    if (error) {
      return NextResponse.json({ error }, { status: 400 });
    }

    // All ledger writes (stock + cost + supplier-linked transaction) happen in
    // one transaction inside the domain repository (spec 014 / constitution §IV).
    const result = await recordIngredientPurchase(
      {
        ingredientId,
        quantity,
        purchaseUnit,
        purchaseCost,
        supplierId: supplierId ?? null,
        notes: notes ?? null,
        userId: user.userId,
      },
      1,
    );

    const affected = await productsUsingIngredient(prisma, ingredientId);
    await recomputeProducts(prisma, affected);

    emitEvent('ingredients-update', []);
    emitEvent('inventory-update', []);

    return NextResponse.json(result, { status: 201 });
  } catch (error: any) {
    console.error('[INGREDIENT PURCHASE] Error:', error);
    if (error?.message === 'Ingredient not found') {
      return notFound('Ingredient not found');
    }
    return serverError(error, 'Failed to record purchase');
  }
}
