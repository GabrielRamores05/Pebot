import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { badRequest, notFound, serverError } from '@/lib/api-response';

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
      return badRequest('customerName and voucherCodes are required');
    }

    // Verify all vouchers exist and belong to customer
    const vouchers = await prisma.loyaltyVoucher.findMany({
      where: {
        code: { in: voucherCodes },
        customerName,
      },
    });

    if (vouchers.length !== voucherCodes.length) {
      return notFound('Some vouchers not found or do not belong to you');
    }

    // Check all are ACTIVE
    const allActive = vouchers.every(v => v.status === 'ACTIVE');
    if (!allActive) {
      return badRequest('Some vouchers are not active');
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
    return serverError(e, 'Failed to claim rewards');
  }
}
