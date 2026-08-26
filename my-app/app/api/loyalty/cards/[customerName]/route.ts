import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { normalizeMemberName } from '@/lib/loyalty-utils';
import { logAction } from '@/lib/audit-log';

// GET /api/loyalty/cards/:customerName
export async function GET(req: NextRequest, { params }: { params: Promise<{ customerName: string }> | { customerName: string } }) {
  try {
    const resolvedParams = await Promise.resolve(params);
    const { customerName } = resolvedParams as { customerName: string };
    const normalizedCustomerName = normalizeMemberName(customerName);
    const categoryId = req.nextUrl.searchParams.get('categoryId');

    if (categoryId) {
      const targetId = parseInt(categoryId);
      const existingCards = await prisma.loyaltyCard.findMany({
        where: { categoryId: targetId },
        include: { vouchers: { where: { status: 'ACTIVE' } }, category: true },
      });
      let card = existingCards.find(c => normalizeMemberName(c.customerName) === normalizedCustomerName) || null;

      if (!card) {
        card = await prisma.loyaltyCard.create({
          data: { customerName: normalizedCustomerName, categoryId: targetId },
          include: { vouchers: { where: { status: 'ACTIVE' } }, category: true },
        });
      }

      const settings = await prisma.loyaltySetting.findUnique({
        where: { categoryId: targetId }
      });

      return NextResponse.json(formatCard(card, settings));
    }

    // Return all cards for this customer
    const cards = await prisma.loyaltyCard.findMany({
      include: { vouchers: { where: { status: 'ACTIVE' } }, category: true },
    });
    const matchingCards = cards.filter(c => normalizeMemberName(c.customerName) === normalizedCustomerName);

    const allSettings = await prisma.loyaltySetting.findMany();

    return NextResponse.json(matchingCards.map(c => {
      const s = allSettings.find(s => s.categoryId === c.categoryId);
      return formatCard(c, s);
    }));

  } catch (e) {
    console.error('[LOYALTY] Error fetching cards:', e);
    return NextResponse.json({ error: 'Failed to fetch loyalty cards' }, { status: 500 });
  }
}

function formatCard(card: any, settings: any) {
  const isMilestoneMode = settings?.isMilestoneMode || false;
  const milestones = JSON.parse(settings?.milestones || '[]') as {target: number, rewardType: string, rewardValue: number}[];

  let coffeesRequired = settings?.coffeesRequiredForFree || 10;
  if (isMilestoneMode && milestones.length > 0) {
    coffeesRequired = Math.max(...milestones.map(m => m.target));
  }

    const progress = Math.min(card.paidCoffeesCount, coffeesRequired);
  const coffeesUntilFree = Math.max(0, coffeesRequired - progress);

  return {
    id: card.id,
    customerName: card.customerName,
    categoryId: card.categoryId,
    categoryName: card.category?.name || 'Global',
    paidCoffeesCount: card.paidCoffeesCount,
    loyaltyPoints: card.loyaltyPoints ?? 0,
    progress: progress,
    coffeesUntilFree: coffeesUntilFree,
    coffeesRequiredForFree: coffeesRequired,
    hasUnclaimedVoucher: card.vouchers?.length > 0,
    activeVouchers: card.vouchers || [],
    activeVoucherCount: card.vouchers?.length || 0,
    isMilestoneMode,
    milestones,
    claimedMilestones: JSON.parse(card.claimedMilestones || '[]'),
    message: coffeesUntilFree === 0
      ? 'Reward earned!'
      : `${coffeesUntilFree} more until reward`,
  };
}

