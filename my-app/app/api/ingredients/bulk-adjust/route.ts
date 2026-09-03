import { NextRequest, NextResponse } from 'next/server';
import { requirePermission } from '@/lib/auth';
import { emitEvent } from '@/lib/socket';
import { badRequest, serverError, unauthorized } from '@/lib/api-response';
import { bulkAdjustStock } from '@/modules/inventory/service';
import { ValidationError } from 'zod-validation-error';

// POST /api/ingredients/bulk-adjust — one batch of stock corrections (spec 014
// US4). Rows are validated as a whole (any below-zero row rejects the entire
// batch — nothing is written) and saved in one transaction; each changed
// ingredient gets an ADJUSTMENT row sharing the batch token.
export async function POST(req: NextRequest) {
  const user = await requirePermission(req, 'inventory');
  if (!user) {
    return unauthorized();
  }

  try {
    const body = await req.json();
    const result = await bulkAdjustStock(body, { userId: user.userId });

    emitEvent('ingredients-update', []);
    emitEvent('inventory-update', []);

    return NextResponse.json(result, { status: 200 });
  } catch (error: any) {
    console.error('[INGREDIENT BULK ADJUST] Error:', error);
    if (error instanceof ValidationError) {
      return badRequest(error.message);
    }
    if (typeof error?.message === 'string' && error.message.includes('would drop below zero')) {
      return badRequest(error.message);
    }
    if (error?.message === 'Ingredient not found' || error?.message?.startsWith('Ingredient #')) {
      return badRequest(error.message);
    }
    return serverError(error, 'Failed to bulk adjust stock');
  }
}
