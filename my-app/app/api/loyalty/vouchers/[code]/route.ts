import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

// GET /api/loyalty/vouchers/:code
// Check if a voucher exists and its status
export async function GET(req: NextRequest, { params }: { params: Promise<{ code: string }> | { code: string } }) {
  try {
    const resolvedParams = await Promise.resolve(params);
    const { code } = resolvedParams as { code: string };
    
    const voucher = await prisma.loyaltyVoucher.findUnique({
      where: { code },
    });
    
    if (!voucher) {
      return NextResponse.json({ error: 'Voucher not found' }, { status: 404 });
    }
    
    return NextResponse.json({
      code: voucher.code,
      customerName: voucher.customerName,
      issuedDate: voucher.issuedDate,
      isActive: voucher.status === 'ACTIVE',
    });
  } catch (e) {
    console.error('[LOYALTY] Error fetching voucher:', e);
    return NextResponse.json({ error: 'Failed to fetch voucher' }, { status: 500 });
  }
}

// POST /api/loyalty/vouchers/:code
// Mark a voucher as REDEEMED (don't delete, keep for history)
// Important for flexible calculation tracking
export async function POST(req: NextRequest, { params }: { params: Promise<{ code: string }> | { code: string } }) {
  try {
    const resolvedParams = await Promise.resolve(params);
    const { code } = resolvedParams as { code: string };
    const body = await req.json();
    const { orderId } = body;

    console.log(`[LOYALTY] Redeeming voucher: ${code}`);

    const voucher = await prisma.loyaltyVoucher.findUnique({
      where: { code },
    });
    
    if (!voucher) {
      console.error(`[LOYALTY] Voucher not found: ${code}`);
      return NextResponse.json({ error: `Voucher not found: ${code}` }, { status: 404 });
    }
    
    if (voucher.status !== 'ACTIVE') {
      console.error(`[LOYALTY] Voucher not active: ${code} (Status: ${voucher.status})`);
      return NextResponse.json({ error: `Voucher not found or already used` }, { status: 404 });
    }
    
    // Mark voucher as REDEEMED (keep for tracking)
    await prisma.loyaltyVoucher.update({
      where: { code },
      data: { 
        status: 'REDEEMED',
        redeemedDate: new Date(),
        redeemedOrderId: orderId ? parseInt(orderId) : null,
      },
    });
    
    console.log(`[LOYALTY] Voucher redeemed successfully: ${code}`);

    return NextResponse.json({
      code,
      message: `Voucher ${code} successfully redeemed`,
      counterReset: false, // No counter reset - rewards are cumulative
    });
  } catch (e) {
    console.error('[LOYALTY] Error redeeming voucher:', e);
    return NextResponse.json({ error: `Failed to redeem voucher: ${String(e).substring(0, 100)}` }, { status: 500 });
  }
}
