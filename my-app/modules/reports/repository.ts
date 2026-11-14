import { prisma } from '@/lib/prisma';

/** Orders placed within [from, to), with the fields the end-of-day summary needs. */
export async function findOrdersForDay(locationId: number, from: Date, to: Date) {
  return prisma.order.findMany({
    where: { locationId, createdAt: { gte: from, lt: to } },
    orderBy: { createdAt: 'asc' },
    select: {
      orderNumber: true,
      status: true,
      paymentMethod: true,
      orderType: true,
      totalAmount: true,
      grossAmount: true,
      loyaltyDiscount: true,
      discountAmount: true,
      discountReason: true,
      discountHolders: true,
      vatRemoved: true,
      vatableSales: true,
      vatAmount: true,
      vatExemptSales: true,
      serviceCharge: true,
      paidAt: true,
      voidReason: true,
      refundAmount: true,
    },
  });
}

export async function findBusinessIdentity() {
  return prisma.businessSettings.findFirst({
    select: { businessName: true, businessAddress: true, tin: true, vatRegistered: true },
  });
}
