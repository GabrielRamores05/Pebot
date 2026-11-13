export function normalizeMemberName(value: string): string {
  return value.trim().replace(/\s+/g, ' ').toUpperCase();
}

/**
 * How a reward reads to the person holding it: 'Free Item', '10% Off',
 * '₱50 Off'. Anything other than a free item or a percentage is money off.
 */
export function rewardLabel(rewardType: string | null | undefined, rewardValue: number): string {
  if (rewardType === 'FREE') return 'Free Item';
  if (rewardType === 'PERCENTAGE') return `${rewardValue}% Off`;
  return `₱${rewardValue} Off`;
}

/**
 * A voucher code unique to the moment it was issued, prefixed with what
 * earned it — e.g. `voucherCode('MIL-T10', 'G')` → `MIL-T10-G-l4k2p9-A7X2QM`.
 */
export function voucherCode(...prefixParts: (string | number)[]): string {
  const issued = Date.now().toString(36);
  const random = Math.random().toString(36).slice(2, 8).toUpperCase();
  return [...prefixParts, issued, random].join('-');
}

/**
 * Value of the items on an order that the loyalty program covers: the items in
 * each enabled program's category, or every item when an enabled program covers
 * the whole menu (no category). Used to estimate what rewards cost the business.
 */
export function loyaltyCoveredValue(
  items: { unitPrice: number; quantity: number; product: { categoryId: number | null } }[],
  settings: { enabled: boolean; categoryId: number | null }[],
): number {
  const enabled = settings.filter((s) => s.enabled);
  if (enabled.length === 0) return 0;
  const wholeMenu = enabled.some((s) => s.categoryId === null);
  const covered = new Set(enabled.map((s) => s.categoryId));
  return items
    .filter((item) => wholeMenu || covered.has(item.product.categoryId))
    .reduce((sum, item) => sum + item.unitPrice * item.quantity, 0);
}

export function findOrCreateCardData(customerName: string, categoryId: number | null) {
  return {
    customerName: normalizeMemberName(customerName),
    categoryId,
  };
}
