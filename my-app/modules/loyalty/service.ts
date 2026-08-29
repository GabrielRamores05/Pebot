import { z } from 'zod';
import { fromZodError } from 'zod-validation-error';
import { normalizeMemberName, rewardLabel, voucherCode } from '@/lib/loyalty-utils';
import { logAction } from '@/lib/audit-log';
import { emitEvent } from '@/lib/socket';
import {
  RegisterCustomerInputSchema,
  CheckNameInputSchema,
  AddCoffeesInputSchema,
  RenameCardInputSchema,
  DeleteCardInputSchema,
  RedeemVoucherInputSchema,
  UpdateSettingInputSchema,
  DeleteSettingInputSchema,
  CreateVoucherInputSchema,
} from '@/modules/loyalty/schema';
import * as repo from '@/modules/loyalty/repository';
import { computePhilippinePayroll } from '@/lib/philippine-payroll';

function parseInput<T>(schema: z.ZodSchema<T>, input: unknown): T {
  const result = schema.safeParse(input);
  if (!result.success) {
    throw fromZodError(result.error);
  }
  return result.data;
}

function setErrorStatus(e: Error, status: number): Error {
  (e as unknown as { status: number }).status = status;
  return e;
}

function formatSettings(settings: any) {
  if (!settings) return null;
  const rewardDescription = rewardLabel(settings.rewardType, settings.rewardValue);
  return {
    id: settings.id,
    categoryId: settings.categoryId,
    categoryName: settings.category?.name || 'Global',
    coffeesRequiredForFree: settings.coffeesRequiredForFree,
    enabled: settings.enabled,
    cardColor: settings.cardColor,
    cardTitle: settings.cardTitle,
    cardDescription: settings.cardDescription,
    rewardType: settings.rewardType,
    rewardValue: settings.rewardValue,
    rewardDescription,
    isMilestoneMode: settings.isMilestoneMode,
    milestones: JSON.parse(settings.milestones || '[]'),
    maxHeldRewards: settings.maxHeldRewards,
  };
}

function formatCard(card: any, settings: any) {
  const isMilestoneMode = settings?.isMilestoneMode || false;
  const milestones = JSON.parse(settings?.milestones || '[]');

  let coffeesRequired = settings?.coffeesRequiredForFree || 10;
  if (isMilestoneMode && milestones.length > 0) {
    coffeesRequired = Math.max(...milestones.map((m: any) => m.target));
  }

  const progress = Math.min(card.paidCoffeesCount, coffeesRequired);
  const coffeesUntilFree = Math.max(0, coffeesRequired - progress);

  return {
    id: card.id,
    customerName: card.customerName,
    categoryId: card.categoryId,
    categoryName: card.category?.name || 'Global',
    paidCoffeesCount: card.paidCoffeesCount,
    loyaltyPoints: card.loyaltyPoints ?? 0,
    progress,
    coffeesUntilFree,
    coffeesRequiredForFree: coffeesRequired,
    hasUnclaimedVoucher: card.vouchers?.length > 0,
    activeVouchers: card.vouchers || [],
    activeVoucherCount: card.vouchers?.length || 0,
    isMilestoneMode,
    milestones,
    claimedMilestones: JSON.parse(card.claimedMilestones || '[]'),
    message: coffeesUntilFree === 0
      ? 'Reward earned!'
      : `${coffeesUntilFree} more until reward`,
  };
}

// ---------------------------------------------------------------------------
// Customer registration
// ---------------------------------------------------------------------------

export async function registerCustomer(input: unknown) {
  const data = parseInput(RegisterCustomerInputSchema, input);

  const normalizedName = normalizeMemberName(data.customerName);

  const existingCards = await repo.findLoyaltyCardsForMemberCheck();
  const duplicateNameExists = existingCards.some(
    (card) => normalizeMemberName(card.customerName) === normalizedName,
  );

  if (duplicateNameExists) {
    throw setErrorStatus(new Error('This name is already registered. Please view your existing cards.'), 409);
  }

  const baseCode = `${normalizedName.replace(/[^A-Z0-9]/g, '').slice(0, 12) || 'MEMBER'}-${String(new Date().getMonth() + 1).padStart(2, '0')}${String(new Date().getDate()).padStart(2, '0')}${String(new Date().getFullYear()).slice(-2)}`;
  let membershipCode = baseCode;
  let suffix = 2;

  while (await repo.findLoyaltyCardsByMembershipCodePrefix(baseCode)) {
    membershipCode = `${baseCode}-${suffix}`;
    suffix += 1;
  }

  const firstModule = await repo.findEnabledLoyaltySetting();

  const newCard = await repo.createLoyaltyCard({
    customerName: normalizedName,
    membershipCode,
    memberSince: new Date(),
    categoryId: firstModule?.categoryId ?? null,
    paidCoffeesCount: 0,
    claimedMilestones: '[]',
  });

  const settings = await repo.findFirstLoyaltySetting();
  const isMilestoneMode = settings?.isMilestoneMode || false;
  const milestones = JSON.parse(settings?.milestones || '[]');

  let coffeesRequired = settings?.coffeesRequiredForFree || 10;
  let message = '';

  if (isMilestoneMode && milestones.length > 0) {
    coffeesRequired = Math.max(...milestones.map((m: any) => m.target));
    message = `Welcome! Complete ${milestones.length} milestones up to ${coffeesRequired} coffees to earn multiple rewards!`;
  } else {
    const rewardType = settings?.rewardType || 'FREE';
    const rewardValue = settings?.rewardValue || 0;
    const rewardStr = rewardType === 'FREE'
      ? 'a free item'
      : rewardType === 'PERCENTAGE'
        ? `${rewardValue}% off`
        : `₱${rewardValue} off`;
    message = `Welcome to our loyalty program! Every ${coffeesRequired} coffees earns you ${rewardStr} on your next order!`;
  }

  return {
    customerName: newCard.customerName,
    membershipCode: newCard.membershipCode,
    memberSince: newCard.memberSince,
    paidCoffeesCount: newCard.paidCoffeesCount,
    activeVouchers: 0,
    coffeesRequiredForFree: coffeesRequired,
    coffeesUntilNextFree: coffeesRequired,
    message,
  };
}

