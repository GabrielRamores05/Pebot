import { NextRequest, NextResponse } from 'next/server';
import { requirePermission } from '@/lib/auth';
import { serverError, unauthorized } from '@/lib/api-response';
import { getIngredientPurchaseHistory, IngredientNotFoundError } from '@/modules/inventory/service';
import { notFound } from '@/lib/api-response';

interface RouteParams {
  params: Promise<{ id: string }>;
}

// GET /api/ingredients/:id/purchases — purchase history detail for one
// ingredient (spec 014 US2): newest first, each row with supplier, date,
// entered + base quantity, total, unit cost and the ₱/% change vs the previous
// non-void purchase of that ingredient.
export async function GET(_req: NextRequest, { params }: RouteParams) {
  const user = await requirePermission(_req, 'inventory');
  if (!user) {
    return unauthorized();
  }

  try {
    const { id } = await params;
    const ingredientId = parseInt(id);
    if (isNaN(ingredientId)) {
      return notFound('Invalid ingredient ID');
    }

    const data = await getIngredientPurchaseHistory(ingredientId);
    return NextResponse.json(data);
  } catch (error: any) {
    console.error('[INGREDIENT PURCHASE HISTORY] Error:', error);
    if (error instanceof IngredientNotFoundError) {
      return notFound(error.message);
    }
    return serverError(error, 'Failed to load purchase history');
  }
}
