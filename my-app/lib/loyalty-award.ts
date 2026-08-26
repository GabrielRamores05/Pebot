import { prisma } from '@/lib/prisma';
import { emitEvent } from '@/lib/socket';
import { normalizeMemberName } from '@/lib/loyalty-utils';
import { logAction } from '@/lib/audit-log';

export interface PaidOrderForLoyalty {
  id: number;
  loyaltyPromo: boolean;
  loyaltyCustomerName: string | null;
  customerName: string;
  orderNumber: string;
  totalAmount: number;
  items: { quantity: number; product: { categoryId: number } }[];
}

/**
 * Award loyalty points to specific cards based on loyaltyAssignments.
 *
 * Each coffee ordered earns 1 loyalty point that can be distributed
 * to one or more loyalty card owners. For example, if 2 coffees are ordered,
 * the points can be assigned to one card or split across multiple cards.
 *
 * The loyaltyAssignments array has the structure:
 * [
 *   { productId, quantity, loyaltyCardIds: [cardId1, cardId2], quantitiesPerCard: [1, 1] }
 * ]
 *
 * This means: for productId with quantity 2, assign 1 point to cardId1 and 1 point to cardId2.
 *
 * Each coffee earns 1 loyalty point (tracked on LoyaltyCard.loyaltyPoints).
 */
export async function awardLoyaltyToSpecificCards({
  loyaltyAssignments,
  customerName,
  orderId,
}: {
  loyaltyAssignments: { productId: number; quantity: number; loyaltyCardIds: number[]; quantitiesPerCard: number[] }[];
  customerName: string;
  orderId?: number;
}): Promise<void> {
  const tx = prisma;
  const normalizedCustomerName = normalizeMemberName(customerName);

  // Prevent duplicate awards for the same order
  if (orderId) {
    const existingTransactions = await tx.loyaltyTransaction.findMany({
      where: { orderId },
    });
    if (existingTransactions.length > 0) {
      console.log(`[LOYALTY] Order ${orderId} already has loyalty transactions, skipping award`);
      return;
    }
  }

  const totalPoints = loyaltyAssignments.reduce(
    (sum, a) => sum + a.quantitiesPerCard.reduce((p, q) => p + (typeof q === 'number' ? q : 0), 0),
    0
  );

  for (const assignment of loyaltyAssignments) {
    const { productId, loyaltyCardIds, quantitiesPerCard } = assignment;

    for (let i = 0; i < loyaltyCardIds.length; i++) {
      const cardId = loyaltyCardIds[i];
      const pointQty = typeof quantitiesPerCard[i] === 'number' ? quantitiesPerCard[i] : 0;
      if (pointQty <= 0) continue;

      let card = await tx.loyaltyCard.findFirst({
        where: { id: cardId, customerName: normalizedCustomerName },
      });

      if (!card) {
        card = await tx.loyaltyCard.create({
          data: { customerName: normalizedCustomerName, categoryId: 1 },
        });
      }

      await tx.loyaltyCard.update({
        where: { id: card.id },
        data: {
          paidCoffeesCount: { increment: pointQty },
          loyaltyPoints: { increment: pointQty },
        },
      });

      if (orderId) {
        await tx.loyaltyTransaction.create({
          data: {
            cardId: card.id,
            orderId,
            type: 'EARNED',
            points: pointQty,
            description: `Points earned from order ${orderId} (product ${productId})`,
          },
        });
      }
    }
  }

  await logAction({
    action: 'LOYALTY_POINTS_AWARD',
    resource: 'loyalty_card',
    details: {
      customerName: normalizedCustomerName,
      orderId,
      totalPoints,
      assignmentCount: loyaltyAssignments.length,
    },
  });
}

export interface PaidOrderForLoyalty {
  id: number;
  loyaltyPromo: boolean;
  loyaltyCustomerName: string | null;
  customerName: string;
  orderNumber: string;
  totalAmount: number;
  items: { quantity: number; product: { categoryId: number } }[];
}

interface Milestone {
  target: number;
  rewardType: string;
  rewardValue: number;
}

/**
 * Award loyalty points for a confirmed-paid order.
 *
 * Runs once, server-side, when payment is confirmed. Adds one point per paid item
 * to the customer's loyalty card for each category, and creates reward vouchers
 * whenever the customer crosses the shop's configured thresholds.
 *
 * Orders paid using a loyalty reward (`loyaltyPromo`) earn nothing new.
 *
 * Each coffee ordered earns 1 loyalty point (tracked on LoyaltyCard.loyaltyPoints).
 * LoyaltyTransaction records are created for auditability.
 * Prevents duplicate awards for the same order.
 */