export async function checkNameAvailability(input: unknown) {
  const data = parseInput(CheckNameInputSchema, input);
  const normalizedName = normalizeMemberName(data.name);
  const existingCards = await repo.findLoyaltyCardsForMemberCheck();
  const isTaken = existingCards.some(
    (card) => normalizeMemberName(card.customerName) === normalizedName,
  );
  return { available: !isTaken, name: normalizedName };
}

// ---------------------------------------------------------------------------
// Cards listing
// ---------------------------------------------------------------------------

export async function listCards() {
  const cards = await repo.findLoyaltyCardsWithVouchersAndCategory();
  const allSettings = await repo.findLoyaltySettingsWithCategory();
  const settingsMap = new Map(allSettings.map((s) => [s.categoryId, s]));
  const firstSetting = allSettings[0];

  return cards.map((card) => {
    const activeVouchers = card.vouchers.filter((v: any) => v.status === 'ACTIVE').length;
    const redeemedVouchers = card.vouchers
      .filter((v: any) => v.status === 'REDEEMED')
      .sort(
        (a: any, b: any) =>
          new Date(b.redeemedDate || 0).getTime() - new Date(a.redeemedDate || 0).getTime(),
      );
    const lastRedeemedDate = redeemedVouchers.length > 0 ? redeemedVouchers[0].redeemedDate : null;
    const specificSetting = settingsMap.get(card.categoryId);
    const threshold = specificSetting?.coffeesRequiredForFree || firstSetting?.coffeesRequiredForFree || 10;
    const normalizedName = (card.customerName || '').trim().toUpperCase();

    return {
      id: card.id,
      customerName: normalizedName,
      membershipCode: card.membershipCode || null,
      memberSince: card.memberSince || null,
      categoryId: card.categoryId,
      categoryName: specificSetting?.category?.name || card.category?.name || 'Global',
      coffeesCompleted: card.paidCoffeesCount,
      loyaltyPoints: card.loyaltyPoints ?? 0,
      coffeesRequiredForFree: threshold,
      rewardsAvailable: activeVouchers,
      lastRewardRedeemDate: lastRedeemedDate,
    };
  });
}

// ---------------------------------------------------------------------------
// Cards by customer (GET, POST add-coffees, PATCH rename, DELETE)
// ---------------------------------------------------------------------------

export async function getCardsByCustomer(input: unknown) {
  const data = parseInput(
    z.object({
      customerName: z.string().min(1),
      categoryId: z.number().int().positive().optional(),
    }),
    input,
  );

  const normalizedCustomerName = normalizeMemberName(data.customerName);

  if (data.categoryId) {
    const targetId = data.categoryId;
    const allCards = await repo.findLoyaltyCardsAll();
    let card = allCards.find(
      (c) => normalizeMemberName(c.customerName) === normalizedCustomerName,
    ) || null;

    if (!card) {
      card = await repo.createLoyaltyCardDetailed(
        { customerName: normalizedCustomerName, categoryId: targetId },
      );
    }

    const settings = await repo.findLoyaltySettingUniqueByCategoryId(targetId);
    return formatCard(card, settings);
  }

  const cards = await repo.findLoyaltyCardsAll();
  const matchingCards = cards.filter(
    (c) => normalizeMemberName(c.customerName) === normalizedCustomerName,
  );
  const allSettings = await repo.findLoyaltySettingsAll();

  return matchingCards.map((c) => {
    const s = allSettings.find((s) => s.categoryId === c.categoryId);
    return formatCard(c, s);
  });
}

