/**
 * Printable sales invoice and kitchen ticket (spec 019).
 * Pure: builds HTML strings from an order, so every screen prints the same document
 * and it can be tested without a browser.
 */

export type Paper = '58' | '80' | 'A4';

export interface InvoiceItem {
  quantity: number;
  unitPrice: number;
  subtotal: number;
  product: { name: string };
  selections?: string | null;
  notes?: string | null;
}

export interface InvoiceOrder {
  orderNumber: string;
  invoiceNumber?: string | null;
  createdAt: string | Date;
  customerName: string;
  orderType?: string | null;
  table?: { name: string } | null;
  deliveryAddress?: string | null;
  paymentMethod?: string | null;
  items: InvoiceItem[];
  grossAmount?: number | null;
  loyaltyDiscount?: number | null;
  discountAmount?: number | null;
  discountReason?: string | null;
  discountRate?: number | null;
  discountHolders?: string | null;
  vatRemoved?: number | null;
  vatableSales?: number | null;
  vatAmount?: number | null;
  vatExemptSales?: number | null;
  serviceCharge?: number | null;
  totalAmount: number;
}

export interface InvoiceBusiness {
  businessName: string;
  businessAddress?: string | null;
  tin?: string | null;
  branchCode?: string | null;
  footerMessage?: string | null;
  vatRegistered?: boolean | null;
}

export interface InvoiceOptions {
  paper: Paper;
  cash?: { received: number; change: number } | null;
  /** e.g. "Reprint" or "Customer copy" */
  copyLabel?: string;
}

const DISCOUNT_LABELS: Record<string, string> = {
  SENIOR: 'Senior Citizen discount',
  PWD: 'PWD discount',
  SENIOR_PWD: 'Senior/PWD discount',
  STUDENT: 'Student discount',
  STUDENT_PWD: 'Student/PWD discount',
};

const ORDER_TYPES: Record<string, string> = { DINE_IN: 'Dine-in', TAKEOUT: 'Takeout', DELIVERY: 'Delivery' };
const METHODS: Record<string, string> = { CASH: 'Cash', GCASH: 'GCash', PAYMAYA: 'Maya', MAYA: 'Maya', CARD: 'Card' };

const round2 = (n: number) => Math.round((n + Number.EPSILON) * 100) / 100;
const peso = (n: number) => `₱${Math.abs(n).toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

export function escapeHtml(value: unknown): string {
  return String(value ?? '').replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`).replace(/&#60;/g, '&lt;').replace(/&#62;/g, '&gt;');
}

/** Next number in the owner's invoice series, e.g. INV-000042. */
export function nextInvoiceNumber(prefix: string, last: number): string {
  const p = prefix.trim() || 'INV';
  return `${p}-${String(last + 1).padStart(6, '0')}`;
}

function parseJson<T>(json: string | null | undefined): T | null {
  if (!json) return null;
  try {
    return JSON.parse(json) as T;
  } catch {
    return null;
  }
}

/** Option names chosen for an item, e.g. "Large · Extra rice". */
function itemDetail(item: InvoiceItem): string {
  const sel = parseJson<{ name?: string }[]>(item.selections);
  const names = Array.isArray(sel) ? sel.map((s) => s?.name).filter(Boolean) : [];
  // Notes can hold loyalty bookkeeping (JSON); print only plain-text notes.
  const note = item.notes && !item.notes.trim().startsWith('[') && !item.notes.trim().startsWith('{') ? item.notes.trim() : '';
  return [...names, note].filter(Boolean).join(' · ');
}

