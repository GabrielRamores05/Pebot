import { beforeEach, describe, expect, test, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  transactionFindMany: vi.fn(),
  transactionFindFirst: vi.fn(),
  transactionCreate: vi.fn(),
  transactionUpdate: vi.fn(),
  cardFindFirst: vi.fn(),
  cardCreate: vi.fn(),
  cardUpdate: vi.fn(),
  settingFindUnique: vi.fn(),
  settingFindFirst: vi.fn(),
  voucherCount: vi.fn(),
  voucherCreate: vi.fn(),
  voucherUpdateMany: vi.fn(),
  emitEvent: vi.fn(),
  logAction: vi.fn(),
}));

vi.mock('@/lib/prisma', () => ({
  prisma: {
    loyaltyTransaction: {
      findMany: mocks.transactionFindMany,
      findFirst: mocks.transactionFindFirst,
      create: mocks.transactionCreate,
      update: mocks.transactionUpdate,
    },
    loyaltyCard: {
      findFirst: mocks.cardFindFirst,
      create: mocks.cardCreate,
      update: mocks.cardUpdate,
    },
    loyaltySetting: {
      findUnique: mocks.settingFindUnique,
      findFirst: mocks.settingFindFirst,
    },
    loyaltyVoucher: {
      count: mocks.voucherCount,
      create: mocks.voucherCreate,
      updateMany: mocks.voucherUpdateMany,
    },
  },
}));

vi.mock('@/lib/socket', () => ({
  emitEvent: mocks.emitEvent,
}));

vi.mock('@/lib/audit-log', () => ({
  logAction: mocks.logAction,
}));

import {
  awardLoyaltyForPaidOrder,
  awardLoyaltyToSpecificCards,
  refundLoyaltyForCancelledOrder,
} from '../../lib/loyalty-award';
import type { PaidOrderForLoyalty } from '../../lib/loyalty-award';

function order(partial: Partial<PaidOrderForLoyalty> = {}): PaidOrderForLoyalty {
  return {
    id: 50,
    loyaltyPromo: false,
    loyaltyCustomerName: '  Ana   Cruz ',
    customerName: 'Walk-in',
    orderNumber: 'ORD-A001',
    totalAmount: 500,
    items: [{ quantity: 1, product: { categoryId: 4 } }],
    ...partial,
  };
}

function settings(
  partial: Partial<{
    enabled: boolean;
    maxHeldRewards: number;
    isMilestoneMode: boolean;
    milestones: string;
    coffeesRequiredForFree: number;
    rewardType: string;
    rewardValue: number;
  }> = {},
) {
  return {
    enabled: true,
    maxHeldRewards: 3,
    isMilestoneMode: false,
    milestones: '[]',
    coffeesRequiredForFree: 10,
    rewardType: 'FREE',
    rewardValue: 0,
    ...partial,
  };
}

function card(
  partial: Partial<{
    id: number;
    paidCoffeesCount: number;
    loyaltyPoints: number | null;
    claimedMilestones: string;
  }> = {},
) {
  return {
    id: 70,
    paidCoffeesCount: 0,
    loyaltyPoints: 0,
    claimedMilestones: '[]',
    ...partial,
  };
}

beforeEach(() => {
  vi.resetAllMocks();
  mocks.logAction.mockResolvedValue(undefined);
  mocks.transactionCreate.mockResolvedValue({});
  mocks.transactionUpdate.mockResolvedValue({});
  mocks.cardUpdate.mockResolvedValue({});
  mocks.voucherCount.mockResolvedValue(0);
  mocks.voucherCreate.mockResolvedValue({});
  mocks.voucherUpdateMany.mockResolvedValue({});
});