export async function awardLoyaltyForPaidOrder(order: PaidOrderForLoyalty): Promise<void> {
  if (order.loyaltyPromo) return;

  // Prevent duplicate loyalty awards for the same order
  const existingTx = await prisma.loyaltyTransaction.findFirst({
    where: { orderId: order.id },
  });
  if (existingTx) {
    console.log(`[LOYALTY] Order ${order.id} already has loyalty transactions, skipping award`);
    return;
  }

  const loyaltyTargetName = order.loyaltyCustomerName || order.customerName;
  const normalizedTargetName = normalizeMemberName(loyaltyTargetName);
  if (!normalizedTargetName) return;

  // Group items by categoryId
  const itemsByCategory: Record<number, number> = {};
  for (const item of order.items) {
    const catId = item.product.categoryId;
    itemsByCategory[catId] = (itemsByCategory[catId] || 0) + item.quantity;
  }

  const voucherCodes: string[] = [];

  // For each category, apply loyalty if a setting exists. A category without
  // its own rule follows the store-wide (no-category) program — same lookup
  // rule as manual point-adds; an explicit opt-out stays opted out.
  for (const [catIdStr, qty] of Object.entries(itemsByCategory)) {
    const catId = parseInt(catIdStr);
    const perCategorySettings = await prisma.loyaltySetting.findUnique({
      where: { categoryId: catId },
    });
    const settings = perCategorySettings
      ? perCategorySettings
      : await prisma.loyaltySetting.findFirst({ where: { categoryId: null } });

    if (!settings || !settings.enabled) continue;

    // Cap on unredeemed rewards this card may hold (per loyalty module; the
    // store-wide module acts as the fallback for categories without their own).
    const maxHeldRewards = (typeof settings.maxHeldRewards === 'number') ? settings.maxHeldRewards : 3;

    // Category programs earn on the member's category card and make
    // category-scoped vouchers; the store-wide program earns on their
    // store-wide card and makes vouchers valid on any item.
    const cardCategoryId = perCategorySettings ? catId : null;
    const voucherScope: number | null = perCategorySettings ? catId : null;
    const scopeLabel = perCategorySettings ? String(catId) : 'G';

    const isMilestoneMode = settings.isMilestoneMode;
    const milestones = JSON.parse(settings.milestones || '[]') as Milestone[];
    let threshold = settings.coffeesRequiredForFree;
    if (isMilestoneMode && milestones.length > 0) {
      threshold = Math.max(...milestones.map((m) => m.target));
    }

    // Find or create the member's card for this scope
    let card = await prisma.loyaltyCard.findFirst({
      where: {
        customerName: normalizedTargetName,
        categoryId: cardCategoryId,
      },
    });

    if (!card) {
      card = await prisma.loyaltyCard.create({
        data: { customerName: normalizedTargetName, categoryId: cardCategoryId },
      });
    }

    // How many unredeemed rewards this card currently holds
    let heldRewards = await prisma.loyaltyVoucher.count({
      where: { cardId: card.id, status: 'ACTIVE' },
    });

    const currentCount = card.paidCoffeesCount;
    const currentPoints = card.loyaltyPoints ?? 0;
    let claimedMilestones = JSON.parse(card.claimedMilestones || '[]') as number[];
    let tempCount = currentCount + qty;

    // Award loyalty points (1 coffee = 1 point) and create transaction
    await prisma.loyaltyTransaction.create({
      data: {
        cardId: card.id,
        orderId: order.id,
        type: 'EARNED',
        points: qty,
        description: `Points earned from order ${order.orderNumber}`,
      },
    });

    await prisma.loyaltyCard.update({
      where: { id: card.id },
      data: {
        loyaltyPoints: { increment: qty },
      },
    });

    if (!isMilestoneMode) {
      while (tempCount >= threshold) {
        if (heldRewards >= maxHeldRewards) break; // at cap: keep progress, stop issuing
        const rewardName =
          settings.rewardType === 'FREE'
            ? 'Free Item'
            : settings.rewardType === 'PERCENTAGE'
              ? `${settings.rewardValue}% Off`
              : `₱${settings.rewardValue} Off`;
        const code = `REWARD-${scopeLabel}-${Date.now().toString(36)}-${Math.random()
          .toString(36)
          .substring(7)
          .toUpperCase()}`;

        await prisma.loyaltyVoucher.create({
          data: {
            code,
            customerName: normalizedTargetName,
            cardId: card.id,
            discountType: settings.rewardType,
            discountValue: settings.rewardValue,
            rewardName: rewardName,
            targetType: 'CATEGORY',
            targetCategoryId: voucherScope,
            status: 'ACTIVE',
          },
        });
        voucherCodes.push(code);
        heldRewards++;
        tempCount -= threshold;
      }
    } else {
      // Milestone mode
      for (const milestone of milestones.sort((a, b) => a.target - b.target)) {
        if (tempCount >= milestone.target && !claimedMilestones.includes(milestone.target)) {
          if (heldRewards >= maxHeldRewards) continue; // at cap: keep unclaimed, stop issuing
          const rewardName =
            milestone.rewardType === 'FREE'
              ? 'Free Item'
              : milestone.rewardType === 'PERCENTAGE'
                ? `${milestone.rewardValue}% Off`
                : `₱${milestone.rewardValue} Off`;
          const code = `MIL-T${milestone.target}-${scopeLabel}-${Date.now().toString(36)}-${Math.random()
            .toString(36)
            .substring(7)
            .toUpperCase()}`;

          await prisma.loyaltyVoucher.create({
            data: {
              code,
              customerName: normalizedTargetName,
              cardId: card.id,
              discountType: milestone.rewardType,
              discountValue: milestone.rewardValue,
              rewardName: rewardName,
              targetType: 'CATEGORY',
              targetCategoryId: voucherScope,
              status: 'ACTIVE',
            },
          });
          voucherCodes.push(code);
          heldRewards++;
          claimedMilestones.push(milestone.target);
        }
      }

      if (tempCount >= threshold) {
        tempCount = Math.max(0, tempCount - threshold);
        claimedMilestones = [];
      }
    }

    await prisma.loyaltyCard.update({
      where: { id: card.id },
      data: {
        paidCoffeesCount: tempCount,
        claimedMilestones: JSON.stringify(claimedMilestones),
      },
    });
  }

  if (voucherCodes.length > 0) {
    emitEvent('loyalty-voucher-earned', {
      customerName: normalizedTargetName,
      voucherCodes,
      message: `Congratulations! You earned ${voucherCodes.length} reward(s)!`,
    });

    await logAction({
      action: 'LOYALTY_REWARD_EARNED',
      resource: 'loyalty_voucher',
      details: {
        customerName: normalizedTargetName,
        voucherCodes,
        orderId: order.id,
        orderNumber: order.orderNumber,
      },
    });
  } else {
     await logAction({
       action: 'LOYALTY_POINTS_AWARD',
       resource: 'loyalty_card',
       details: {
         customerName: normalizedTargetName,
         orderId: order.id,
         orderNumber: order.orderNumber,
         pointsAwarded: Object.values(itemsByCategory).reduce((a, b) => a + b, 0),
       },
     });
   }
 }

