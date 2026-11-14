/**
 * End-of-day summary from one day's orders (spec 017, US5).
 * A management report, not a BIR Z-reading.
 */

export interface DayOrder {
  orderNumber: string;
  status: string;
  paymentMethod: string;
  orderType: string;
  totalAmount: number;
  grossAmount: number;
  loyaltyDiscount: number;
  discountAmount: number;
  discountReason: string | null;
  discountHolders: string | null;
  vatRemoved: number;
  vatableSales: number;
  vatAmount: number;
  vatExemptSales: number;
  serviceCharge: number;
  /** Payment was confirmed. Unpaid orders are not sales yet. */
  paid: boolean;
  /** Spec 020: set when a manager voided or refunded the order. */
  voidReason?: string | null;
  refundAmount?: number | null;
}

export interface DiscountHolderRecord {
  type: string;
  name: string;
  idNumber: string;
}

export interface DaySummary {
  orderCount: number;
  cancelled: { count: number; amount: number };
  /** Orders placed but never paid (for example a QR order nobody paid for). */
  unpaid: { count: number; amount: number };
  /** Voided or refunded orders with the reason (spec 020). */
  voids: { orderNumber: string; reason: string; refund: number }[];
  refundTotal: number;
  gross: number;
  loyaltyDiscount: number;
  discounts: {
    senior: number;
    pwd: number;
    seniorAndPwd: number;
    student: number;
    /** "Student/PWD" orders saved before spec 017 */
    legacyStudentPwd: number;
    other: number;
  };
  vatRemoved: number;
  serviceCharge: number;
  /** What was charged: the sum of order totals. */
  net: number;
  vat: { vatableSales: number; vatAmount: number; vatExemptSales: number };
  /** Orders saved before spec 017 carry no VAT breakdown. */
  ordersWithoutVatBreakdown: number;
  payments: { method: string; count: number; amount: number }[];
  orderTypes: { type: string; count: number; amount: number }[];
  statutory: {
    orderNumber: string;
    reason: string;
    holders: DiscountHolderRecord[];
    vatRemoved: number;
    discount: number;
    total: number;
  }[];
}

const round2 = (n: number) => Math.round((n + Number.EPSILON) * 100) / 100;

const STATUTORY_REASONS = new Set(['SENIOR', 'PWD', 'SENIOR_PWD']);

function discountBucket(reason: string | null): keyof DaySummary['discounts'] {
  switch (reason) {
    case 'SENIOR': return 'senior';
    case 'PWD': return 'pwd';
    case 'SENIOR_PWD': return 'seniorAndPwd';
    case 'STUDENT': return 'student';
    case 'STUDENT_PWD': return 'legacyStudentPwd';
    default: return 'other';
  }
}

function parseHolders(json: string | null): DiscountHolderRecord[] {
  if (!json) return [];
  try {
    const parsed = JSON.parse(json);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

/** An order saved before spec 017: no breakdown, so gross is rebuilt from total + discount. */
function isLegacy(o: DayOrder): boolean {
  return o.grossAmount === 0 && o.vatableSales === 0 && o.vatExemptSales === 0 && o.totalAmount > 0;
}

function addTo<K extends string>(map: Map<string, { count: number; amount: number }>, key: K, amount: number) {
  const row = map.get(key) ?? { count: 0, amount: 0 };
  row.count += 1;
  row.amount += amount;
  map.set(key, row);
}

export function summarizeDay(orders: DayOrder[]): DaySummary {
  const discounts: DaySummary['discounts'] = { senior: 0, pwd: 0, seniorAndPwd: 0, student: 0, legacyStudentPwd: 0, other: 0 };
  const payments = new Map<string, { count: number; amount: number }>();
  const orderTypes = new Map<string, { count: number; amount: number }>();
  const cancelled = { count: 0, amount: 0 };
  const unpaid = { count: 0, amount: 0 };
  const voids: DaySummary['voids'] = [];
  const statutory: DaySummary['statutory'] = [];
  let orderCount = 0;
  let gross = 0;
  let loyaltyDiscount = 0;
  let vatRemoved = 0;
  let serviceCharge = 0;
  let net = 0;
  let vatableSales = 0;
  let vatAmount = 0;
  let vatExemptSales = 0;
  let ordersWithoutVatBreakdown = 0;

  for (const o of orders) {
    if (o.status === 'CANCELLED') {
      cancelled.count += 1;
      cancelled.amount += o.totalAmount;
      if (o.voidReason) voids.push({ orderNumber: o.orderNumber, reason: o.voidReason, refund: round2(o.refundAmount ?? 0) });
      continue;
    }
    if (!o.paid) {
      unpaid.count += 1;
      unpaid.amount += o.totalAmount;
      continue;
    }
    orderCount += 1;
    const legacy = isLegacy(o);
    if (legacy) ordersWithoutVatBreakdown += 1;

    gross += legacy ? o.totalAmount + o.discountAmount : o.grossAmount;
    loyaltyDiscount += o.loyaltyDiscount;
    if (o.discountAmount > 0) discounts[discountBucket(o.discountReason)] += o.discountAmount;
    vatRemoved += o.vatRemoved;
    serviceCharge += o.serviceCharge;
    net += o.totalAmount;
    vatableSales += o.vatableSales;
    vatAmount += o.vatAmount;
    vatExemptSales += o.vatExemptSales;

    addTo(payments, o.paymentMethod || 'CASH', o.totalAmount);
    addTo(orderTypes, o.orderType || 'DINE_IN', o.totalAmount);

    if (o.discountReason && STATUTORY_REASONS.has(o.discountReason)) {
      statutory.push({
        orderNumber: o.orderNumber,
        reason: o.discountReason,
        holders: parseHolders(o.discountHolders),
        vatRemoved: round2(o.vatRemoved),
        discount: round2(o.discountAmount),
        total: round2(o.totalAmount),
      });
    }
  }

  const rows = <T extends string>(map: Map<string, { count: number; amount: number }>, key: T) =>
    [...map].map(([k, v]) => ({ [key]: k, count: v.count, amount: round2(v.amount) }) as { count: number; amount: number } & Record<T, string>);

  return {
    orderCount,
    cancelled: { count: cancelled.count, amount: round2(cancelled.amount) },
    unpaid: { count: unpaid.count, amount: round2(unpaid.amount) },
    voids,
    refundTotal: round2(voids.reduce((n, v) => n + v.refund, 0)),
    gross: round2(gross),
    loyaltyDiscount: round2(loyaltyDiscount),
    discounts: Object.fromEntries(Object.entries(discounts).map(([k, v]) => [k, round2(v)])) as DaySummary['discounts'],
    vatRemoved: round2(vatRemoved),
    serviceCharge: round2(serviceCharge),
    net: round2(net),
    vat: { vatableSales: round2(vatableSales), vatAmount: round2(vatAmount), vatExemptSales: round2(vatExemptSales) },
    ordersWithoutVatBreakdown,
    payments: rows(payments, 'method'),
    orderTypes: rows(orderTypes, 'type'),
    statutory,
  };
}