export async function addCoffees(input: unknown, approvedById: number) {
  const data = parseInput(AddCoffeesInputSchema, input);
  const normalizedCustomerName = normalizeMemberName(data.customerName);
  const targetCategoryId = data.categoryId ?? null;

  const settings =
    targetCategoryId !== null
      ? await repo.findLoyaltySettingUniqueByCategoryId(targetCategoryId)
      : await repo.findLoyaltySettingFirstGlobal();
  if (!settings || !settings.enabled) {
    const fallback = await repo.findEnabledLoyaltySetting();
    if (fallback) {
      Object.assign(settings ?? {}, fallback);
    }
  }
  if (!settings || !settings.enabled) {
    throw setErrorStatus(new Error('Loyalty not enabled for this category'), 400);
  }

  const effectiveCategoryId = settings.categoryId;

  let card;
  if (effectiveCategoryId !== null) {
    card = await repo.findLoyaltyCardByNameAndCategory(normalizedCustomerName, effectiveCategoryId);
    if (!card) {
      card = await repo.createLoyaltyCardDetailed({
        customerName: normalizedCustomerName,
        categoryId: effectiveCategoryId,
      });
    }
  } else {
    card = await repo.findLoyaltyCardByNameAndCategory(normalizedCustomerName, null);
    if (!card) {
      card = await repo.createLoyaltyCardDetailed({
        customerName: normalizedCustomerName,
        categoryId: null,
      });
    }
  }

  const isMilestoneMode = settings.isMilestoneMode;
  const milestones = JSON.parse(settings.milestones || '[]');
  let threshold = settings.coffeesRequiredForFree;
  if (isMilestoneMode && milestones.length > 0) {
    threshold = Math.max(...milestones.map((m: any) => m.target));
  }

  let currentCount = card.paidCoffeesCount;
  let claimedMilestones = JSON.parse(card.claimedMilestones || '[]');
  const vouchersCreated: any[] = [];
  const tempCount = currentCount + data.quantity;

  if (!isMilestoneMode) {
    if (tempCount >= threshold) {
      const voucher = await repo.createLoyaltyVoucher({
        code: voucherCode('REWARD'),
        customerName: normalizedCustomerName,
        cardId: card.id,
        discountType: settings.rewardType,
        discountValue: settings.rewardValue,
        rewardName: rewardLabel(settings.rewardType, settings.rewardValue),
        targetType: 'CATEGORY',
        targetCategoryId: effectiveCategoryId ?? undefined,
        status: 'ACTIVE',
      });
      vouchersCreated.push(voucher);
      currentCount = Math.max(0, tempCount - threshold);
      claimedMilestones = [];
    } else {
      currentCount = tempCount;
    }
  } else {
    for (const milestone of milestones.sort((a: any, b: any) => a.target - b.target)) {
      if (tempCount >= milestone.target && !claimedMilestones.includes(milestone.target)) {
        const voucher = await repo.createLoyaltyVoucher({
          code: voucherCode(`MIL-T${milestone.target}`),
          customerName: normalizedCustomerName,
          cardId: card.id,
          discountType: milestone.rewardType,
          discountValue: milestone.rewardValue,
          rewardName: rewardLabel(milestone.rewardType, milestone.rewardValue),
          targetType: 'CATEGORY',
          targetCategoryId: effectiveCategoryId ?? undefined,
          status: 'ACTIVE',
        });
        vouchersCreated.push(voucher);
        claimedMilestones.push(milestone.target);
      }
    }
    if (tempCount >= threshold) {
      currentCount = Math.max(0, tempCount - threshold);
      claimedMilestones = [];
    } else {
      currentCount = tempCount;
    }
  }

  const updatedCard = await repo.updateLoyaltyCardPaidCoffeesCount(card.id, {
    paidCoffeesCount: currentCount,
  });

  const updatedCardWithPoints = await repo.incrementLoyaltyCardLoyaltyPoints(card.id, data.quantity);

  await repo.updateLoyaltyCardAwardState(card.id, {
    paidCoffeesCount: currentCount,
    claimedMilestones: JSON.stringify(claimedMilestones),
  });

  await repo.createLoyaltyTransaction({
    cardId: card.id,
    orderId: 0,
    type: 'EARNED',
    points: data.quantity,
    description: 'Points added manually from loyalty card page',
  });

  await logAction({
    action: 'LOYALTY_POINTS_ADD',
    resource: 'loyalty_card',
    resourceId: card.id,
    details: { customerName: normalizedCustomerName, quantity: data.quantity, vouchersCreated: vouchersCreated.length },
  });

  return {
    success: true,
    card: formatCard(updatedCardWithPoints, settings),
    vouchersCreated: vouchersCreated.length,
  };
}

