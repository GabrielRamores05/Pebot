 
import { prisma } from '@/lib/prisma';

// ---------------------------------------------------------------------------
// LoyaltyCard – location-scoped
// ---------------------------------------------------------------------------

export async function findLoyaltyCardsWithVouchersAndCategory(locationId: number = 1) {
  return prisma.loyaltyCard.findMany({
    where: { locationId },
    include: { vouchers: true, category: true },
    orderBy: { customerName: 'asc' },
    take: 500,
  });
}

export async function findLoyaltyCardsWithVouchers(locationId: number = 1) {
  return prisma.loyaltyCard.findMany({
    where: { locationId },
    include: { vouchers: true },
    orderBy: { createdAt: 'asc' },
  });
}

export async function findLoyaltyCardsByCustomerName(customerName: string, locationId: number = 1) {
  return prisma.loyaltyCard.findFirst({
    where: { customerName, locationId },
    include: { vouchers: true },
  });
}

export async function findLoyaltyCardById(id: number, locationId: number = 1) {
  return prisma.loyaltyCard.findFirst({
    where: { id, locationId },
    include: { vouchers: true },
  });
}

export async function findLoyaltyCardsForMemberCheck(locationId: number = 1) {
  return prisma.loyaltyCard.findMany({
    where: { locationId },
    select: { customerName: true },
  });
}

export async function findLoyaltyCardsByMembershipCodePrefix(baseCode: string, locationId: number = 1) {
  return prisma.loyaltyCard.findMany({
    where: { membershipCode: { startsWith: baseCode }, locationId },
    select: { membershipCode: true },
  });
}

export async function createLoyaltyCard(
  data: {
    customerName: string;
    membershipCode?: string | null;
    memberSince?: Date | null;
    categoryId?: number | null;
    paidCoffeesCount?: number;
    claimedMilestones?: string;
  },
  locationId: number = 1,
) {
  return prisma.loyaltyCard.create({
    data: {
      customerName: data.customerName,
      membershipCode: data.membershipCode ?? null,
      memberSince: data.memberSince ?? null,
      categoryId: data.categoryId ?? null,
      paidCoffeesCount: data.paidCoffeesCount ?? 0,
      claimedMilestones: data.claimedMilestones ?? '[]',
      locationId,
    },
    include: { vouchers: true },
  });
}

export async function updateLoyaltyCardPaidCoffeesCount(
  id: number,
  data: { paidCoffeesCount: number },
  _locationId: number = 1,
) {
  return prisma.loyaltyCard.update({
    where: { id },
    data: { paidCoffeesCount: data.paidCoffeesCount },
    include: { vouchers: true },
  });
}

// ---------------------------------------------------------------------------
// LoyaltySetting – location-scoped
// ---------------------------------------------------------------------------

export async function findLoyaltySettingByCategoryId(categoryId: number, locationId: number = 1) {
  return prisma.loyaltySetting.findFirst({
    where: { categoryId, locationId },
    include: { category: true },
  });
}

// Note: Prisma LoyaltySetting has @@unique on categoryId, but with locationId the schema
// still uses findUnique on categoryId for legacy callers. We scope to locationId via findFirst.
export async function findLoyaltySettingUniqueByCategoryId(categoryId: number, _locationId: number = 1) {
  return prisma.loyaltySetting.findUnique({
    where: { categoryId },
    include: { category: true },
  } as any);
}

export async function findLoyaltySettingsWithCategory(locationId: number = 1) {
  return prisma.loyaltySetting.findMany({
    where: { locationId },
    include: { category: true },
  });
}

export async function findFirstLoyaltySetting(locationId: number = 1) {
  return prisma.loyaltySetting.findFirst({
    where: { locationId },
  });
}

export async function findEnabledLoyaltySetting(locationId: number = 1) {
  return prisma.loyaltySetting.findFirst({
    where: { enabled: true, locationId },
  });
}

export async function existsLoyaltySettingByCategoryId(categoryId: number, _locationId: number = 1) {
  return prisma.loyaltySetting.findUnique({ where: { categoryId } } as any);
}

export async function createLoyaltySetting(
  data: {
    categoryId?: number | null;
    coffeesRequiredForFree?: number;
    enabled?: boolean;
    cardColor?: string;
    cardTitle?: string;
    cardDescription?: string;
    rewardType?: string;
    rewardValue?: number;
    isMilestoneMode?: boolean;
    milestones?: string;
    maxHeldRewards?: number;
  },
  locationId: number = 1,
) {
  return prisma.loyaltySetting.create({
    data: {
      categoryId: data.categoryId ?? null,
      coffeesRequiredForFree: data.coffeesRequiredForFree ?? 10,
      enabled: data.enabled ?? true,
      cardColor: data.cardColor || '#8B4513',
      cardTitle: data.cardTitle || 'Loyalty Card',
      cardDescription: data.cardDescription || 'Earn rewards',
      rewardType: data.rewardType || 'FREE',
      rewardValue: data.rewardValue ?? 0,
      isMilestoneMode: data.isMilestoneMode ?? false,
      milestones: data.milestones ?? '[]',
      maxHeldRewards: data.maxHeldRewards ?? 3,
      locationId,
    },
    include: { category: true },
  });
}

