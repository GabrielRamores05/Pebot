import { calculateLoyaltyDiscountForItems, type CartLineItem } from './pos-utils';

// The subset of LoyaltyVoucher the redemption rules actually depend on.
export interface RedeemableVoucher {
  code: string;
  status: string;
  discountType: string;
  discountValue: number;
  minPurchase: number;
  maxRedemptions: number;
  usedCount: number;
  validDays: string | null;
  targetType: string;
  targetCategoryId: number | null;
  targetProductId: number | null;
  expiryDate: Date | null;
}

const DAY_CODES = ['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT'] as const;

export function dayCode(date: Date): string {
  return DAY_CODES[date.getDay()];
}

/**
 * Why this voucher may not be used on this order, in the customer's words, or
 * null when it may. Same rules the /api/loyalty/vouchers/redeem endpoint
 * applies, kept pure so they can be checked before money is touched.
 */
export function voucherRejection(
  voucher: RedeemableVoucher,
  order: { items: CartLineItem[]; subtotal: number; now: Date },
): string | null {
  if (voucher.status !== 'ACTIVE') {
    return `Reward ${voucher.code} has already been used.`;
  }

  if (voucher.expiryDate && voucher.expiryDate < order.now) {
    return `Reward ${voucher.code} has expired.`;
  }

  if (voucher.usedCount >= voucher.maxRedemptions) {
    return `Reward ${voucher.code} has no uses left.`;
  }

  if (voucher.minPurchase > 0 && order.subtotal < voucher.minPurchase) {
    return `Reward ${voucher.code} needs a minimum spend of ₱${voucher.minPurchase.toFixed(2)}.`;
  }

  const today = dayCode(order.now);
  const isWeekend = today === 'SAT' || today === 'SUN';
  if (voucher.validDays === 'WEEKENDS' && !isWeekend) {
    return `Reward ${voucher.code} can only be used on weekends.`;
  }
  if (voucher.validDays === 'WEEKDAYS' && isWeekend) {
    return `Reward ${voucher.code} can only be used on weekdays.`;
  }
  if (
    voucher.validDays &&
    voucher.validDays !== 'WEEKENDS' &&
    voucher.validDays !== 'WEEKDAYS' &&
    !voucher.validDays.split(',').map((d) => d.trim()).includes(today)
  ) {
    return `Reward ${voucher.code} cannot be used today (${today}).`;
  }

  if (eligibleItems(voucher, order.items).length === 0) {
    return `Reward ${voucher.code} does not apply to anything in this order.`;
  }

  return null;
}

/** Items this voucher is allowed to discount, per its targeting rules. */
export function eligibleItems(voucher: RedeemableVoucher, items: CartLineItem[]): CartLineItem[] {
  if (voucher.targetType === 'PRODUCT' && voucher.targetProductId) {
    return items.filter((item) => item.productId === voucher.targetProductId);
  }
  if (voucher.targetType === 'CATEGORY' && voucher.targetCategoryId) {
    return items.filter((item) => item.categoryId === voucher.targetCategoryId);
  }
  return items;
}

export interface LoyaltyDiscountResult {
  /** Peso amount to take off the order. Never exceeds the item subtotal. */
  discount: number;
  /** Reasons the order must be refused, one per unusable voucher. */
  rejections: string[];
}

/**
 * The authoritative loyalty discount for an order: computed from the vouchers
 * as stored in the database and from server-resolved item prices, never from an
 * amount the client asked for.
 */
export function loyaltyDiscountFor(
  vouchers: RedeemableVoucher[],
  order: {
    items: CartLineItem[];
    /** Per-voucher choice of which item to discount: code -> productId. */
    selection?: Record<string, number>;
    now: Date;
  },
): LoyaltyDiscountResult {
  const subtotal = order.items.reduce((sum, item) => sum + item.price * item.quantity, 0);
  const rejections: string[] = [];

  for (const voucher of vouchers) {
    const rejection = voucherRejection(voucher, { items: order.items, subtotal, now: order.now });
    if (rejection) rejections.push(rejection);
  }

  if (rejections.length > 0) {
    return { discount: 0, rejections };
  }

  const discount = calculateLoyaltyDiscountForItems(
    order.items,
    vouchers.map((voucher) => ({
      code: voucher.code,
      discountType: voucher.discountType,
      discountValue: voucher.discountValue,
      // Product-targeted vouchers are pinned to their product by seeding the
      // selection below; the shared calculator only understands categories.
      targetCategoryId:
        voucher.targetType === 'CATEGORY' ? voucher.targetCategoryId : null,
    })),
    productTargetSelection(vouchers, order.selection ?? {}),
  );

  return { discount: Math.round(discount * 100) / 100, rejections: [] };
}

function productTargetSelection(
  vouchers: RedeemableVoucher[],
  selection: Record<string, number>,
): Record<string, number> {
  const merged = { ...selection };
  for (const voucher of vouchers) {
    if (voucher.targetType === 'PRODUCT' && voucher.targetProductId) {
      merged[voucher.code] = voucher.targetProductId;
    }
  }
  return merged;
}
