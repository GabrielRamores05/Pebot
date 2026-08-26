import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

// Always live.
export const dynamic = 'force-dynamic';

// GET /api/product-option-groups — every attachment with per-product options,
// for building each product's DEFAULT selection (first option of each attached group).
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
        },
      },
    },
    orderBy: { sortOrder: 'asc' },
  });

  // Fetch all available per-product options in one query
  const allOptions = await prisma.productOption.findMany({
    where: { available: true },
    orderBy: { sortOrder: 'asc' },
    select: { id: true, name: true, priceDelta: true, productId: true, groupId: true },
  });

  // Index options by "productId-groupId"
  const optionKey = (pid: number, gid: number) => `${pid}-${gid}`;
  const optionsMap = new Map<string, typeof allOptions>();
  for (const opt of allOptions) {
    const k = optionKey(opt.productId, opt.groupId);
    const arr = optionsMap.get(k) ?? [];
    arr.push(opt);
    optionsMap.set(k, arr);
  }

  return NextResponse.json(
    attachments.map((a) => ({
      productId: a.productId,
      groupId: a.groupId,
      sortOrder: a.sortOrder,
      group: a.group,
      productOptions: (optionsMap.get(optionKey(a.productId, a.groupId)) ?? []).map(
        ({ productId: _, groupId: __, ...rest }) => rest
      ),
    }))
  );
}
