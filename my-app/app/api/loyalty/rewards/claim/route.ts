import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

// POST /api/loyalty/rewards/claim - claim multiple rewards for an order
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { customerName, voucherCodes, orderId } = body as {
      customerName: string;
      voucherCodes: string[];
      orderId?: number;
    };

    if (!customerName || !voucherCodes || voucherCodes.length === 0) {
      return NextResponse.json(
        { error: 'customerName and voucherCodes are required' },
        { status: 400 }
      );
    }

    // Verify all vouchers exist and belong to customer
    const vouchers = await prisma.loyaltyVoucher.findMany({
      where: {
        code: { in: voucherCodes },
        customerName,
      },
    });

    if (vouchers.length !== voucherCodes.length) {
      return NextResponse.json(
        { error: 'Some vouchers not found or do not belong to you' },
        { status: 404 }
      );
    }

    // Check all are ACTIVE
    const allActive = vouchers.every(v => v.status === 'ACTIVE');
    if (!allActive) {
      return NextResponse.json(
        { error: 'Some vouchers are not active' },
        { status: 400 }
      );
    }

    // Delete all vouchers (they are consumed)
    await prisma.$transaction(
      voucherCodes.map(code =>
        prisma.loyaltyVoucher.delete({
          where: { code },
        })
      )
    );

    // Update order loyaltyPromo if orderId provided
    if (orderId) {
      await prisma.order.update({
        where: { id: orderId },
        data: { loyaltyPromo: true },
      });
    }

    return NextResponse.json({
      success: true,
      claimedCount: voucherCodes.length,
      message: `${voucherCodes.length} voucher(s) successfully redeemed and removed`,
    });
  } catch (e) {
    console.error('[LOYALTY] Error claiming rewards:', e);
    return NextResponse.json({ error: 'Failed to claim rewards' }, { status: 500 });
  }
}