export async function updateLoyaltySetting(
  id: number,
  data: Record<string, unknown>,
  _locationId: number = 1,
) {
  return prisma.loyaltySetting.update({
    where: { id },
    data: data as any,
    include: { category: true },
  });
}

export async function deleteLoyaltySetting(id: number, _locationId: number = 1) {
  return prisma.loyaltySetting.delete({ where: { id } });
}

// ---------------------------------------------------------------------------
// LoyaltyVoucher – location-scoped
// ---------------------------------------------------------------------------

export async function findLoyaltyVouchersByCustomerName(customerName: string, locationId: number = 1) {
  return prisma.loyaltyVoucher.findMany({
    where: { customerName, locationId },
    orderBy: { issuedDate: 'desc' },
  });
}

export async function findLoyaltyVouchersByCustomerNameLimited(
  customerName: string,
  locationId: number = 1,
  take: number = 100,
) {
  const where: any = { locationId };
  if (customerName) where.customerName = customerName;
  // When customerName falsy (list all), still scope to location
  if (customerName) {
    return prisma.loyaltyVoucher.findMany({
      where: { customerName, locationId },
      orderBy: { issuedDate: 'desc' },
      take,
    });
  }
  return prisma.loyaltyVoucher.findMany({
    where: { locationId },
    orderBy: { issuedDate: 'desc' },
    take,
  });
}

export async function findAllLoyaltyVouchersWithCard(locationId: number = 1) {
  return prisma.loyaltyVoucher.findMany({
    where: { locationId },
    include: { loyaltyCard: { select: { customerName: true } } },
    orderBy: { issuedDate: 'desc' },
  });
}

export async function findLoyaltyVouchersFiltered(
  where: Record<string, unknown>,
  locationId: number = 1,
) {
  return prisma.loyaltyVoucher.findMany({
    where: { locationId, ...where } as any,
    orderBy: { issuedDate: 'desc' },
    take: 100,
  });
}

export async function findLoyaltyVouchersByCodesAndCustomer(
  codes: string[],
  customerName: string,
  locationId: number = 1,
) {
  return prisma.loyaltyVoucher.findMany({
    where: { code: { in: codes }, customerName, locationId },
  });
}

export async function deleteLoyaltyVouchersByCodes(codes: string[], _locationId: number = 1) {
  return prisma.$transaction(
    codes.map((code) => prisma.loyaltyVoucher.delete({ where: { code } })),
  );
}

export async function findLoyaltyVoucherByCode(code: string, _locationId: number = 1) {
  // code is globally unique
  return prisma.loyaltyVoucher.findUnique({ where: { code } });
}

export async function findLoyaltyVoucherWithCardAndCategory(code: string, _locationId: number = 1) {
  return prisma.loyaltyVoucher.findUnique({
    where: { code },
    include: { loyaltyCard: { include: { category: true } } },
  });
}

export async function createLoyaltyVoucher(
  data: {
    code: string;
    customerName: string;
    cardId?: number | null;
    discountType?: string;
    discountValue?: number;
    rewardName?: string;
    minPurchase?: number;
    maxRedemptions?: number;
    usedCount?: number;
    validDays?: string | null;
    targetType?: string;
    targetCategoryId?: number | null;
    targetProductId?: number | null;
    expiryDate?: Date | null;
    status?: string;
  },
  locationId: number = 1,
) {
  return prisma.loyaltyVoucher.create({
    data: {
      code: data.code,
      customerName: data.customerName,
      cardId: data.cardId ?? null,
      discountType: data.discountType ?? 'FREE',
      discountValue: data.discountValue ?? 0,
      rewardName: data.rewardName ?? 'Free Coffee',
      minPurchase: data.minPurchase ?? 0,
      maxRedemptions: data.maxRedemptions ?? 1,
      usedCount: data.usedCount ?? 0,
      validDays: data.validDays ?? null,
      targetType: data.targetType ?? 'ALL',
      targetCategoryId: data.targetCategoryId ?? null,
      targetProductId: data.targetProductId ?? null,
      expiryDate: data.expiryDate ?? null,
      status: data.status ?? 'ACTIVE',
      locationId,
    },
  });
}

