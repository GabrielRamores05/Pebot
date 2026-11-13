/**
 * The bill for one order (spec 017). The POS terminal and the server both use
 * this, so the total a cashier collects is the total that is saved.
 *
 * Order of steps: items → loyalty reward → discount → service charge.
 *
 * Item prices are VAT-inclusive on a VAT-registered business. Senior Citizen
 * and PWD discounts (RA 9994, RA 10754) remove VAT from the holders' share of
 * VAT-able items first, then take 20% off the VAT-exclusive price; that share
 * becomes a VAT-exempt sale. Group meals are split by headcount.
 */

export const STATUTORY_DISCOUNT_RATE = 20;

export type DiscountKind = 'SENIOR' | 'PWD' | 'STUDENT';

export type CheckoutDiscount =
  | { kind: 'SENIOR' | 'PWD'; holders: number; diners: number }
  | { kind: 'STUDENT'; rate: number };

export interface CheckoutLine {
  /** Line total (unit price × quantity), VAT-inclusive when VAT-registered. */
  amount: number;
  vatExempt: boolean;
}

export interface CheckoutInput {
  lines: CheckoutLine[];
  /** Peso value of loyalty rewards on this order. */
  loyaltyDiscount?: number;
  discount?: CheckoutDiscount | null;
  vatRegistered: boolean;
  /** VAT percentage, e.g. 12. */
  vatRate: number;
  /** Already resolved for the order type (see serviceChargeRateFor); 0 = none. */
  serviceChargeRate?: number;
}

export interface CheckoutTotals {
  gross: number;
  loyaltyDiscount: number;
  discount: number;
  /** VAT taken off the Senior/PWD share before the discount. */
  vatRemoved: number;
  vatableSales: number;
  vatAmount: number;
  /** VAT-exempt sales; on a business that is not VAT-registered, all sales. */
  vatExemptSales: number;
  serviceCharge: number;
  total: number;
}

export class CheckoutError extends Error {
  status = 400;
}

const round2 = (n: number) => Math.round((n + Number.EPSILON) * 100) / 100;

function isStatutory(d: CheckoutDiscount | null | undefined): d is { kind: 'SENIOR' | 'PWD'; holders: number; diners: number } {
  return !!d && (d.kind === 'SENIOR' || d.kind === 'PWD');
}

export function computeCheckout(input: CheckoutInput): CheckoutTotals {
  const vatFactor = 1 + input.vatRate / 100;
  const lines = input.lines.map((l) => ({ amount: Math.max(0, l.amount), vatExempt: l.vatExempt }));
  const gross = round2(lines.reduce((s, l) => s + l.amount, 0));
  const discountInput = input.discount ?? null;

  const loyaltyDiscount = round2(Math.min(Math.max(0, input.loyaltyDiscount ?? 0), gross));
  if (isStatutory(discountInput) && loyaltyDiscount > 0) {
    throw new CheckoutError(
      'A Senior Citizen or PWD discount cannot be combined with a loyalty reward. Keep only one of them.',
    );
  }

  // Loyalty reward spread across the lines in proportion to their value.
  const afterLoyalty = gross > 0 ? (gross - loyaltyDiscount) / gross : 0;
  const reduced = lines.map((l) => ({ amount: l.amount * afterLoyalty, vatExempt: l.vatExempt }));

  let discount = 0;
  let vatRemoved = 0;
  let exempt = 0; // VAT-exempt (or non-VAT) amount after discounts

  if (isStatutory(discountInput)) {
    const { holders, diners } = discountInput;
    if (!Number.isInteger(holders) || !Number.isInteger(diners) || holders < 1 || diners < holders) {
      throw new CheckoutError('Enter how many diners have a Senior Citizen or PWD ID, and how many diners there are in total.');
    }
    const share = holders / diners;
    const rate = STATUTORY_DISCOUNT_RATE / 100;
    for (const l of reduced) {
      const qualifying = l.amount * share;
      const rest = l.amount - qualifying;
      const vatable = input.vatRegistered && !l.vatExempt;
      const base = vatable ? qualifying / vatFactor : qualifying;
      vatRemoved += qualifying - base;
      discount += base * rate;
      exempt += base * (1 - rate);
      if (!vatable) exempt += rest;
    }
  } else {
    const rate = discountInput?.kind === 'STUDENT' ? discountInput.rate : 0;
    if (!(rate >= 0 && rate <= 100)) throw new CheckoutError('The discount rate must be between 0 and 100%.');
    for (const l of reduced) {
      const off = (l.amount * rate) / 100;
      discount += off;
      if (!input.vatRegistered || l.vatExempt) exempt += l.amount - off;
    }
  }

  discount = round2(discount);
  vatRemoved = round2(vatRemoved);
  const afterDiscounts = round2(Math.max(0, gross - loyaltyDiscount - discount - vatRemoved));

  // Round once, then derive the rest so the parts always add up.
  let vatExemptSales: number;
  let vatableSales: number;
  let vatAmount: number;
  if (input.vatRegistered) {
    vatExemptSales = round2(Math.min(exempt, afterDiscounts));
    const vatPart = round2(afterDiscounts - vatExemptSales);
    vatableSales = round2(vatPart / vatFactor);
    vatAmount = round2(vatPart - vatableSales);
  } else {
    vatExemptSales = afterDiscounts;
    vatableSales = 0;
    vatAmount = 0;
  }

  const serviceRate = Math.max(0, input.serviceChargeRate ?? 0);
  const serviceCharge = round2((afterDiscounts * serviceRate) / 100);
  const total = round2(afterDiscounts + serviceCharge);

  return { gross, loyaltyDiscount, discount, vatRemoved, vatableSales, vatAmount, vatExemptSales, serviceCharge, total };
}

/** Service charge rate for an order type, from business settings; 0 when it doesn't apply. */
export function serviceChargeRateFor(
  settings: { serviceChargeRate?: number | null; serviceChargeOrderTypes?: string | null } | null | undefined,
  orderType: string,
): number {
  const rate = Number(settings?.serviceChargeRate ?? 0);
  if (!(rate > 0)) return 0;
  const types = String(settings?.serviceChargeOrderTypes ?? 'DINE_IN')
    .split(',')
    .map((t) => t.trim().toUpperCase())
    .filter(Boolean);
  return types.includes(orderType.toUpperCase()) ? rate : 0;
}