describe('awardLoyaltyToSpecificCards', () => {
  test('does not award the same order twice', async () => {
    mocks.transactionFindMany.mockResolvedValue([{ id: 1 }]);

    await awardLoyaltyToSpecificCards({
      loyaltyAssignments: [
        { productId: 4, quantity: 1, loyaltyCardIds: [2], quantitiesPerCard: [1] },
      ],
      customerName: 'Ana',
      orderId: 50,
    });

    expect(mocks.cardFindFirst).not.toHaveBeenCalled();
    expect(mocks.logAction).not.toHaveBeenCalled();
  });

  test('normalizes the customer, creates missing cards, and records positive points', async () => {
    mocks.transactionFindMany.mockResolvedValue([]);
    mocks.cardFindFirst
      .mockResolvedValueOnce(card({ id: 11 }))
      .mockResolvedValueOnce(null);
    mocks.cardCreate.mockResolvedValue(card({ id: 12 }));

    await awardLoyaltyToSpecificCards({
      loyaltyAssignments: [
        {
          productId: 4,
          quantity: 3,
          loyaltyCardIds: [11, 12, 13],
          quantitiesPerCard: [2, 1, 0],
        },
      ],
      customerName: '  Ana   Cruz ',
      orderId: 50,
    });

    expect(mocks.cardFindFirst).toHaveBeenNthCalledWith(1, {
      where: { id: 11, customerName: 'ANA CRUZ' },
    });
    expect(mocks.cardCreate).toHaveBeenCalledWith({
      data: { customerName: 'ANA CRUZ', categoryId: 1 },
    });
    expect(mocks.cardUpdate).toHaveBeenNthCalledWith(1, {
      where: { id: 11 },
      data: {
        paidCoffeesCount: { increment: 2 },
        loyaltyPoints: { increment: 2 },
      },
    });
    expect(mocks.transactionCreate).toHaveBeenCalledTimes(2);
    expect(mocks.logAction).toHaveBeenCalledWith({
      action: 'LOYALTY_POINTS_AWARD',
      resource: 'loyalty_card',
      details: {
        customerName: 'ANA CRUZ',
        orderId: 50,
        totalPoints: 3,
        assignmentCount: 1,
      },
    });
  });
});

