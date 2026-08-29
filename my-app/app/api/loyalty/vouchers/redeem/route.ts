import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { badRequest, serverError } from '@/lib/api-response';

// POST /api/loyalty/vouchers/redeem - Redeem a voucher with rule validation
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { code, orderId, orderTotal, items } = body;

    if (!code) {
      return badRequest('Voucher code is required');
    }

    if (!orderId) {
      return badRequest('Order ID is required');
    }

    // Find the voucher
    const voucher = await prisma.loyaltyVoucher.findUnique({
      where: { code },
    });

    if (!voucher) {
      return NextResponse.json({ error: 'Voucher not found', valid: false }, { status: 404 });
    }

    // Check if already redeemed
    if (voucher.status === 'REDEEMED') {
      return NextResponse.json({ 
        error: 'Voucher already redeemed', 
        valid: false,
        redeemedDate: voucher.redeemedDate,
      }, { status: 400 });
    }

    // Check if expired
    if (voucher.expiryDate && new Date(voucher.expiryDate) < new Date()) {
      await prisma.loyaltyVoucher.update({
        where: { code },
        data: { status: 'EXPIRED' },
      });
      return NextResponse.json({ 
        error: 'Voucher has expired', 
        valid: false,
        expiryDate: voucher.expiryDate,
      }, { status: 400 });
    }

    // Check max redemptions
    if (voucher.usedCount >= voucher.maxRedemptions) {
      return NextResponse.json({ 
        error: 'Voucher usage limit reached', 
        valid: false,
        maxRedemptions: voucher.maxRedemptions,
        usedCount: voucher.usedCount,
      }, { status: 400 });
    }

    // Check minimum purchase
    const orderAmount = orderTotal || 0;
    if (voucher.minPurchase > 0 && orderAmount < voucher.minPurchase) {
      return NextResponse.json({ 
        error: `Minimum purchase of ₱${voucher.minPurchase} required`, 
        valid: false,
        minPurchase: voucher.minPurchase,
        orderTotal: orderAmount,
      }, { status: 400 });
    }

    // Check valid days
    if (voucher.validDays) {
      const days = ['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT'];
      const today = days[new Date().getDay()];
      
      if (voucher.validDays === 'WEEKENDS') {
        if (today !== 'SAT' && today !== 'SUN') {
          return NextResponse.json({ 
            error: 'Voucher only valid on weekends', 
            valid: false,
            validDays: voucher.validDays,
          }, { status: 400 });
        }
      } else if (voucher.validDays === 'WEEKDAYS') {
        if (today === 'SAT' || today === 'SUN') {
          return NextResponse.json({ 
            error: 'Voucher only valid on weekdays', 
            valid: false,
            validDays: voucher.validDays,
          }, { status: 400 });
        }
      } else if (!voucher.validDays.includes(today)) {
        return NextResponse.json({ 
          error: `Voucher not valid today (${today})`, 
          valid: false,
          validDays: voucher.validDays,
        }, { status: 400 });
      }
    }

    // Check targeting rules - category
    if (voucher.targetType === 'CATEGORY' && voucher.targetCategoryId && items) {
      const hasEligibleItem = items.some((item: { categoryId: number }) => 
        item.categoryId === voucher.targetCategoryId
      );
      if (!hasEligibleItem) {
        return NextResponse.json({ 
          error: 'Voucher not valid for items in cart', 
          valid: false,
          targetType: 'CATEGORY',
          targetCategoryId: voucher.targetCategoryId,
        }, { status: 400 });
      }
    }

    // Check targeting rules - specific product
    if (voucher.targetType === 'PRODUCT' && voucher.targetProductId && items) {
      const hasEligibleItem = items.some((item: { productId: number }) => 
        item.productId === voucher.targetProductId
      );
      if (!hasEligibleItem) {
        return NextResponse.json({ 
          error: 'Voucher not valid for items in cart', 
          valid: false,
          targetType: 'PRODUCT',
          targetProductId: voucher.targetProductId,
        }, { status: 400 });
      }
    }

    // Calculate discount
    let discount = 0;
    if (voucher.discountType === 'FREE') {
      // For FREE type, we just mark as used - the POS system handles the free item
      discount = 0;
    } else if (voucher.discountType === 'PERCENTAGE') {
      discount = (orderAmount * voucher.discountValue) / 100;
    } else if (voucher.discountType === 'FIXED_AMOUNT') {
      discount = Math.min(voucher.discountValue, orderAmount);
    }

    // Update voucher (increment usedCount or mark as redeemed)
    const newUsedCount = voucher.usedCount + 1;
    const isFullyRedeemed = newUsedCount >= voucher.maxRedemptions;

    await prisma.loyaltyVoucher.update({
      where: { code },
      data: {
        usedCount: newUsedCount,
        status: isFullyRedeemed ? 'REDEEMED' : 'ACTIVE',
        redeemedDate: isFullyRedeemed ? new Date() : null,
        redeemedOrderId: orderId,
      },
    });

    return NextResponse.json({
      valid: true,
      discount,
      discountType: voucher.discountType,
      discountValue: voucher.discountValue,
      rewardName: voucher.rewardName,
      usedCount: newUsedCount,
      remainingUses: voucher.maxRedemptions - newUsedCount,
      message: `Voucher applied: ${voucher.rewardName}`,
    });
  } catch (e) {
    return serverError(e, 'Failed to redeem voucher');
  }
}

// GET /api/loyalty/vouchers/redeem - Validate a voucher without redeeming
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const code = searchParams.get('code');

    if (!code) {
      return badRequest('Voucher code is required');
    }

    const voucher = await prisma.loyaltyVoucher.findUnique({
      where: { code },
      include: {
        loyaltyCard: {
          include: {
            category: true
          }
        }
      }
    });

    if (!voucher) {
      return NextResponse.json({ 
        valid: false, 
        error: 'Voucher not found' 
      }, { status: 404 });
    }

    // Check various conditions
    let isValid = true;
    const validationErrors: string[] = [];

    if (voucher.status === 'REDEEMED') {
      isValid = false;
      validationErrors.push('Already redeemed');
    }

    if (voucher.expiryDate && new Date(voucher.expiryDate) < new Date()) {
      isValid = false;
      validationErrors.push('Expired');
    }

    if (voucher.usedCount >= voucher.maxRedemptions) {
      isValid = false;
      validationErrors.push('Usage limit reached');
    }

    return NextResponse.json({
      valid: isValid,
      voucher: {
        code: voucher.code,
        rewardName: voucher.rewardName,
        discountType: voucher.discountType,
        discountValue: voucher.discountValue,
        minPurchase: voucher.minPurchase,
        validDays: voucher.validDays,
        targetType: voucher.targetType || 'CATEGORY', // Vouchers are now category-linked by default
        targetCategoryId: voucher.loyaltyCard?.categoryId || null,
        categoryName: voucher.loyaltyCard?.category?.name || 'All Items',

        expiryDate: voucher.expiryDate,
        maxRedemptions: voucher.maxRedemptions,
        usedCount: voucher.usedCount,
        remainingUses: voucher.maxRedemptions - voucher.usedCount,
      },
      validationErrors: isValid ? [] : validationErrors,
    });
  } catch (e) {
    return serverError(e, 'Failed to validate voucher');
  }
}