export function invoiceLines(order: InvoiceOrder) {
  const items = order.items.map((i) => ({
    quantity: i.quantity,
    name: i.product.name,
    detail: itemDetail(i),
    amount: round2(i.subtotal ?? i.unitPrice * i.quantity),
  }));
  const legacy = !order.grossAmount && !order.vatableSales && !order.vatExemptSales;
  const discount = order.discountAmount ?? 0;
  const loyalty = order.loyaltyDiscount ?? 0;
  const subtotal = legacy ? round2(order.totalAmount + discount) : round2(order.grossAmount ?? 0);

  const adjustments: { label: string; amount: number }[] = [];
  if (loyalty > 0) adjustments.push({ label: 'Loyalty reward', amount: -round2(loyalty) });
  if ((order.vatRemoved ?? 0) > 0) adjustments.push({ label: 'Less VAT (Senior/PWD)', amount: -round2(order.vatRemoved ?? 0) });
  if (discount > 0) {
    const label = DISCOUNT_LABELS[order.discountReason ?? ''] ?? 'Discount';
    adjustments.push({ label: order.discountRate ? `${label} (${order.discountRate}%)` : label, amount: -round2(discount) });
  }
  if ((order.serviceCharge ?? 0) > 0) adjustments.push({ label: 'Service charge', amount: round2(order.serviceCharge ?? 0) });

  const holders = parseJson<{ type: string; name: string; idNumber: string }[]>(order.discountHolders) ?? [];
  return {
    items,
    subtotal,
    adjustments,
    total: round2(order.totalAmount),
    vat: legacy
      ? null
      : { vatableSales: round2(order.vatableSales ?? 0), vatAmount: round2(order.vatAmount ?? 0), vatExemptSales: round2(order.vatExemptSales ?? 0) },
    holders: Array.isArray(holders) ? holders : [],
  };
}

function pageCss(paper: Paper): string {
  const width = paper === 'A4' ? '190mm' : paper === '58' ? '48mm' : '72mm';
  const size = paper === 'A4' ? 'A4' : `${paper}mm auto`;
  const font = paper === 'A4' ? '12px' : paper === '58' ? '10.5px' : '11.5px';
  return `
    @page { size: ${size}; margin: ${paper === 'A4' ? '12mm' : '3mm'}; }
    * { box-sizing: border-box; }
    body { margin: 0; font-family: "Manrope", "Segoe UI", Arial, sans-serif; font-size: ${font}; color: #000; }
    .doc { width: ${width}; margin: 0 auto; }
    .center { text-align: center; }
    .muted { color: #444; }
    .big { font-size: 1.45em; font-weight: 800; letter-spacing: -0.01em; }
    .title { font-size: 1.15em; font-weight: 800; }
    .row { display: flex; justify-content: space-between; gap: 8px; }
    .row > span:last-child { text-align: right; white-space: nowrap; }
    .item { margin: 3px 0; }
    .detail { color: #444; font-size: 0.92em; padding-left: 1.6em; }
    hr { border: 0; border-top: 1px dashed #000; margin: 6px 0; }
    .total { font-size: 1.3em; font-weight: 800; }
    .tag { display: inline-block; border: 1px solid #000; border-radius: 3px; padding: 0 4px; font-size: 0.85em; font-weight: 700; }
    ${paper === 'A4' ? 'table{width:100%;border-collapse:collapse} th,td{padding:5px 4px;border-bottom:1px solid #ccc;text-align:left} td.n,th.n{text-align:right}' : ''}
  `;
}

const when = (d: string | Date) => new Date(d).toLocaleString('en-PH', { year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });

