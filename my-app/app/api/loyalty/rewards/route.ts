import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

// GET /api/loyalty/rewards?customerName=name - get available vouchers
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const customerName = searchParams.get('customerName');

    if (!customerName) {
      return NextResponse.json({ error: 'customerName is required' }, { status: 400 });
    }

    // Get all vouchers for this customer (redeemed ones are deleted automatically)
    const vouchers = await prisma.loyaltyVoucher.findMany({
      where: { customerName },
      orderBy: { issuedDate: 'desc' },
    });

    return NextResponse.json({
      customerName,
      available: vouchers.length,
      availableVouchers: vouchers,
      total: vouchers.length,
    });
  } catch (e) {
    console.error('[LOYALTY] Error fetching rewards:', e);
    return NextResponse.json({ error: 'Failed to fetch rewards' }, { status: 500 });
  }
}