export async function renameCard(input: unknown, approvedById: number) {
  const data = parseInput(RenameCardInputSchema, input);
  const normalizedCustomerName = normalizeMemberName(data.customerName);
  const normalizedNewName = normalizeMemberName(data.newName);

  if (normalizedNewName === normalizedCustomerName) {
    return { success: true };
  }

  const allCustomerCards = await repo.findLoyaltyCardsAllNames();
  const duplicateCard = allCustomerCards.find(
    (card) =>
      normalizeMemberName(card.customerName) === normalizedNewName &&
      normalizeMemberName(card.customerName) !== normalizedCustomerName,
  );
  if (duplicateCard) {
    throw setErrorStatus(new Error('Another member already uses this name.'), 409);
  }

  const targetCards = allCustomerCards.filter(
    (card) => normalizeMemberName(card.customerName) === normalizedCustomerName,
  );
  if (targetCards.length === 0) {
    throw setErrorStatus(new Error('Member not found'), 404);
  }

  const oldNames = targetCards.map((c) => c.customerName);

  await Promise.all(
    targetCards.map((card) =>
      repo.updateLoyaltyCardPaidCoffeesCount(card.id, { paidCoffeesCount: card.paidCoffeesCount }),
    ),
  );

  const matchingVouchers = await repo.findLoyaltyVouchersByCustomerNames(oldNames);
  await Promise.all(
    matchingVouchers.map((voucher) =>
      repo.updateLoyaltyVoucherByCode(voucher.code, { customerName: normalizedNewName }),
    ),
  );

  await logAction({
    action: 'LOYALTY_CARD_RENAME',
    resource: 'loyalty_card',
    details: { oldName: normalizedCustomerName, newName: normalizedNewName, cardsUpdated: targetCards.length, vouchersUpdated: matchingVouchers.length },
  });

  return { success: true };
}

export async function deleteCard(input: unknown, approvedById: number) {
  const data = parseInput(DeleteCardInputSchema, input);
  const normalizedCustomerName = normalizeMemberName(data.customerName);

  const cards = await repo.findLoyaltyCardsAllNames();
  const matchingCards = cards.filter(
    (c) => normalizeMemberName(c.customerName) === normalizedCustomerName,
  );
  const cardIds = matchingCards.map((c) => c.id);

  if (cardIds.length === 0) {
    throw setErrorStatus(new Error('Member not found'), 404);
  }

  await repo.deleteLoyaltyVouchersByCardIds(cardIds);

  await Promise.all(
    cardIds.map((id) => repo.deleteLoyaltyCard(id)),
  );

  await logAction({
    action: 'LOYALTY_CARD_DELETE',
    resource: 'loyalty_card',
    details: { customerName: normalizedCustomerName, cardsDeleted: cardIds.length },
  });

  return { success: true };
}

// ---------------------------------------------------------------------------
// Settings management
// ---------------------------------------------------------------------------

export async function listSettings(categoryId?: number | null) {
  if (categoryId) {
    const settings = await repo.findLoyaltySettingUniqueByCategoryId(categoryId);
    if (!settings) {
      throw setErrorStatus(new Error('Loyalty settings not found for this category'), 404);
    }
    return formatSettings(settings);
  }

  const allSettings = await repo.findLoyaltySettingsWithCategory();
  return allSettings.map(formatSettings);
}

export async function upsertSetting(input: unknown) {
  const data = parseInput(UpdateSettingInputSchema, input);

  if (data.coffeesRequiredForFree !== undefined && data.coffeesRequiredForFree < 1) {
    throw setErrorStatus(new Error('Threshold must be at least 1'), 400);
  }

  if (data.id) {
    const existing = await repo.findLoyaltySettingById(data.id);
    if (!existing) {
      throw setErrorStatus(new Error('Loyalty setting not found'), 404);
    }
    try {
      const updated = await repo.updateLoyaltySetting(data.id, {
        categoryId: data.categoryId == null ? null : data.categoryId,
        coffeesRequiredForFree: data.coffeesRequiredForFree,
        enabled: data.enabled,
        cardColor: data.cardColor,
        cardTitle: data.cardTitle,
        cardDescription: data.cardDescription,
        rewardType: data.rewardType,
        rewardValue: data.rewardValue,
        isMilestoneMode: data.isMilestoneMode,
        milestones: data.milestones ? JSON.stringify(data.milestones) : undefined,
        maxHeldRewards: data.maxHeldRewards != null ? data.maxHeldRewards : undefined,
      });
      return formatSettings(updated);
    } catch (e: any) {
      if (e.code === 'P2002') {
        throw setErrorStatus(new Error('Loyalty module already exists for this category'), 409);
      }
      throw e;
    }
  }

  const targetCatId = data.categoryId == null
    ? null
    : data.categoryId ?? null;

  if (targetCatId !== null) {
    const existing = await repo.findLoyaltySettingUniqueByCategoryId(targetCatId);
    if (existing) {
      throw setErrorStatus(new Error('A loyalty module already exists for this category'), 409);
    }
  }

  try {
    const created = await repo.createLoyaltySetting({
      categoryId: targetCatId,
      coffeesRequiredForFree: data.coffeesRequiredForFree ?? 10,
      enabled: data.enabled ?? true,
      cardColor: data.cardColor ?? '#8B4513',
      cardTitle: data.cardTitle ?? 'Loyalty Card',
      cardDescription: data.cardDescription ?? 'Earn rewards',
      rewardType: data.rewardType ?? 'FREE',
      rewardValue: data.rewardValue ?? 0,
      isMilestoneMode: data.isMilestoneMode ?? false,
      milestones: data.milestones ? JSON.stringify(data.milestones) : '[]',
      maxHeldRewards: data.maxHeldRewards ?? 3,
    });
    return formatSettings(created);
  } catch (e: any) {
    if (e.code === 'P2002') {
      throw setErrorStatus(new Error('A loyalty module already exists for this category'), 409);
    }
    throw e;
  }
}

