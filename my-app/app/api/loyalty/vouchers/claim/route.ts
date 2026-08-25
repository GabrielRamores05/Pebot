import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

// POST /api/loyalty/vouchers/claim
// Customer claims free coffee voucher (sequential system)
// After claiming, progress resets to 0
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { customerName } = body as { customerName: string };

    if (!customerName) {
      return NextResponse.json({ error: 'customerName is required' }, { status: 400 });
    }

    // Get loyalty card with full details (findFirst since unique key is now composite)
    const card = await prisma.loyaltyCard.findFirst({
      where: { customerName },
      include: { vouchers: true },
    }) as any;


    if (!card) {
      return NextResponse.json({ error: 'Customer not found' }, { status: 404 });
    }

    // Get settings
    const settings = await prisma.loyaltySetting.findFirst();
    const coffeesRequired = settings?.coffeesRequiredForFree || 9;

    // Check for active vouchers (vouchers ready to be claimed)
    const activeVouchers = card.vouchers.filter((v: any) => v.status === 'ACTIVE');

    if (activeVouchers.length === 0) {
      const progress = Math.min(card.paidCoffeesCount, coffeesRequired);
      const coffeesUntilFree = coffeesRequired - progress;
      return NextResponse.json({
        error: `No free coffee available yet. You need ${coffeesUntilFree} more coffee(s).`,
        progress: progress,
        coffeesUntilFree: coffeesUntilFree,
        hasUnclaimedVoucher: false,
      }, { status: 400 });
    }

    // Claim the first active voucher (sequential system = 1 per cycle)
    const voucherToClaim = activeVouchers[0];
    const voucherCode = voucherToClaim.code;

    // IMPORTANT: Do NOT update voucher status here
    // Voucher stays ACTIVE until it's actually redeemed during order placement
    // This allows the voucher to be used in cart before placing the final order

    // RESET PROGRESS TO 0 after claiming
    // This unlocks the counter so new coffees can be added
    const updatedCard = await prisma.loyaltyCard.update({
      where: { id: card.id },
      data: {
        paidCoffeesCount: 0,
      },
      include: { vouchers: true },
    }) as any;


    return NextResponse.json({
      customerName: customerName,
      voucherCode: voucherCode,
      progressReset: true,
      newProgress: 0,
      message: `Successfully claimed your free coffee! Progress reset to 0. Use your voucher (${voucherCode}) on your next order.`,
    });
  } catch (e) {
    console.error('[LOYALTY] Error claiming voucher:', e);
    return NextResponse.json({ error: 'Failed to claim voucher' }, { status: 500 });
  }
}
