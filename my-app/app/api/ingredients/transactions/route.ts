import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requirePermission } from '@/lib/auth';
import { serverError, unauthorized } from '@/lib/api-response';

interface TransactionWithIngredient {
  id: number;
  ingredientId: number;
  ingredient: { id: number; name: string; baseUnit: string; category: string; costPerUnit: number };
  type: string;
  quantity: number;
  purchaseCost: number | null;
  unitCost: number | null;
  purchaseUnit: string | null;
  referenceId: number | null;
  referenceType: string | null;
  notes: string | null;
  userId: number | null;
  createdAt: Date;
}

export async function GET(req: NextRequest) {
  const user = await requirePermission(req, 'inventory');
  if (!user) {
    return unauthorized();
  }

  try {
    const { searchParams } = new URL(req.url);
    const ingredientId = searchParams.get('ingredientId');
    const limit = parseInt(searchParams.get('limit') || '100');
    const type = searchParams.get('type');

    const where: Record<string, unknown> = {};

    if (ingredientId) {
      where.ingredientId = parseInt(ingredientId);
    }
    if (type) {
      where.type = type;
    }

    const transactions: TransactionWithIngredient[] = await prisma.ingredientTransaction.findMany({
      where,
      include: {
        ingredient: { select: { id: true, name: true, baseUnit: true, category: true, costPerUnit: true } },
      },
      orderBy: { createdAt: 'desc' },
      take: limit,
    });

    // Non-purchase rows carry no stored cost — estimate them from the
    // ingredient's current average unit cost so the ledger shows a peso
    // value on every line.
    const enriched = transactions.map((t) => {
      let usageCost: number | null = null;
      if (t.type !== 'PURCHASE' && t.purchaseCost == null && t.ingredient?.costPerUnit != null) {
        usageCost = Math.round(Math.abs(t.quantity) * t.ingredient.costPerUnit * 100) / 100;
      }
      return { ...t, usageCost };
    });

    return NextResponse.json(enriched);
  } catch (error) {
    return serverError(error, 'Failed to fetch transactions');
  }
}