export async function deleteSetting(input: unknown) {
  const data = parseInput(DeleteSettingInputSchema, input);
  const setting = await repo.findLoyaltySettingById(data.id);
  if (!setting) {
    throw setErrorStatus(new Error('Loyalty setting not found'), 404);
  }
  await repo.deleteLoyaltySetting(data.id);
  return { success: true };
}

// ---------------------------------------------------------------------------
// Voucher operations
// ---------------------------------------------------------------------------

export async function getVoucher(code: string) {
  const voucher = await repo.findLoyaltyVoucherByCode(code);
  if (!voucher) {
    throw setErrorStatus(new Error(`Voucher not found: ${code}`), 404);
  }
  return {
    code: voucher.code,
    customerName: voucher.customerName,
    issuedDate: voucher.issuedDate,
    isActive: voucher.status === 'ACTIVE',
  };
}

export async function markVoucherRedeemed(input: unknown) {
  const data = parseInput(RedeemVoucherInputSchema, input);

  const voucher = await repo.findLoyaltyVoucherByCode(data.code);
  if (!voucher) {
    return { error: `Voucher not found: ${data.code}`, valid: false, status: 404 };
  }

  if (voucher.status !== 'ACTIVE') {
    return {
      error: 'Voucher not active or already used',
      valid: false,
      status: 400,
      redeemedDate: voucher.redeemedDate,
    };
  }

  await repo.updateLoyaltyVoucherByCode(data.code, {
    status: 'REDEEMED',
    redeemedDate: new Date(),
    redeemedOrderId: data.orderId ?? null,
  });

  return {
    code: data.code,
    message: `Voucher ${data.code} successfully redeemed`,
    counterReset: false,
  };
}

export async function validateVoucher(code: string) {
  const voucher = await repo.findLoyaltyVoucherWithCardAndCategory(code);
  if (!voucher) {
    return { valid: false, error: 'Voucher not found', status: 404 };
  }

  const result: { valid: boolean; voucher?: any; validationErrors: string[] } = {
    valid: true,
    validationErrors: [],
  };

  if (voucher.status === 'REDEEMED') {
    result.valid = false;
    result.validationErrors.push('Already redeemed');
  }

  if (voucher.expiryDate && new Date(voucher.expiryDate) < new Date()) {
    result.valid = false;
    result.validationErrors.push('Expired');
  }

  if (voucher.usedCount >= voucher.maxRedemptions) {
    result.valid = false;
    result.validationErrors.push('Usage limit reached');
  }

  result.voucher = {
    code: voucher.code,
    rewardName: voucher.rewardName,
    discountType: voucher.discountType,
    discountValue: voucher.discountValue,
    minPurchase: voucher.minPurchase,
    validDays: voucher.validDays,
    targetType: voucher.targetType || 'CATEGORY',
    targetCategoryId: voucher.loyaltyCard?.categoryId || null,
    categoryName: voucher.loyaltyCard?.category?.name || 'All Items',
    expiryDate: voucher.expiryDate,
    maxRedemptions: voucher.maxRedemptions,
    usedCount: voucher.usedCount,
    remainingUses: voucher.maxRedemptions - voucher.usedCount,
  };

  return result;
}

