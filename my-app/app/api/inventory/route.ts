import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { emitEvent } from '@/lib/socket';
import { checkFeatureAccess } from '@/lib/auth';
import { recomputeProduct } from '@/lib/availability';

export async function GET(req: NextRequest) {
  // Check if user has access to inventory feature
  const { user, hasAccess } = await checkFeatureAccess(req, 'inventory');
  
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  
  if (!hasAccess) {
    return NextResponse.json({ error: 'Feature not available in your subscription tier' }, { status: 403 });
  }

  try {
    const inventory = await prisma.inventory.findMany({
      include: {
        product: { include: { category: true } },
      },
      orderBy: { product: { name: 'asc' } },
    });
    return NextResponse.json(inventory);
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
}

export async function PATCH(req: NextRequest) {
  // Check if user has access to inventory feature
  const { user, hasAccess } = await checkFeatureAccess(req, 'inventory');
  
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  
  if (!hasAccess) {
    return NextResponse.json({ error: 'Feature not available in your subscription tier' }, { status: 403 });
  }

  try {
    const { productId, quantity, lowStockThreshold, adjustment } = await req.json() as {
      productId: number;
      quantity?: number;
      lowStockThreshold?: number;
      adjustment?: number; // +/- manual adjustment
    };

    // Inventory.quantity is now a *derived cache* of sellable quantity for
    // recipe-based products — it must NOT be set as a stock driver (that was the
    // old "equal distribution / auto-allocation" bug). Only products that have
    // NO required recipe ingredients may keep a manual stock count (e.g. bottled
    // drinks, merch). Everything else is calculated from ingredient stock.
    const hasRecipe = await prisma.productIngredient.count({
      where: { productId, required: true },
    });

    const updateData: Record<string, unknown> = {};
    if (lowStockThreshold !== undefined) updateData.lowStockThreshold = lowStockThreshold;

    if (quantity !== undefined || adjustment !== undefined) {
      if (hasRecipe) {
        return NextResponse.json(
          {
            error:
              'This product derives its stock from a recipe. Adjust ingredient levels instead of setting product stock directly.',
          },
          { status: 403 },
        );
      }
      // Recipe-less product — manual override is allowed and is the stock truth.
      updateData.quantity = adjustment !== undefined ? { increment: adjustment } : quantity;
    }

    const inv = await prisma.inventory.update({
      where: { productId },
      data: updateData,
      include: { product: true },
    });

    // Refresh the derived cache for this product (and recipes sharing its
    // ingredients, if any). No-op for recipe-less products.
    await recomputeProduct(prisma, productId);

    emitEvent('inventory-update', [inv]);
    emitEvent('ingredients-update', []);

    if (inv.quantity <= inv.lowStockThreshold) {
      emitEvent('low-stock-alert', [inv]);
    }

    return NextResponse.json(inv);
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
}