/**
 * Reverse loyalty points when an order is cancelled.
 *
 * Finds all LoyaltyTransaction records for the order and decrements the
 * corresponding LoyaltyCard loyaltyPoints and paidCoffeesCount.
 * Also reverses any vouchers that were generated by that order.
 */
export async function refundLoyaltyForCancelledOrder(orderId: number): Promise<void> {
  const transactions = await prisma.loyaltyTransaction.findMany({
    where: { orderId },
  });

  if (transactions.length === 0) return;

  const cardIds = [...new Set(transactions.map((t) => t.cardId))];

  for (const tx of transactions) {
    if (tx.type === 'EARNED') {
      await prisma.loyaltyCard.update({
        where: { id: tx.cardId },
        data: {
          loyaltyPoints: { decrement: tx.points },
          paidCoffeesCount: { decrement: tx.points },
        },
      });
    } else if (tx.type === 'REDEEMED') {
      await prisma.loyaltyCard.update({
        where: { id: tx.cardId },
        data: {
          loyaltyPoints: { increment: tx.points },
        },
      });
    }

    await prisma.loyaltyTransaction.update({
      where: { id: tx.id },
      data: {
        type: tx.type === 'EARNED' ? 'REVERSED_EARNED' : 'REVERSED_REDEEMED',
        description: `[CANCELLED ORDER ${orderId}] ${tx.description || ''}`,
      },
    });
  }

  // Reverse vouchers generated by this order
  await prisma.loyaltyVoucher.updateMany({
    where: { redeemedOrderId: orderId, status: 'REDEEMED' },
    data: {
      status: 'ACTIVE',
      redeemedDate: null,
      usedCount: { decrement: 1 },
    },
  });

  await logAction({
    action: 'LOYALTY_REVERSAL',
    resource: 'loyalty_card',
    details: {
      orderId,
      cardsAffected: cardIds,
      transactionsReversed: transactions.length,
    },
  });
 }
