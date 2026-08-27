import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

// GET /api/menu/best-sellers - public endpoint returning top-selling product IDs
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const limit = parseInt(searchParams.get('limit') || '5');

    const result = await prisma.$queryRaw<
      Array<{ productId: number; count: number }>
    >`
      SELECT oi."productId" as "productId", SUM(oi.quantity) as "count"
      FROM "Order" o
      JOIN "OrderItem" oi ON oi."orderId" = o.id
      WHERE o.status != 'CANCELLED'
      GROUP BY oi."productId"
      ORDER BY "count" DESC
      LIMIT ${limit}
    `;

    const productIds = result.map((r) => Number(r.productId));

    return NextResponse.json({ bestSellers: productIds });
  } catch (error) {
    console.error('Error fetching best sellers:', error);
    return NextResponse.json({ error: 'Failed to fetch best sellers' }, { status: 500 });
  }
}