export async function applyVoucher(input: unknown) {
  const data = parseInput(
    z.object({
      code: z.string(),
      orderId: z.number().optional(),
      orderTotal: z.number().nonnegative().optional(),
      items: z.array(z.record(z.string(), z.unknown())).optional(),
    }),
    input,
  );

  const voucher = await repo.findLoyaltyVoucherByCode(data.code);
  if (!voucher) {
    return { error: 'Voucher not found', valid: false, status: 404 };
  }

  if (voucher.status === 'REDEEMED') {
    return { error: 'Voucher already redeemed', valid: false, status: 400, redeemedDate: voucher.redeemedDate };
  }

  if (voucher.expiryDate && new Date(voucher.expiryDate) < new Date()) {
    await repo.updateLoyaltyVoucherByCode(data.code, { status: 'EXPIRED' });
    return { error: 'Voucher has expired', valid: false, status: 400, expiryDate: voucher.expiryDate };
  }

  if (voucher.usedCount >= voucher.maxRedemptions) {
    return {
      error: 'Voucher usage limit reached',
      valid: false,
      status: 400,
      maxRedemptions: voucher.maxRedemptions,
      usedCount: voucher.usedCount,
    };
  }

  const orderAmount = data.orderTotal ?? 0;
  if (voucher.minPurchase > 0 && orderAmount < voucher.minPurchase) {
    return {
      error: `Minimum purchase of ₱${voucher.minPurchase} required`,
      valid: false,
      status: 400,
      minPurchase: voucher.minPurchase,
      orderTotal: orderAmount,
    };
  }

  if (voucher.validDays && data.items !== undefined) {
    const days = ['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT'];
    const today = days[new Date().getDay()];

    if (voucher.validDays === 'WEEKENDS') {
      if (today !== 'SAT' && today !== 'SUN') {
        return { error: 'Voucher only valid on weekends', valid: false, status: 400, validDays: voucher.validDays };
      }
    } else if (voucher.validDays === 'WEEKDAYS') {
      if (today === 'SAT' || today === 'SUN') {
        return { error: 'Voucher only valid on weekdays', valid: false, status: 400, validDays: voucher.validDays };
      }
    } else if (!voucher.validDays.includes(today)) {
      return { error: `Voucher not valid today (${today})`, valid: false, status: 400, validDays: voucher.validDays };
    }
  }

  if (voucher.targetType === 'CATEGORY' && voucher.targetCategoryId && data.items) {
    const hasEligible = data.items.some(
      (item: any) => item.categoryId === voucher.targetCategoryId,
    );
    if (!hasEligible) {
      return { error: 'Voucher not valid for items in cart', valid: false, status: 400, targetType: 'CATEGORY', targetCategoryId: voucher.targetCategoryId };
    }
  }

  if (voucher.targetType === 'PRODUCT' && voucher.targetProductId && data.items) {
    const hasEligible = data.items.some(
      (item: any) => item.productId === voucher.targetProductId,
    );
    if (!hasEligible) {
      return { error: 'Voucher not valid for items in cart', valid: false, status: 400, targetType: 'PRODUCT', targetProductId: voucher.targetProductId };
    }
  }

  let discount = 0;
  if (voucher.discountType === 'PERCENTAGE') {
    discount = (orderAmount * voucher.discountValue) / 100;
  } else if (voucher.discountType === 'FIXED_AMOUNT') {
    discount = Math.min(voucher.discountValue, orderAmount);
  }

  const newUsedCount = voucher.usedCount + 1;
  const isFullyRedeemed = newUsedCount >= voucher.maxRedemptions;

  await repo.updateLoyaltyVoucherByCode(data.code, {
    status: isFullyRedeemed ? 'REDEEMED' : 'ACTIVE',
    redeemedDate: isFullyRedeemed ? new Date() : undefined,
    redeemedOrderId: data.orderId ?? null,
    usedCount: newUsedCount,
  });

  return {
    valid: true,
    discount,
    discountType: voucher.discountType,
    discountValue: voucher.discountValue,
    rewardName: voucher.rewardName,
    usedCount: newUsedCount,
    remainingUses: voucher.maxRedemptions - newUsedCount,
    message: `Voucher applied: ${voucher.rewardName}`,
  };
}

export async function claimReward(input: unknown) {
  const data = parseInput(
    z.object({
      customerName: z.string(),
      voucherCodes: z.array(z.string()).min(1),
      orderId: z.number().optional(),
    }),
    input,
  );

  const vouchers = await repo.findLoyaltyVouchersByCodesAndCustomer(
    data.voucherCodes,
    normalizeMemberName(data.customerName),
  );

  if (vouchers.length !== data.voucherCodes.length) {
    throw setErrorStatus(new Error('Some vouchers not found or do not belong to you'), 404);
  }

  const allActive = vouchers.every((v) => v.status === 'ACTIVE');
  if (!allActive) {
    throw setErrorStatus(new Error('Some vouchers are not active'), 400);
  }

  await repo.deleteLoyaltyVouchersByCodes(data.voucherCodes);

  if (data.orderId) {
    await repo.updateOrderLoyaltyPromo(data.orderId);
  }

  return {
    success: true,
    claimedCount: data.voucherCodes.length,
    message: `${data.voucherCodes.length} voucher(s) successfully redeemed and removed`,
  };
}

export async function createVoucher(input: unknown, approvedById: number) {
  const data = parseInput(CreateVoucherInputSchema, input);

  const finalCustomerName = data.customerName?.trim() || 'PROMO';

  const finalRewardName = data.rewardName || rewardLabel(data.discountType || 'FREE', data.discountValue ?? 0);
  const code = voucherCode('PROMO');

  const voucher = await repo.createLoyaltyVoucher({
    code,
    customerName: finalCustomerName,
    discountType: data.discountType ?? 'FREE',
    discountValue: data.discountValue ?? 0,
    rewardName: finalRewardName,
    minPurchase: data.minPurchase ?? 0,
    maxRedemptions: data.maxRedemptions ?? 1,
    usedCount: 0,
    validDays: data.validDays ?? null,
    targetType: data.targetType ?? 'ALL',
    targetCategoryId: data.targetCategoryId ?? null,
    targetProductId: data.targetProductId ?? null,
    expiryDate: data.expiryDate ? new Date(data.expiryDate) : null,
    status: 'ACTIVE',
  });

  return {
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
    message: `Created voucher ${code}`,
  };
}

export async function listVouchers(input: unknown) {
  const data = parseInput(
    z.object({
      customerName: z.string().optional(),
    }),
    input,
  );

  if (data.customerName) {
    return await repo.findLoyaltyVouchersLimited(data.customerName, 100);
  }
  return repo.findLoyaltyVouchersLimited(null, 100);
}

