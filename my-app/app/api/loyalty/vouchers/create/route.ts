import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { badRequest, serverError } from '@/lib/api-response';

// POST /api/loyalty/vouchers/create - Create a promotional voucher with custom rules
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { 
      customerName,
      discountType,
      discountValue,
      rewardName,
      minPurchase,
      maxRedemptions,
      validDays,
      targetType,
      targetCategoryId,
      targetProductId,
      expiryDate,
    } = body;

    // Validate required fields - customerName is optional for promotional vouchers
    // If not provided, use 'PROMO' as a generic customer name for promotional vouchers
    const finalCustomerName = customerName?.trim() || 'PROMO';

    if (!discountType || !['FREE', 'PERCENTAGE', 'FIXED_AMOUNT'].includes(discountType)) {
      return badRequest('discountType must be FREE, PERCENTAGE, or FIXED_AMOUNT');
    }

    if (discountValue === undefined || discountValue < 0) {
      return badRequest('discountValue must be non-negative');
    }

    // Build reward name if not provided
    const finalRewardName = rewardName || (
      discountType === 'FREE' ? 'Free Item' :
      discountType === 'PERCENTAGE' ? `${discountValue}% Off` :
      `₱${discountValue} Off`
    );

    // Generate unique voucher code
    const timestamp = Date.now().toString(36);
    const randomPart = Math.random().toString(36).substring(2, 8).toUpperCase();
    const voucherCode = `PROMO-${timestamp}-${randomPart}`;

    // Create the voucher
    const voucher = await prisma.loyaltyVoucher.create({
      data: {
        code: voucherCode,
        customerName: finalCustomerName,
        discountType,
        discountValue,
        rewardName: finalRewardName,
        minPurchase: minPurchase || 0,
        maxRedemptions: maxRedemptions || 1,
        usedCount: 0,
        validDays: validDays || null,
        targetType: targetType || 'ALL',
        targetCategoryId: targetCategoryId || null,
        targetProductId: targetProductId || null,
        expiryDate: expiryDate ? new Date(expiryDate) : null,
        status: 'ACTIVE',
      },
    });

    return NextResponse.json({
      success: true,
      voucher: {
        id: voucher.id,
        code: voucher.code,
        customerName: voucher.customerName,
        discountType: voucher.discountType,
        discountValue: voucher.discountValue,
        rewardName: voucher.rewardName,
        minPurchase: voucher.minPurchase,
        maxRedemptions: voucher.maxRedemptions,
        validDays: voucher.validDays,
        targetType: voucher.targetType,
        expiryDate: voucher.expiryDate,
        status: voucher.status,
      },
      message: `Created voucher ${voucherCode}`,
    });
  } catch (e) {
    return serverError(e, 'Failed to create voucher');
  }
}

// GET /api/loyalty/vouchers/create - List all vouchers (optionally filtered by customer)
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const customerName = searchParams.get('customerName');

    const where = customerName ? { customerName } : {};

    const vouchers = await prisma.loyaltyVoucher.findMany({
      where,
      orderBy: { issuedDate: 'desc' },
      take: 100,
    });

    return NextResponse.json({ vouchers });
  } catch (e) {
    return serverError(e, 'Failed to fetch vouchers');
  }
}