 
import { prisma } from '@/lib/prisma';

// ---------------------------------------------------------------------------
// System – Consultant (AIConversation, AIMessage, analytics reads)
// AIConversation/AIMessage have NO locationId; business data tables ARE scoped.
// ---------------------------------------------------------------------------

// ----- BusinessSettings – NO locationId -----

export async function findBusinessSettings() {
  return prisma.businessSettings.findFirst();
}

// ----- AIConversation – NO locationId (scoped by userId) -----

export async function listConversationsForUser(userId: number) {
  return prisma.aIConversation.findMany({
    where: { userId },
    orderBy: { updatedAt: 'desc' },
    take: 50,
  });
}

export async function findConversationForUser(id: number, userId: number) {
  return prisma.aIConversation.findFirst({
    where: { id, userId },
    include: { messages: { orderBy: { createdAt: 'asc' } as any } },
  } as any);
}

export async function findConversationMetaForUser(id: number, userId: number) {
  return prisma.aIConversation.findFirst({ where: { id, userId } });
}

export async function createConversation(userId: number, title?: string) {
  return prisma.aIConversation.create({
    data: { userId, title: title || 'New Conversation' },
  });
}

export async function updateConversationForUser(id: number, userId: number, data: Record<string, any>) {
  return prisma.aIConversation.update({ where: { id, userId } as any, data: data as any });
}

export async function deleteConversationForUser(id: number, userId: number) {
  return prisma.aIConversation.delete({ where: { id, userId } as any });
}

// ----- AIMessage – NO locationId -----

export async function createAIMessage(data: { conversationId: number; role: string; content: string }) {
  return prisma.aIMessage.create({ data: data as any });
}

export async function bulkCreateAIMessages(conversationId: number, messages: Array<{ role: string; content: string }>) {
  const created: any[] = [];
  for (const msg of messages) {
    const m = await prisma.aIMessage.create({
      data: { conversationId, role: msg.role as any, content: msg.content },
    });
    created.push(m);
  }
  return created;
}

// ----- Consultant business context reads – location-scoped where applicable -----

export async function findProductsForConsultant(locationId: number = 1) {
  return prisma.product.findMany({
    where: { locationId },
    include: { category: { select: { name: true } } },
    take: 50,
  });
}

export async function findIngredientsForConsultant(locationId: number = 1) {
  return prisma.ingredient.findMany({
    where: { locationId },
    include: { supplier: { select: { name: true } } },
    take: 50,
  });
}

export async function findRecentOrdersForConsultant(locationId: number = 1) {
  return prisma.order.findMany({
    where: { locationId },
    include: { items: { include: { product: { select: { name: true } } } } },
    orderBy: { createdAt: 'desc' },
    take: 20,
  });
}

export async function findLoyaltyCardsForConsultant(locationId: number = 1) {
  return prisma.loyaltyCard.findMany({
    where: { locationId },
    include: { category: { select: { name: true } }, vouchers: { where: { status: 'ACTIVE' } } },
    orderBy: { createdAt: 'desc' },
    take: 20,
  });
}

export async function findActiveStaffForConsultant() {
  return prisma.user.findMany({
    select: { id: true, name: true, email: true, role: true, active: true } as any,
    where: { active: true } as any,
  });
}

// ----- Analytics helpers -----

export async function findOrdersForAnalytics(dateFrom: Date, locationId: number = 1) {
  return prisma.order.findMany({
    where: { locationId, createdAt: { gte: dateFrom }, status: { notIn: ['CANCELLED'] } } as any,
    include: { items: { include: { product: { include: { category: true } } } } },
  });
}

export async function findOrdersWithProductOnly(dateFrom: Date, locationId: number = 1) {
  return prisma.order.findMany({
    where: { locationId, createdAt: { gte: dateFrom }, status: { notIn: ['CANCELLED'] } } as any,
    include: { items: { include: { product: true } } },
  });
}

export async function findAllIngredients(locationId: number = 1) {
  return prisma.ingredient.findMany({
    where: { locationId },
    include: { supplier: { select: { name: true } } },
  });
}

export async function findLoyaltyTransactionsSince(dateFrom: Date, locationId: number = 1) {
  return prisma.loyaltyTransaction.findMany({
    where: { locationId, createdAt: { gte: dateFrom } } as any,
    include: { card: true },
  });
}

export async function findRedeemedVouchersSince(dateFrom: Date, locationId: number = 1) {
  return prisma.loyaltyVoucher.findMany({
    where: { locationId, status: 'REDEEMED', redeemedDate: { gte: dateFrom } } as any,
  });
}

export async function findAuditEventsSince(dateFrom: Date, locationId: number = 1) {
  return prisma.auditEvent.findMany({
    where: { locationId, createdAt: { gte: dateFrom }, userId: { not: null } } as any,
    include: { user: true },
  });
}

export async function findOrdersForCharts(dateFrom: Date, locationId: number = 1) {
  return prisma.order.findMany({
    where: { locationId, createdAt: { gte: dateFrom } } as any,
  });
}

export async function findOrdersForChartsWithItems(dateFrom: Date, locationId: number = 1) {
  return prisma.order.findMany({
    where: { locationId, createdAt: { gte: dateFrom }, status: { notIn: ['CANCELLED'] } } as any,
    include: { items: { include: { product: { include: { category: true } } } } },
  });
}

export async function findOrdersForChartsProductOnly(dateFrom: Date, locationId: number = 1) {
  return prisma.order.findMany({
    where: { locationId, createdAt: { gte: dateFrom }, status: { notIn: ['CANCELLED'] } } as any,
    include: { items: { include: { product: true } } },
  });
}

export async function findInventoryForCharts() {
  // Inventory has no locationId; filter via product if needed – keep simple
  return prisma.inventory.findMany({
    include: { product: { select: { name: true } } },
  });
}

export async function findLoyaltyCardsSince(dateFrom: Date, locationId: number = 1) {
  return prisma.loyaltyCard.findMany({
    where: { locationId, createdAt: { gte: dateFrom } } as any,
    orderBy: { createdAt: 'asc' } as any,
  });
}

export async function findAllLoyaltyCards(locationId: number = 1) {
  return prisma.loyaltyCard.findMany({
    where: { locationId },
    include: { vouchers: true },
  });
}

export async function findAllLoyaltyTransactions(dateFrom: Date, locationId: number = 1) {
  return prisma.loyaltyTransaction.findMany({
    where: { locationId, createdAt: { gte: dateFrom } } as any,
    include: { card: true },
  });
}
