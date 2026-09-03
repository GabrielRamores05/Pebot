import { NextRequest, NextResponse } from 'next/server';
import { requirePermission } from '@/lib/auth';
import { emitEvent } from '@/lib/socket';
import { productsUsingIngredient, recomputeProducts } from '@/lib/availability';
import { prisma } from '@/lib/prisma';
import { voidIngredientPurchase } from '@/modules/inventory/service';
import { badRequest, notFound, serverError, unauthorized } from '@/lib/api-response';
import { ValidationError } from 'zod-validation-error';

interface RouteParams {
  params: Promise<{ id: string }>;
}

// POST /api/ingredients/purchases/:id/void — additive void + re-enter support
// (spec 014 FR-009). Admin permission required; the original purchase row is
// never modified. The service appends the compensating VOID_PURCHASE row in
// the same transaction and writes the audit event.
export async function POST(req: NextRequest, { params }: RouteParams) {
  const user = await requirePermission(req, 'inventory');
  if (!user) {
    return unauthorized();
  }

  try {
    const { id } = await params;
    const transactionId = parseInt(id);
    if (isNaN(transactionId)) {
      return badRequest('Invalid transaction ID');
    }

    const result = await voidIngredientPurchase({ transactionId }, { userId: user.userId });

    const affected = await productsUsingIngredient(prisma, result.ingredient.id);
    await recomputeProducts(prisma, affected);

    emitEvent('ingredients-update', []);
    emitEvent('inventory-update', []);

    return NextResponse.json(result, { status: 200 });
  } catch (error: any) {
    console.error('[INGREDIENT PURCHASE VOID] Error:', error);
    if (error instanceof ValidationError) {
      return badRequest(error.message);
    }
    if (error?.message === 'Purchase not found') {
      return notFound('Purchase not found');
    }
    return serverError(error, 'Failed to void purchase');
  }
}