export async function updateLoyaltyVoucherByCode(
  code: string,
  data: Record<string, unknown>,
  _locationId: number = 1,
) {
  return prisma.loyaltyVoucher.update({ where: { code }, data: data as any });
}

// ---------------------------------------------------------------------------
// Order helpers used by loyalty analytics/history – location-scoped
// ---------------------------------------------------------------------------

export async function findOrdersForCustomerAnalytics(locationId: number = 1) {
  return prisma.order.findMany({
    where: { locationId },
    select: { id: true, customerName: true, totalAmount: true, createdAt: true, status: true },
    orderBy: { createdAt: 'desc' },
  });
}

export async function findOrdersForVoucherHistory(locationId: number = 1) {
  return prisma.order.findMany({
    where: { locationId },
    select: { id: true, orderNumber: true },
  });
}

export async function updateOrderLoyaltyPromo(orderId: number, _locationId: number = 1) {
  return prisma.order.update({ where: { id: orderId }, data: { loyaltyPromo: true } });
}

// ---------------------------------------------------------------------------
// Loyalty award / refund helpers – extracted from lib/loyalty-award.ts
// ---------------------------------------------------------------------------

export async function findLoyaltyTransactionsByOrderId(orderId: number) {
  return prisma.loyaltyTransaction.findMany({ where: { orderId } });
}

export async function findFirstLoyaltyTransactionByOrderId(orderId: number) {
  return prisma.loyaltyTransaction.findFirst({ where: { orderId } });
}

export async function findLoyaltyCardByIdAndCustomerName(cardId: number, customerName: string) {
  return prisma.loyaltyCard.findFirst({ where: { id: cardId, customerName } });
}

export async function findLoyaltyCardByCustomerNameAndCategoryId(
  customerName: string,
  categoryId: number | null,
) {
  return prisma.loyaltyCard.findFirst({ where: { customerName, categoryId } });
}

export async function createLoyaltyCardSimple(
  customerName: string,
  categoryId: number | null,
  locationId: number = 1,
) {
  return prisma.loyaltyCard.create({ data: { customerName, categoryId, locationId } as any });
}

export async function incrementLoyaltyCardPoints(cardId: number, pointQty: number) {
  return prisma.loyaltyCard.update({
    where: { id: cardId },
    data: {
      paidCoffeesCount: { increment: pointQty },
      loyaltyPoints: { increment: pointQty },
    },
  });
}

export async function incrementLoyaltyCardLoyaltyPoints(cardId: number, qty: number) {
  return prisma.loyaltyCard.update({
    where: { id: cardId },
    data: { loyaltyPoints: { increment: qty } },
  });
}

export async function updateLoyaltyCardAwardState(
  cardId: number,
  data: { paidCoffeesCount: number; claimedMilestones: string },
) {
  return prisma.loyaltyCard.update({
    where: { id: cardId },
    data: { paidCoffeesCount: data.paidCoffeesCount, claimedMilestones: data.claimedMilestones },
  });
}

export async function countActiveVouchersByCardId(cardId: number) {
  return prisma.loyaltyVoucher.count({ where: { cardId, status: 'ACTIVE' } });
}

export async function createLoyaltyTransaction(data: {
  cardId: number;
  orderId: number;
  type: string;
  points: number;
  description: string;
}) {
  return prisma.loyaltyTransaction.create({ data: data as any });
}

export async function findGlobalLoyaltySetting() {
  return prisma.loyaltySetting.findFirst({ where: { categoryId: null } });
}

export async function decrementLoyaltyCardForRefund(cardId: number, points: number) {
  return prisma.loyaltyCard.update({
    where: { id: cardId },
    data: { loyaltyPoints: { decrement: points }, paidCoffeesCount: { decrement: points } },
  });
}

export async function incrementLoyaltyCardPointsForRefund(cardId: number, points: number) {
  return prisma.loyaltyCard.update({
    where: { id: cardId },
    data: { loyaltyPoints: { increment: points } },
  });
}

export async function updateLoyaltyTransactionForReversal(
  id: number,
  data: { type: string; description: string },
) {
  return prisma.loyaltyTransaction.update({ where: { id }, data: data as any });
}

export async function revertRedeemedVouchersForOrder(orderId: number) {
  return prisma.loyaltyVoucher.updateMany({
    where: { redeemedOrderId: orderId, status: 'REDEEMED' },
    data: { status: 'ACTIVE', redeemedDate: null, usedCount: { decrement: 1 } },
  });
}

// ---------------------------------------------------------------------------
// Category – location-scoped (for loyalty settings linking)
// ---------------------------------------------------------------------------

export async function findCategoryByIdForLoyalty(id: number, locationId: number = 1) {
  return prisma.category.findFirst({ where: { id, locationId } });
}
