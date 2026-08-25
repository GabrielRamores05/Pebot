import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requirePermission } from '@/lib/auth';

interface TransactionWithIngredient {
  id: number;
  ingredientId: number;
  ingredient: { id: number; name: string; baseUnit: string; category: string };
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
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
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
        ingredient: { select: { id: true, name: true, baseUnit: true, category: true } },
      },
      orderBy: { createdAt: 'desc' },
      take: limit,
    });

    return NextResponse.json(transactions);
  } catch (error) {
    console.error('[INGREDIENT TRANSACTIONS] Error:', error);
    return NextResponse.json({ error: 'Failed to fetch transactions' }, { status: 500 });
  }
}