export async function generateRewards(input: unknown) {
  const data = parseInput(z.object({ customerName: z.string().min(1) }), input);

  const card = await repo.findLoyaltyCardByNameAndCategory(data.customerName, null);
  if (!card) {
    return {
      customerName: data.customerName,
      totalEarned: 0,
      activeVouchers: 0,
      vouchersCreated: 0,
      message: 'Customer not found',
      status: 404,
    };
  }

  const settings = await repo.findFirstLoyaltySetting();
  const coffeesRequired = settings?.coffeesRequiredForFree || 10;
  const rewardType = settings?.rewardType || 'FREE';
  const rewardValue = settings?.rewardValue || 0;
  const rewardName = rewardLabel(rewardType, rewardValue);

  const totalEarned = Math.floor((card.paidCoffeesCount ?? 0) / coffeesRequired);
  const activeVouchers = card.vouchers?.filter((v: any) => v.status === 'ACTIVE') ?? [];
  const activeCouponCount = activeVouchers.length;
  const vouchersToCreate = Math.max(0, totalEarned - activeCouponCount);

  if (vouchersToCreate <= 0) {
    return {
      customerName: data.customerName,
      paidCoffeesCount: card.paidCoffeesCount ?? 0,
      totalEarned,
      activeVouchers: activeCouponCount,
      vouchersCreated: 0,
      rewardType,
      rewardValue,
      rewardName,
      message:
        activeCouponCount === 0 && totalEarned === 0
          ? 'No rewards earned yet'
          : 'All rewards already generated',
    };
  }

  const generatedCodes: string[] = [];
  for (let i = 0; i < vouchersToCreate; i++) {
    const code = voucherCode('CAFE');
    await repo.createLoyaltyVoucher({
      code,
      customerName: data.customerName,
      discountType: rewardType,
      discountValue: rewardValue,
      rewardName,
      status: 'ACTIVE',
    });
    generatedCodes.push(code);
  }

  return {
    customerName: data.customerName,
    paidCoffeesCount: card.paidCoffeesCount ?? 0,
    coffeesRequired,
    totalEarned,
    previousActiveVouchers: activeCouponCount,
    newActiveVouchers: activeCouponCount + vouchersToCreate,
    vouchersCreated: vouchersToCreate,
    generatedCodes,
    rewardType,
    rewardValue,
    rewardName,
    message: `Generated ${vouchersToCreate} new voucher(s)`,
  };
}

export async function getVoucherHistory() {
  const vouchers = await repo.findVouchersWithCard();
  const orders = await repo.findOrdersForNumberMap();
  const orderMap = new Map(orders.map((o) => [o.id, o.orderNumber]));

  const voucherRecords = vouchers.map((v) => ({
    id: v.id,
    code: v.code,
    customerName: v.customerName,
    status: v.status,
    issuedDate: v.issuedDate.toISOString(),
    redeemedDate: v.redeemedDate ? v.redeemedDate.toISOString() : null,
    redeemedOrderId: v.redeemedOrderId,
    orderNumber: v.redeemedOrderId ? orderMap.get(v.redeemedOrderId) ?? null : null,
  }));

  const totalIssued = voucherRecords.length;
  const totalRedeemed = voucherRecords.filter((v) => v.status === 'REDEEMED').length;
  const conversionRate = totalIssued > 0 ? totalRedeemed / totalIssued : 0;
  const pendingVouchers = voucherRecords.filter((v) => v.status === 'ACTIVE').length;

  const redeemedVouchers = voucherRecords.filter((v) => v.redeemedDate);
  let averageDaysToRedeem = 0;
  if (redeemedVouchers.length > 0) {
    const daysArray = redeemedVouchers.map((v) => {
      const issued = new Date(v.issuedDate).getTime();
      const redeemed = new Date(v.redeemedDate!).getTime();
      return (redeemed - issued) / (1000 * 60 * 60 * 24);
    });
    averageDaysToRedeem = daysArray.reduce((a, b) => a + b, 0) / daysArray.length;
  }

  return {
    vouchers: voucherRecords,
    stats: {
      totalIssued,
      totalRedeemed,
      conversionRate,
      averageDaysToRedeem,
      pendingVouchers,
    },
  };
}

// ---------------------------------------------------------------------------
// Customer analytics (loyalty customers route)
// ---------------------------------------------------------------------------

function getCustomerTier(
  lifetimeValue: number,
  totalOrders: number,
  daysSinceLastOrder: number,
  avgLifetimeValue: number,
): 'VIP' | 'REGULAR' | 'CASUAL' | 'AT_RISK' {
  if (lifetimeValue >= avgLifetimeValue * 2 && daysSinceLastOrder <= 30) return 'VIP';
  if (daysSinceLastOrder > 60) return 'AT_RISK';
  if (totalOrders >= 5 && lifetimeValue >= avgLifetimeValue * 0.7) return 'REGULAR';
  return 'CASUAL';
}

