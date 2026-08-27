/** VAT percentage applied to non VAT-exempt items. */
export const VAT_RATE = 12;

export const MARGIN_TYPES = ['PERCENTAGE', 'FIXED'] as const;

/** Accept a caller-supplied margin type, falling back to PERCENTAGE. */
export function normalizeMarginType(value: unknown): string {
  return typeof value === 'string' && (MARGIN_TYPES as readonly string[]).includes(value)
    ? value
    : 'PERCENTAGE';
}

/** Peso value of the margin added on top of the capital cost. */
export function marginAmount(capitalCost: number, marginType: string, marginValue: number): number {
  return marginType === 'PERCENTAGE' ? (capitalCost * marginValue) / 100 : marginValue;
}

/** Selling price before VAT: capital cost plus the configured margin. */
export function basePrice(capitalCost: number, marginType: string, marginValue: number): number {
  return capitalCost + marginAmount(capitalCost, marginType, marginValue);
}

/** VAT charged on the base price (zero when the item is VAT-exempt). */
export function vatAmount(base: number, vatExempt: boolean): number {
  return vatExempt ? 0 : (base * VAT_RATE) / 100;
}

/** Final BIR selling price: capital cost + margin, plus VAT unless VAT-exempt. */
export function sellingPrice(
  capitalCost: number,
  marginType: string,
  marginValue: number,
  vatExempt: boolean
): number {
  const base = basePrice(capitalCost, marginType, marginValue);
  return base + vatAmount(base, vatExempt);
}
