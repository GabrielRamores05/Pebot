import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { serverError } from '@/lib/api-response';
import { guardStaff } from '@/lib/api-guards';

interface VoucherRecord {
  id: number;
  code: string;
  customerName: string;
  status: 'ACTIVE' | 'REDEEMED';
  issuedDate: string;
  redeemedDate: string | null;
  redeemedOrderId: number | null;
  orderNumber: string | null;
}

interface VoucherStats {
  totalIssued: number;
  totalRedeemed: number;
  conversionRate: number;
  averageDaysToRedeem: number;
  pendingVouchers: number;
}

export async function GET(req: NextRequest) {
  const { error } = await guardStaff(req);
  if (error) return error;

  try {
    // Fetch all vouchers with order information
    const vouchers = await prisma.loyaltyVoucher.findMany({
      include: {
        loyaltyCard: {
          select: { customerName: true },
        },
      },
      orderBy: {
        issuedDate: 'desc',
      },
    });

    // Fetch orders to get order numbers
    const orders = await prisma.order.findMany({
      select: { id: true, orderNumber: true },
    });

    const orderMap = new Map(orders.map(o => [o.id, o.orderNumber]));

    // Format voucher records
    const voucherRecords: VoucherRecord[] = vouchers.map(v => ({
      id: v.id,
      code: v.code,
      customerName: v.customerName,
      status: v.status as 'ACTIVE' | 'REDEEMED',
      issuedDate: v.issuedDate.toISOString(),
      redeemedDate: v.redeemedDate ? v.redeemedDate.toISOString() : null,
      redeemedOrderId: v.redeemedOrderId,
      orderNumber: v.redeemedOrderId ? orderMap.get(v.redeemedOrderId) || null : null,
    }));

    // Calculate statistics
    const totalIssued = voucherRecords.length;
    const totalRedeemed = voucherRecords.filter(v => v.status === 'REDEEMED').length;
    const conversionRate = totalIssued > 0 ? totalRedeemed / totalIssued : 0;
    const pendingVouchers = voucherRecords.filter(v => v.status === 'ACTIVE').length;

    // Calculate average days to redeem
    const redeemedVouchers = voucherRecords.filter(v => v.redeemedDate);
    let averageDaysToRedeem = 0;
    if (redeemedVouchers.length > 0) {
      const daysArray = redeemedVouchers.map(v => {
        const issued = new Date(v.issuedDate).getTime();
        const redeemed = new Date(v.redeemedDate!).getTime();
        return (redeemed - issued) / (1000 * 60 * 60 * 24); // Convert to days
      });
      averageDaysToRedeem = daysArray.reduce((a, b) => a + b, 0) / daysArray.length;
    }

    const stats: VoucherStats = {
      totalIssued,
      totalRedeemed,
      conversionRate,
      averageDaysToRedeem,
      pendingVouchers,
    };

    return NextResponse.json({
      vouchers: voucherRecords,
      stats,
    });
  } catch (e) {
    return serverError(e, 'Failed to fetch voucher history');
  }
}
