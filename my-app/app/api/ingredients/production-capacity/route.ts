import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requirePermission } from '@/lib/auth';
import { calcProductionCapacity } from '@/lib/availability';

export async function GET(req: NextRequest) {
  const user = await requirePermission(req, 'inventory');
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const productParam = req.nextUrl.searchParams.get('productId');
    const entries = await calcProductionCapacity(prisma);
    if (productParam) {
      const pid = parseInt(productParam, 10);
      const filtered = entries.filter((e) => e.productId === pid);
      return NextResponse.json(filtered);
    }
    return NextResponse.json(entries);
  } catch (error) {
    console.error('[PRODUCTION CAPACITY] Error:', error);
    return NextResponse.json({ error: 'Failed to compute production capacity' }, { status: 500 });
  }
}
