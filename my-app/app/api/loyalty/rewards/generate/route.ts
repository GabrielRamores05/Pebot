import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { badRequest, serverError } from '@/lib/api-response';
import { guardStaff } from '@/lib/api-guards';

// POST /api/loyalty/rewards/generate - Manually generate/sync vouchers for customer
// Ensures vouchers exist for all earned thresholds
export async function POST(req: NextRequest) {
  const { error } = await guardStaff(req);
  if (error) return error;

  try {
    const body = await req.json();
    const { customerName } = body as { customerName: string };

    if (!customerName) {
      return badRequest('customerName is required');
    }

    // Get loyalty card (use findFirst since unique key is now composite)
    const card = await prisma.loyaltyCard.findFirst({
      where: { customerName },
      include: { vouchers: true },
    });


    if (!card) {
      return NextResponse.json({ 
        customerName,
        totalEarned: 0,
        activeVouchers: 0,
        vouchersCreated: 0,
        message: 'Customer not found'
      }, { status: 404 });
    }

    // Get settings
    const settings = await prisma.loyaltySetting.findFirst();
    const coffeesRequired = settings?.coffeesRequiredForFree || 10;
    
    // Get reward configuration
    const rewardType = settings?.rewardType || 'FREE';
    const rewardValue = settings?.rewardValue || 0;
    
    // Build reward name based on type
    let rewardName = 'Free Item';
    if (rewardType === 'PERCENTAGE') {
      rewardName = `${rewardValue}% Off`;
    } else if (rewardType === 'FIXED_AMOUNT') {
      rewardName = `₱${rewardValue} Off`;
    }

    // Calculate total earned vouchers from paid coffees
    const totalEarned = Math.floor(card.paidCoffeesCount / coffeesRequired);

    // Count active vouchers
    const activeVouchers = card.vouchers.filter(v => v.status === 'ACTIVE');
    const activeCouponCount = activeVouchers.length;

    // If we have fewer active vouchers than earned, create the missing ones
    const vouchersToCreate = Math.max(0, totalEarned - activeCouponCount);

    if (vouchersToCreate <= 0) {
      return NextResponse.json({
        customerName,
        paidCoffeesCount: card.paidCoffeesCount,
        totalEarned,
        activeVouchers: activeCouponCount,
        vouchersCreated: 0,
        rewardType,
        rewardValue,
        rewardName,
        message: activeCouponCount === 0 && totalEarned === 0 
          ? 'No rewards earned yet' 
          : 'All rewards already generated',
      });
    }

    // Generate missing vouchers with new reward type info
    const generatedCodes: string[] = [];
    for (let i = 0; i < vouchersToCreate; i++) {
      const timestamp = Date.now().toString(36);
      const randomPart = Math.random().toString(36).substring(2, 8).toUpperCase();
      const voucherCode = `CAFE-${timestamp}-${randomPart}`;
      
      await prisma.loyaltyVoucher.create({
        data: {
          code: voucherCode,
          customerName,
          discountType: rewardType,
          discountValue: rewardValue,
          rewardName,
          status: 'ACTIVE',
        },
      });

      generatedCodes.push(voucherCode);
    }

    return NextResponse.json({
      customerName,
      paidCoffeesCount: card.paidCoffeesCount,
      coffeesRequired,
      totalEarned,
      previousActiveVouchers: activeCouponCount,
      newActiveVouchers: activeCouponCount + vouchersToCreate,
      vouchersCreated: vouchersToCreate,
      generatedCodes,
      rewardType,
      rewardValue,
      rewardName,
      message: `Generated ${vouchersToCreate} new voucher(s)`,
    });
  } catch (e) {
    return serverError(e, 'Failed to generate vouchers');
  }
}