export function renderInvoiceHtml(order: InvoiceOrder, business: InvoiceBusiness, opts: InvoiceOptions): string {
  const l = invoiceLines(order);
  const e = escapeHtml;
  const row = (label: string, value: string, cls = '') => `<div class="row ${cls}"><span>${e(label)}</span><span>${value}</span></div>`;
  const where = [ORDER_TYPES[order.orderType ?? ''] ?? order.orderType, order.table?.name].filter(Boolean).join(' · ');
  const itemsHtml =
    opts.paper === 'A4'
      ? `<table><thead><tr><th>Item</th><th class="n">Qty</th><th class="n">Amount</th></tr></thead><tbody>${l.items
          .map((i) => `<tr><td>${e(i.name)}${i.detail ? `<div class="detail" style="padding-left:0">${e(i.detail)}</div>` : ''}</td><td class="n">${i.quantity}</td><td class="n">${peso(i.amount)}</td></tr>`)
          .join('')}</tbody></table>`
      : l.items
          .map((i) => `<div class="item">${row(`${i.quantity} × ${i.name}`, peso(i.amount))}${i.detail ? `<div class="detail">${e(i.detail)}</div>` : ''}</div>`)
          .join('');
  const vatRegistered = business.vatRegistered !== false;
  const vatBlock = l.vat
    ? vatRegistered
      ? row('VAT-able sales', peso(l.vat.vatableSales)) + row('VAT', peso(l.vat.vatAmount)) + row('VAT-exempt sales', peso(l.vat.vatExemptSales))
      : row('Non-VAT sales', peso(l.vat.vatExemptSales + l.vat.vatableSales + l.vat.vatAmount))
    : '';
  const holdersBlock = l.holders.length
    ? `<hr>${l.holders
        .map((h) => `<div>${e(h.type === 'PWD' ? 'PWD' : 'Senior Citizen')}: ${e(h.name)}<br><span class="muted">ID ${e(h.idNumber)}</span></div>`)
        .join('')}<div class="muted" style="margin-top:6px">Signature: ____________________</div>`
    : '';

  return `<!DOCTYPE html><html><head><meta charset="utf-8"><title>${e(order.invoiceNumber ?? order.orderNumber)}</title><style>${pageCss(opts.paper)}</style></head><body><div class="doc">
  <div class="center">
    <div class="big">${e(business.businessName)}</div>
    ${business.businessAddress ? `<div class="muted">${e(business.businessAddress)}</div>` : ''}
    ${business.tin ? `<div class="muted">TIN ${e(business.tin)}${business.branchCode ? ` · Branch ${e(business.branchCode)}` : ''}</div>` : ''}
    <div class="title" style="margin-top:6px">SALES INVOICE</div>
    ${opts.copyLabel ? `<div><span class="tag">${e(opts.copyLabel)}</span></div>` : ''}
  </div>
  <hr>
  ${row('Invoice no.', `<b>${e(order.invoiceNumber ?? '—')}</b>`)}
  ${row('Order', e(order.orderNumber.split('-').pop()))}
  ${row('Date', e(when(order.createdAt)))}
  ${row('Customer', e(order.customerName))}
  ${where ? row('Service', e(where)) : ''}
  ${order.deliveryAddress ? `<div class="muted">Deliver to: ${e(order.deliveryAddress)}</div>` : ''}
  <hr>
  ${itemsHtml}
  <hr>
  ${row('Subtotal', peso(l.subtotal))}
  ${l.adjustments.map((a) => row(a.label, `${a.amount < 0 ? '−' : ''}${peso(a.amount)}`)).join('')}
  ${row('TOTAL', peso(l.total), 'total')}
  ${order.paymentMethod ? row('Paid by', e(METHODS[order.paymentMethod] ?? order.paymentMethod)) : ''}
  ${opts.cash ? row('Cash', peso(opts.cash.received)) + row('Change', peso(opts.cash.change)) : ''}
  ${vatBlock ? `<hr>${vatBlock}` : ''}
  ${holdersBlock}
  <hr>
  <div class="center">${e(business.footerMessage || 'Thank you!')}</div>
  <div class="center muted" style="margin-top:4px">Powered by Pebot</div>
</div></body></html>`;
}

export function renderKitchenTicketHtml(order: InvoiceOrder, opts: { paper: Paper; station?: string }): string {
  const e = escapeHtml;
  const where = [ORDER_TYPES[order.orderType ?? ''] ?? order.orderType, order.table?.name].filter(Boolean).join(' · ');
  return `<!DOCTYPE html><html><head><meta charset="utf-8"><title>Ticket ${e(order.orderNumber)}</title><style>${pageCss(opts.paper)}
    .qty{font-size:1.4em;font-weight:800;min-width:2.2em;display:inline-block}
    .line{font-size:1.25em;font-weight:700;margin:5px 0}</style></head><body><div class="doc">
  <div class="center">
    <div class="big">#${e(order.orderNumber.split('-').pop())}</div>
    <div class="title">${e(where || 'Order')}</div>
    <div>${e(order.customerName)}</div>
    ${opts.station ? `<div><span class="tag">${e(opts.station)}</span></div>` : ''}
    <div class="muted">${e(when(order.createdAt))}</div>
  </div>
  <hr>
  ${order.items
    .map((i) => {
      const d = itemDetail(i);
      return `<div class="line"><span class="qty">${i.quantity}×</span>${e(i.product.name)}</div>${d ? `<div class="detail">${e(d)}</div>` : ''}`;
    })
    .join('')}
  <hr>
  <div class="center muted">Kitchen ticket</div>
</div></body></html>`;
}
