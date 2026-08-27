import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { serverError } from '@/lib/api-response';
import { guardStaff } from '@/lib/api-guards';

// GET /api/loyalty/cards
export async function GET(req: NextRequest) {
  const { error } = await guardStaff(req);
  if (error) return error;

  try {
    const cards = await prisma.loyaltyCard.findMany({
      include: {
        vouchers: true,
        category: true,
      },
      orderBy: { customerName: 'asc' },
      take: 500,
    });

    
    // Fetch all settings to lookup thresholds efficiently
    const allSettings = await prisma.loyaltySetting.findMany({
      include: { category: true }
    });
    const settingsMap = new Map(allSettings.map(s => [s.categoryId, s]));
    const firstSetting = allSettings[0]; // fallback

    
    const cardsWithMeta = cards.map(card => {
      const activeVouchers = card.vouchers.filter(v => v.status === 'ACTIVE').length;
      const redeemedVouchers = card.vouchers.filter(v => v.status === 'REDEEMED').sort((a, b) => 
        new Date(b.redeemedDate || 0).getTime() - new Date(a.redeemedDate || 0).getTime()
      );
      const lastRedeemedDate = redeemedVouchers.length > 0 ? redeemedVouchers[0].redeemedDate : null;
      
      const specificSetting = settingsMap.get(card.categoryId);
      const threshold = specificSetting?.coffeesRequiredForFree || firstSetting?.coffeesRequiredForFree || 10;
      const normalizedName = (card.customerName || '').trim().toUpperCase();
      
      return {
        id: card.id,
        customerName: normalizedName,
        membershipCode: card.membershipCode || null,
        memberSince: card.memberSince || null,
        categoryId: card.categoryId,
        categoryName: specificSetting?.category?.name || (card as any).category?.name || 'Global',
        coffeesCompleted: card.paidCoffeesCount,
        loyaltyPoints: card.loyaltyPoints ?? 0,
        coffeesRequiredForFree: threshold,
        rewardsAvailable: activeVouchers,
        lastRewardRedeemDate: lastRedeemedDate,
      };
    });

    
    return NextResponse.json(cardsWithMeta);
  } catch (e) {
    return serverError(e, 'Failed to fetch loyalty cards');
  }
}