function getVisitFrequency(totalOrders: number, daysSinceFirstOrder: number): 'HIGH' | 'MEDIUM' | 'LOW' {
  if (daysSinceFirstOrder === 0) return 'LOW';
  const ordersPerDay = totalOrders / daysSinceFirstOrder;
  if (ordersPerDay >= 0.14) return 'HIGH';
  if (ordersPerDay >= 0.02) return 'MEDIUM';
  return 'LOW';
}

export async function getCustomerAnalytics() {
  const loyaltyCards = await repo.findLoyaltyCategoriesWithOrders();
  const allOrders = await repo.findOrdersForCustomerAnalytics();

  const customerMap = new Map<string, any>();
  const now = new Date();

  loyaltyCards.forEach((card) => {
    if (!customerMap.has(card.customerName)) {
      customerMap.set(card.customerName, {
        customerName: card.customerName,
        tier: 'CASUAL',
        lifetimeValue: 0,
        totalOrders: 0,
        averageOrderValue: 0,
        vouchersIssued: 0,
        vouchersRedeemed: 0,
        coffeeProgress: 0,
        coffeesClaimed: 0,
        lastOrderDate: null,
        firstOrderDate: card.createdAt.toISOString(),
        daysSinceLastOrder: 0,
        visitFrequency: 'LOW',
      });
    }

    const customer = customerMap.get(card.customerName);
    customer.coffeeProgress = Math.max(customer.coffeeProgress, card.paidCoffeesCount);
    customer.vouchersIssued += card.vouchers.length;
    customer.vouchersRedeemed += card.vouchers.filter((v: any) => v.status === 'REDEEMED').length;
    customer.coffeesClaimed += card.vouchers.filter((v: any) => v.status === 'REDEEMED').length;

    if (new Date(customer.firstOrderDate) > new Date(card.createdAt)) {
      customer.firstOrderDate = card.createdAt.toISOString();
    }
  });

  allOrders.forEach((order) => {
    if (!customerMap.has(order.customerName)) {
      customerMap.set(order.customerName, {
        customerName: order.customerName,
        tier: 'CASUAL',
        lifetimeValue: 0,
        totalOrders: 0,
        averageOrderValue: 0,
        vouchersIssued: 0,
        vouchersRedeemed: 0,
        coffeeProgress: 0,
        coffeesClaimed: 0,
        lastOrderDate: null,
        firstOrderDate: order.createdAt.toISOString(),
        daysSinceLastOrder: 0,
        visitFrequency: 'LOW',
      });
    }

    const customer = customerMap.get(order.customerName);
    customer.lifetimeValue += order.totalAmount;
    customer.totalOrders += 1;

    if (!customer.lastOrderDate || new Date(order.createdAt) > new Date(customer.lastOrderDate)) {
      customer.lastOrderDate = order.createdAt.toISOString();
    }

    customer.daysSinceLastOrder = Math.floor(
      (now.getTime() - new Date(customer.lastOrderDate).getTime()) / (1000 * 60 * 60 * 24),
    );

    if (new Date(order.createdAt) < new Date(customer.firstOrderDate)) {
      customer.firstOrderDate = order.createdAt.toISOString();
    }
  });

  const customers = Array.from(customerMap.values());

  customers.forEach((customer) => {
    customer.averageOrderValue = customer.totalOrders > 0
      ? customer.lifetimeValue / customer.totalOrders
      : 0;
    const daysSinceFirst = Math.max(
      1,
      Math.floor((now.getTime() - new Date(customer.firstOrderDate).getTime()) / (1000 * 60 * 60 * 24)),
    );
    customer.visitFrequency = getVisitFrequency(customer.totalOrders, daysSinceFirst);
  });

  const avgLifetimeValue = customers.length > 0
    ? customers.reduce((sum, c) => sum + c.lifetimeValue, 0) / customers.length
    : 0;

  customers.forEach((customer) => {
    customer.tier = getCustomerTier(
      customer.lifetimeValue,
      customer.totalOrders,
      customer.daysSinceLastOrder,
      avgLifetimeValue,
    );
  });

  const vipCount = customers.filter((c) => c.tier === 'VIP').length;
  const regularCount = customers.filter((c) => c.tier === 'REGULAR').length;
  const casualCount = customers.filter((c) => c.tier === 'CASUAL').length;
  const atRiskCount = customers.filter((c) => c.tier === 'AT_RISK').length;
  const activeCount = vipCount + regularCount + casualCount;

  const tierDistribution = [
    { name: 'VIP', count: vipCount, value: 0 },
    { name: 'Regular', count: regularCount, value: 0 },
    { name: 'Casual', count: casualCount, value: 0 },
    { name: 'At Risk', count: atRiskCount, value: 0 },
  ];

  return {
    customers: customers.sort((a, b) => b.lifetimeValue - a.lifetimeValue),
    stats: {
      vipCount,
      regularCount,
      casualCount,
      atRiskCount,
      totalCustomers: customers.length,
      avgLifetimeValue,
      retentionRate: customers.length > 0 ? activeCount / customers.length : 0,
      churnRate: customers.length > 0 ? atRiskCount / customers.length : 0,
      tierDistribution,
    },
  };
}