// POST /api/loyalty/cards/:customerName/add-coffees
export async function POST(req: NextRequest, { params }: { params: Promise<{ customerName: string }> | { customerName: string } }) {
  try {
    const resolvedParams = await Promise.resolve(params);
    const { customerName } = resolvedParams as { customerName: string };
    const normalizedCustomerName = normalizeMemberName(customerName);
    const body = await req.json();
    const { quantity = 1, categoryId } = body;

    const targetCategoryId = categoryId ? parseInt(categoryId) : null;

    // A global card has no category. categoryId is a nullable unique field,
    // so findUnique can only use it when it holds a value — the no-category
    // case must look the row up by its null state instead.
    const settings = targetCategoryId !== null
      ? await prisma.loyaltySetting.findUnique({ where: { categoryId: targetCategoryId } })
      : await prisma.loyaltySetting.findFirst({ where: { categoryId: null } });

    if (!settings || !settings.enabled) {
      return NextResponse.json({ error: 'Loyalty not enabled for this category' }, { status: 400 });
    }

    const isMilestoneMode = settings.isMilestoneMode;
    const milestones = JSON.parse(settings.milestones || '[]') as any[];
    let threshold = settings.coffeesRequiredForFree;
    if (isMilestoneMode && milestones.length > 0) {
      threshold = Math.max(...milestones.map(m => m.target));
    }

    let card;
    if (targetCategoryId !== null) {
      const cardsByCategory = await prisma.loyaltyCard.findMany({ where: { categoryId: targetCategoryId } });
      card = cardsByCategory.find(c => normalizeMemberName(c.customerName) === normalizedCustomerName) || null;
      if (!card) {
        card = await prisma.loyaltyCard.create({
          data: { customerName: normalizedCustomerName, categoryId: targetCategoryId },
        });
      }
    } else {
      const cardsByCategory = await prisma.loyaltyCard.findMany({ where: { categoryId: null } });
      card = cardsByCategory.find(c => normalizeMemberName(c.customerName) === normalizedCustomerName) || null;
      if (!card) {
        card = await prisma.loyaltyCard.create({
          data: { customerName: normalizedCustomerName, categoryId: null },
        });
      }
    }

    let currentCount = card.paidCoffeesCount;
    let claimedMilestones = JSON.parse(card.claimedMilestones || '[]') as number[];
    const vouchersCreated = [];

    let tempCount = currentCount + quantity;

    if (!isMilestoneMode) {
      if (tempCount >= threshold) {
        const rewardName = settings.rewardType === 'FREE' ? 'Free Item' : settings.rewardType === 'PERCENTAGE' ? `${settings.rewardValue}% Off` : `₱${settings.rewardValue} Off`;

        const voucher = await prisma.loyaltyVoucher.create({
          data: {
            code: `REWARD-${Date.now().toString(36)}-${Math.random().toString(36).substring(7).toUpperCase()}`,
            customerName: normalizedCustomerName,
            cardId: card.id,
            discountType: settings.rewardType,
            discountValue: settings.rewardValue,
            rewardName: rewardName,
            targetType: 'CATEGORY',
            targetCategoryId: targetCategoryId ?? undefined,
            status: 'ACTIVE',
          },
        });

        vouchersCreated.push(voucher);
        currentCount = Math.max(0, tempCount - threshold);
        claimedMilestones = [];
      } else {
        currentCount = tempCount;
      }
    } else {
      for (const milestone of milestones.sort((a,b) => a.target - b.target)) {
        if (tempCount >= milestone.target && !claimedMilestones.includes(milestone.target)) {
          const rewardName = milestone.rewardType === 'FREE' ? 'Free Item' : milestone.rewardType === 'PERCENTAGE' ? `${milestone.rewardValue}% Off` : `₱${milestone.rewardValue} Off`;

          const voucher = await prisma.loyaltyVoucher.create({
            data: {
              code: `MIL-T${milestone.target}-${Date.now().toString(36)}-${Math.random().toString(36).substring(7).toUpperCase()}`,
              customerName: normalizedCustomerName,
              cardId: card.id,
              discountType: milestone.rewardType,
              discountValue: milestone.rewardValue,
              rewardName: rewardName,
              targetType: 'CATEGORY',
              targetCategoryId: targetCategoryId ?? undefined,
              status: 'ACTIVE',
            },
          });

          vouchersCreated.push(voucher);
          claimedMilestones.push(milestone.target);
        }
      }

      if (tempCount >= threshold) {
        currentCount = Math.max(0, tempCount - threshold);
        claimedMilestones = [];
      } else {
        currentCount = tempCount;
      }
    }

    const updatedCard = await prisma.loyaltyCard.update({
      where: { id: card.id },
      data: {
        paidCoffeesCount: currentCount,
        loyaltyPoints: { increment: quantity },
        claimedMilestones: JSON.stringify(claimedMilestones),
      },
    });

    // Create loyalty transaction record
    await prisma.loyaltyTransaction.create({
      data: {
        cardId: card.id,
        type: 'EARNED',
        points: quantity,
        description: 'Points added manually from loyalty card page',
      },
    });

    await logAction({
      action: 'LOYALTY_POINTS_ADD',
      resource: 'loyalty_card',
      resourceId: card.id,
      details: { customerName: normalizedCustomerName, quantity, categoryId: targetCategoryId, vouchersCreated: vouchersCreated.length },
    });

    return NextResponse.json({
      success: true,
      card: formatCard(updatedCard, settings),
      vouchersCreated: vouchersCreated.length
    });
  } catch (e) {
    console.error('[LOYALTY] Error updating card:', e);
    return NextResponse.json({ error: 'Failed' }, { status: 500 });
  }
}

