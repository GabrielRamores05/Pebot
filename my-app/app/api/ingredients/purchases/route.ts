import { NextRequest, NextResponse } from 'next/server';
import { requirePermission } from '@/lib/auth';
import { emitEvent } from '@/lib/socket';
import { recomputeProducts, productsUsingIngredient } from '@/lib/availability';
import { prisma } from '@/lib/prisma';
import { recordPurchase } from '@/modules/inventory/service';
import { badRequest, notFound, serverError, unauthorized } from '@/lib/api-response';
import { ValidationError } from 'zod-validation-error';

export async function POST(req: NextRequest) {
  const user = await requirePermission(req, 'inventory');
  if (!user) {
    return unauthorized();
  }

  try {
    const body = await req.json();

    // All ledger writes (stock + cost + supplier-linked transaction) happen in
    // one transaction inside the domain repository; the service validates with
    // zod and writes the audit event (spec 014 / constitution §III/§IV).
    const result = await recordPurchase(body, { userId: user.userId });

    const ingredientId = result.ingredient.id;
    const affected = await productsUsingIngredient(prisma, ingredientId);
    await recomputeProducts(prisma, affected);

    emitEvent('ingredients-update', []);
    emitEvent('inventory-update', []);

    return NextResponse.json(result, { status: 201 });
  } catch (error: any) {
    console.error('[INGREDIENT PURCHASE] Error:', error);
    if (error instanceof ValidationError) {
      return badRequest(error.message);
    }
    if (error?.message === 'Ingredient not found') {
      return notFound('Ingredient not found');
    }
    if (
      typeof error?.message === 'string' &&
      (error.message.startsWith('Cannot record') ||
        error.message.startsWith('Converted quantity') ||
        error.message.startsWith('Quantity must') ||
        error.message.startsWith('Purchase cost must'))
    ) {
      return badRequest(error.message);
    }
    return serverError(error, 'Failed to record purchase');
  }
}
