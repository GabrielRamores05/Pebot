import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

// Always live.
export const dynamic = 'force-dynamic';

// GET /api/product-option-groups — every attachment, for building each
// product's DEFAULT selection (first option of each attached group).
export async function GET(req: NextRequest) {
  const attachments = await prisma.productOptionGroup.findMany({
    where: { group: { available: true } },
    select: {
      productId: true,
      groupId: true,
      sortOrder: true,
      group: {
        select: {
          name: true,
          selectionType: true,
          scalesRecipe: true,
          options: {
            where: { available: true },
            orderBy: { sortOrder: 'asc' },
            select: { id: true, name: true, priceDelta: true },
          },
        },
      },
    },
    orderBy: { sortOrder: 'asc' },
  });
  return NextResponse.json(attachments);
}
