import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { badRequest, conflict } from '@/lib/api-response';

function normalizeMemberName(value: string) {
  return value.trim().replace(/\s+/g, ' ').toUpperCase();
}

async function generateMembershipCode(memberName: string, date = new Date()) {
  const safeName = memberName.trim().replace(/[^A-Z0-9]/g, '').slice(0, 12) || 'MEMBER';
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  const year = String(date.getFullYear()).slice(-2);
  const dateCode = `${month}${day}${year}`;
  const baseCode = `${safeName}-${dateCode}`;

  const existingCodes = await prisma.loyaltyCard.findMany({
    where: { membershipCode: { startsWith: baseCode } },
    select: { membershipCode: true },
  });

  const nextIndex = existingCodes.length + 1;
  return nextIndex === 1 ? baseCode : `${baseCode}-${nextIndex}`;
}

// POST /api/loyalty/register
// Register a customer name for loyalty program (check for duplicates)
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { customerName } = body;

    if (!customerName || typeof customerName !== 'string' || customerName.trim() === '') {
      return badRequest('Customer name is required');
    }

    const normalizedName = normalizeMemberName(customerName);
    const existingCards = await prisma.loyaltyCard.findMany({
      select: { customerName: true },
    });
    const duplicateNameExists = existingCards.some(card => normalizeMemberName(card.customerName) === normalizedName);

    if (duplicateNameExists) {
      return conflict('This name is already registered. Please view your existing cards.');
    }

    const membershipCode = await generateMembershipCode(normalizedName, new Date());

    const firstModule = await prisma.loyaltySetting.findFirst({
      where: { enabled: true }
    });

    const newCard = await prisma.loyaltyCard.create({
      data: {
        customerName: normalizedName,
        membershipCode,
        memberSince: new Date(),
        categoryId: firstModule?.categoryId || null,
        paidCoffeesCount: 0,
        claimedMilestones: '[]',
      },
      include: { vouchers: true },
    });

    const settings = await prisma.loyaltySetting.findFirst();
    const isMilestoneMode = settings?.isMilestoneMode || false;
    const milestones = JSON.parse(settings?.milestones || '[]') as {target: number, rewardType: string, rewardValue: number}[];
    
    let coffeesRequired = settings?.coffeesRequiredForFree || 10;
    let message = '';
    
    if (isMilestoneMode && milestones.length > 0) {
      coffeesRequired = Math.max(...milestones.map(m => m.target));
      message = `Welcome! Complete ${milestones.length} milestones up to ${coffeesRequired} coffees to earn multiple rewards!`;
    } else {
      const rewardType = settings?.rewardType || 'FREE';
      const rewardValue = settings?.rewardValue || 0;
      const rewardStr = rewardType === 'FREE' ? 'a free item' : rewardType === 'PERCENTAGE' ? `${rewardValue}% off` : `₱${rewardValue} off`;
      message = `Welcome to our loyalty program! Every ${coffeesRequired} coffees earns you ${rewardStr} on your next order!`;
    }

    return NextResponse.json({
      customerName: newCard.customerName,
      membershipCode: newCard.membershipCode,
      memberSince: newCard.memberSince,
      paidCoffeesCount: newCard.paidCoffeesCount,
      activeVouchers: 0,
      coffeesRequiredForFree: coffeesRequired,
      coffeesUntilNextFree: coffeesRequired,
      message,
    }, { status: 201 });
  } catch (e) {
    console.error('[LOYALTY] Error registering customer:', e);
    return NextResponse.json(
      { error: 'Failed to register customer' },
      { status: 500 }
    );
  }
}

// GET /api/loyalty/register/check
// Check if a name is available
export async function GET(req: NextRequest) {
  try {
    const customerName = req.nextUrl.searchParams.get('name');

    if (!customerName || customerName.trim() === '') {
      return NextResponse.json(
        { available: false, error: 'Name is required' },
        { status: 400 }
      );
    }

    const normalizedName = normalizeMemberName(customerName);
    const existingCards = await prisma.loyaltyCard.findMany({
      select: { customerName: true },
    });
    const isTaken = existingCards.some(card => normalizeMemberName(card.customerName) === normalizedName);

    return NextResponse.json({
      available: !isTaken,
      name: normalizedName,
    });
  } catch (e) {
    console.error('[LOYALTY] Error checking name availability:', e);
    return NextResponse.json(
      { available: false, error: 'Failed to check availability' },
      { status: 500 }
    );
  }
}