describe('awardLoyaltyForPaidOrder', () => {
  test('skips promotional, duplicate, and nameless orders', async () => {
    await awardLoyaltyForPaidOrder(order({ loyaltyPromo: true }));
    expect(mocks.transactionFindFirst).not.toHaveBeenCalled();

    mocks.transactionFindFirst.mockResolvedValueOnce({ id: 1 });
    await awardLoyaltyForPaidOrder(order());
    expect(mocks.settingFindUnique).not.toHaveBeenCalled();

    mocks.transactionFindFirst.mockResolvedValueOnce(null);
    await awardLoyaltyForPaidOrder(
      order({ loyaltyCustomerName: null, customerName: '   ' }),
    );
    expect(mocks.settingFindUnique).not.toHaveBeenCalled();
  });

  test('uses the store-wide fallback and issues every earned standard reward', async () => {
    vi.spyOn(Date, 'now').mockReturnValue(1_700_000_000_000);
    vi.spyOn(Math, 'random').mockReturnValue(0.123456);
    mocks.transactionFindFirst.mockResolvedValue(null);
    mocks.settingFindUnique.mockResolvedValue(null);
    mocks.settingFindFirst.mockResolvedValue(
      settings({ coffeesRequiredForFree: 3 }),
    );
    mocks.cardFindFirst.mockResolvedValue(card({ paidCoffeesCount: 1 }));

    await awardLoyaltyForPaidOrder(
      order({
        items: [{ quantity: 5, product: { categoryId: 9 } }],
      }),
    );

    expect(mocks.cardFindFirst).toHaveBeenCalledWith({
      where: { customerName: 'ANA CRUZ', categoryId: null },
    });
    expect(mocks.voucherCreate).toHaveBeenCalledTimes(2);
    expect(mocks.voucherCreate).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({
        data: expect.objectContaining({
          customerName: 'ANA CRUZ',
          cardId: 70,
          discountType: 'FREE',
          rewardName: 'Free Item',
          targetCategoryId: null,
          status: 'ACTIVE',
        }),
      }),
    );
    expect(mocks.cardUpdate).toHaveBeenLastCalledWith({
      where: { id: 70 },
      data: {
        paidCoffeesCount: 0,
        claimedMilestones: '[]',
      },
    });
    expect(mocks.emitEvent).toHaveBeenCalledWith(
      'loyalty-voucher-earned',
      expect.objectContaining({
        customerName: 'ANA CRUZ',
        voucherCodes: expect.arrayContaining([
          expect.stringMatching(/^REWARD-G-/),
        ]),
      }),
    );
    expect(mocks.logAction).toHaveBeenCalledWith(
      expect.objectContaining({ action: 'LOYALTY_REWARD_EARNED' }),
    );
  });

  test('uses category rules and records points below the threshold', async () => {
    mocks.transactionFindFirst.mockResolvedValue(null);
    mocks.settingFindUnique.mockResolvedValue(
      settings({
        coffeesRequiredForFree: 5,
        rewardType: 'PERCENTAGE',
        rewardValue: 20,
      }),
    );
    mocks.cardFindFirst.mockResolvedValue(null);
    mocks.cardCreate.mockResolvedValue(card({ id: 71 }));

    await awardLoyaltyForPaidOrder(
      order({
        loyaltyCustomerName: null,
        customerName: 'Ben',
        items: [
          { quantity: 1, product: { categoryId: 4 } },
          { quantity: 2, product: { categoryId: 4 } },
        ],
      }),
    );

    expect(mocks.cardCreate).toHaveBeenCalledWith({
      data: { customerName: 'BEN', categoryId: 4 },
    });
    expect(mocks.transactionCreate).toHaveBeenCalledWith({
      data: {
        cardId: 71,
        orderId: 50,
        type: 'EARNED',
        points: 3,
        description: 'Points earned from order ORD-A001',
      },
    });
    expect(mocks.voucherCreate).not.toHaveBeenCalled();
    expect(mocks.cardUpdate).toHaveBeenLastCalledWith({
      where: { id: 71 },
      data: {
        paidCoffeesCount: 3,
        claimedMilestones: '[]',
      },
    });
    expect(mocks.logAction).toHaveBeenCalledWith({
      action: 'LOYALTY_POINTS_AWARD',
      resource: 'loyalty_card',
      details: {
        customerName: 'BEN',
        orderId: 50,
        orderNumber: 'ORD-A001',
        pointsAwarded: 3,
      },
    });
  });

  test('skips categories without an enabled loyalty program', async () => {
    mocks.transactionFindFirst.mockResolvedValue(null);
    mocks.settingFindUnique
      .mockResolvedValueOnce(settings({ enabled: false }))
      .mockResolvedValueOnce(null);
    mocks.settingFindFirst.mockResolvedValue(null);

    await awardLoyaltyForPaidOrder(
      order({
        items: [
          { quantity: 2, product: { categoryId: 1 } },
          { quantity: 3, product: { categoryId: 2 } },
        ],
      }),
    );

    expect(mocks.cardFindFirst).not.toHaveBeenCalled();
    expect(mocks.logAction).toHaveBeenCalledWith(
      expect.objectContaining({
        action: 'LOYALTY_POINTS_AWARD',
        details: expect.objectContaining({ pointsAwarded: 5 }),
      }),
    );
  });

  test('issues milestones in target order and resets a completed cycle', async () => {
    mocks.transactionFindFirst.mockResolvedValue(null);
    mocks.settingFindUnique.mockResolvedValue(
      settings({
        isMilestoneMode: true,
        milestones: JSON.stringify([
          { target: 10, rewardType: 'FIXED_AMOUNT', rewardValue: 50 },
          { target: 5, rewardType: 'PERCENTAGE', rewardValue: 10 },
        ]),
      }),
    );
    mocks.cardFindFirst.mockResolvedValue(
      card({ paidCoffeesCount: 4, claimedMilestones: '[]' }),
    );

    await awardLoyaltyForPaidOrder(
      order({ items: [{ quantity: 6, product: { categoryId: 4 } }] }),
    );

    expect(mocks.voucherCreate).toHaveBeenCalledTimes(2);
    expect(mocks.voucherCreate).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({
        data: expect.objectContaining({
          discountType: 'PERCENTAGE',
          discountValue: 10,
          rewardName: '10% Off',
        }),
      }),
    );
    expect(mocks.voucherCreate).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({
        data: expect.objectContaining({
          discountType: 'FIXED_AMOUNT',
          discountValue: 50,
          rewardName: '₱50 Off',
        }),
      }),
    );
    expect(mocks.cardUpdate).toHaveBeenLastCalledWith({
      where: { id: 70 },
      data: {
        paidCoffeesCount: 0,
        claimedMilestones: '[]',
      },
    });
  });

  test('keeps milestone progress when the reward holding cap blocks issuance', async () => {
    mocks.transactionFindFirst.mockResolvedValue(null);
    mocks.settingFindUnique.mockResolvedValue(
      settings({
        maxHeldRewards: 1,
        isMilestoneMode: true,
        milestones: JSON.stringify([
          { target: 5, rewardType: 'FREE', rewardValue: 0 },
        ]),
      }),
    );
    mocks.cardFindFirst.mockResolvedValue(card({ paidCoffeesCount: 4 }));
    mocks.voucherCount.mockResolvedValue(1);

    await awardLoyaltyForPaidOrder(order());

    expect(mocks.voucherCreate).not.toHaveBeenCalled();
    expect(mocks.cardUpdate).toHaveBeenLastCalledWith({
      where: { id: 70 },
      data: {
        paidCoffeesCount: 5,
        claimedMilestones: '[]',
      },
    });
  });
});