// PATCH /api/loyalty/cards/:customerName/update-name
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ customerName: string }> | { customerName: string } }) {
  try {
    const resolvedParams = await Promise.resolve(params);
    const { customerName } = resolvedParams as { customerName: string };
    const normalizedCustomerName = normalizeMemberName(customerName);
    const { newName } = await req.json();

    if (!newName || typeof newName !== 'string') return NextResponse.json({ error: 'Name required' }, { status: 400 });

    const normalizedNewName = normalizeMemberName(newName);
    const allCustomerCards = await prisma.loyaltyCard.findMany({ select: { id: true, customerName: true } });
    const duplicateCard = allCustomerCards.find(card => normalizeMemberName(card.customerName) === normalizedNewName && normalizeMemberName(card.customerName) !== normalizedCustomerName);

    if (duplicateCard) {
      return NextResponse.json({ error: 'Another member already uses this name.' }, { status: 409 });
    }

    const targetCards = allCustomerCards.filter(card => normalizeMemberName(card.customerName) === normalizedCustomerName);
    if (targetCards.length === 0) {
      return NextResponse.json({ error: 'Member not found' }, { status: 404 });
    }

    await Promise.all(targetCards.map(async (card) => {
      await prisma.loyaltyCard.update({
        where: { id: card.id },
        data: { customerName: normalizedNewName },
      });
    }));

    const matchingVouchers = await prisma.loyaltyVoucher.findMany({
      where: { customerName: { in: targetCards.map(card => card.customerName) } },
    });

    await Promise.all(matchingVouchers.map(async (voucher) => {
      await prisma.loyaltyVoucher.update({
        where: { id: voucher.id },
        data: { customerName: normalizedNewName },
      });
    }));

    await logAction({
      action: 'LOYALTY_CARD_RENAME',
      resource: 'loyalty_card',
      details: { oldName: normalizedCustomerName, newName: normalizedNewName, cardsUpdated: targetCards.length, vouchersUpdated: matchingVouchers.length },
    });

    return NextResponse.json({ success: true });
  } catch (e) {
    return NextResponse.json({ error: 'Failed' }, { status: 500 });
  }
}

// DELETE /api/loyalty/cards/:customerName
export async function DELETE(req: NextRequest, { params }: { params: Promise<{ customerName: string }> | { customerName: string } }) {
  try {
    const resolvedParams = await Promise.resolve(params);
    const { customerName } = resolvedParams as { customerName: string };
    const normalizedCustomerName = normalizeMemberName(customerName);

    const cards = await prisma.loyaltyCard.findMany({});
    const matchingCards = cards.filter(c => normalizeMemberName(c.customerName) === normalizedCustomerName);
    const cardIds = matchingCards.map(c => c.id);

    await prisma.loyaltyVoucher.deleteMany({
      where: { cardId: { in: cardIds } }
    });

    await Promise.all(cardIds.map(async (id) => {
      await prisma.loyaltyCard.delete({ where: { id } });
    }));

    await logAction({
      action: 'LOYALTY_CARD_DELETE',
      resource: 'loyalty_card',
      details: { customerName: normalizedCustomerName, cardsDeleted: cardIds.length },
    });

    return NextResponse.json({ success: true });
  } catch (e) {
    console.error('[LOYALTY] Error deleting customer:', e);
    return NextResponse.json({ error: 'Failed to delete customer: ' + (e instanceof Error ? e.message : String(e)) }, { status: 500 });
  }
}
