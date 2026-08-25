export interface CartLineItem {
  productId: number;
  price: number;
  quantity: number;
  categoryId?: number;
}

export interface LoyaltyVoucherDiscountTarget {
  code: string;
  discountType: string;
  discountValue: number;
  targetCategoryId: number | null;
}

export function calculateLoyaltyDiscountForItems(
  items: CartLineItem[],
  vouchers: LoyaltyVoucherDiscountTarget[],
  selectedItemsForDiscount: Record<string, number>
): number {
  const cartTotal = items.reduce((sum, item) => sum + item.price * item.quantity, 0);

  let totalDiscount = 0;

  for (const voucher of vouchers) {
    const eligibleItems = items.filter(
      (item) => !voucher.targetCategoryId || item.categoryId === voucher.targetCategoryId
    );

    if (eligibleItems.length === 0) {
      continue;
    }

    const selectedProductId = selectedItemsForDiscount[voucher.code];
    const targetItem =
      eligibleItems.find((item) => item.productId === selectedProductId) ??
      eligibleItems.reduce((maxItem, item) =>
        item.price > maxItem.price ? item : maxItem
      );

    if (!targetItem) {
      continue;
    }

    if (voucher.discountType === 'FREE') {
      totalDiscount += targetItem.price;
    } else if (voucher.discountType === 'PERCENTAGE') {
      totalDiscount += (targetItem.price * voucher.discountValue) / 100;
    } else if (voucher.discountType === 'FIXED_AMOUNT') {
      totalDiscount += Math.min(voucher.discountValue, targetItem.price);
    }
  }

  return Math.min(totalDiscount, cartTotal);
}