describe('refundLoyaltyForCancelledOrder', () => {
  test('does nothing when the order has no loyalty transactions', async () => {
    mocks.transactionFindMany.mockResolvedValue([]);

    await refundLoyaltyForCancelledOrder(50);

    expect(mocks.cardUpdate).not.toHaveBeenCalled();
    expect(mocks.voucherUpdateMany).not.toHaveBeenCalled();
  });

  test('reverses earned and redeemed transactions and reactivates vouchers', async () => {
    mocks.transactionFindMany.mockResolvedValue([
      {
        id: 1,
        cardId: 10,
        type: 'EARNED',
        points: 2,
        description: 'Order points',
      },
      {
        id: 2,
        cardId: 20,
        type: 'REDEEMED',
        points: 1,
        description: null,
      },
    ]);

    await refundLoyaltyForCancelledOrder(50);

    expect(mocks.cardUpdate).toHaveBeenNthCalledWith(1, {
      where: { id: 10 },
      data: {
        loyaltyPoints: { decrement: 2 },
        paidCoffeesCount: { decrement: 2 },
      },
    });
    expect(mocks.cardUpdate).toHaveBeenNthCalledWith(2, {
      where: { id: 20 },
      data: { loyaltyPoints: { increment: 1 } },
    });
    expect(mocks.transactionUpdate).toHaveBeenNthCalledWith(1, {
      where: { id: 1 },
      data: {
        type: 'REVERSED_EARNED',
        description: '[CANCELLED ORDER 50] Order points',
      },
    });
    expect(mocks.transactionUpdate).toHaveBeenNthCalledWith(2, {
      where: { id: 2 },
      data: {
        type: 'REVERSED_REDEEMED',
        description: '[CANCELLED ORDER 50] ',
      },
    });
    expect(mocks.voucherUpdateMany).toHaveBeenCalledWith({
      where: { redeemedOrderId: 50, status: 'REDEEMED' },
      data: {
        status: 'ACTIVE',
        redeemedDate: null,
        usedCount: { decrement: 1 },
      },
    });
    expect(mocks.logAction).toHaveBeenCalledWith({
      action: 'LOYALTY_REVERSAL',
      resource: 'loyalty_card',
      details: {
        orderId: 50,
        cardsAffected: [10, 20],
        transactionsReversed: 2,
      },
    });
  });
});
