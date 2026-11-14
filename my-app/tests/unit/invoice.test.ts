import { describe, expect, it } from 'vitest';
import {
  invoiceLines,
  nextInvoiceNumber,
  renderInvoiceHtml,
  renderKitchenTicketHtml,
  type InvoiceBusiness,
  type InvoiceOrder,
} from '@/lib/invoice';

const business: InvoiceBusiness = {
  businessName: 'Kusina ni Lola',
  businessAddress: '12 Rizal St, Naga City',
  tin: '123-456-789-000',
  branchCode: '0000',
  footerMessage: 'Salamat po!',
  vatRegistered: true,
};

const seniorOrder: InvoiceOrder = {
  orderNumber: 'ORD-111426-A001',
  invoiceNumber: 'INV-000042',
  createdAt: '2026-11-14T04:30:00.000Z',
  customerName: 'Lola Remedios',
  orderType: 'DINE_IN',
  table: { name: 'Table 3' },
  paymentMethod: 'CASH',
  items: [
    { quantity: 1, unitPrice: 112, subtotal: 112, product: { name: 'Adobo meal' }, selections: JSON.stringify([{ name: 'Extra rice' }]) },
  ],
  grossAmount: 112,
  loyaltyDiscount: 0,
  discountAmount: 20,
  discountReason: 'SENIOR',
  discountRate: 20,
  discountHolders: JSON.stringify([{ type: 'SENIOR', name: 'Remedios Cruz', idNumber: 'OSCA-123' }]),
  vatRemoved: 12,
  vatableSales: 0,
  vatAmount: 0,
  vatExemptSales: 80,
  serviceCharge: 0,
  totalAmount: 80,
};

describe('nextInvoiceNumber', () => {
  it('pads to six digits after the prefix', () => {
    expect(nextInvoiceNumber('INV', 0)).toBe('INV-000001');
    expect(nextInvoiceNumber('SI', 41)).toBe('SI-000042');
  });
  it('keeps growing past six digits', () => {
    expect(nextInvoiceNumber('INV', 999999)).toBe('INV-1000000');
  });
  it('falls back to INV for an empty prefix', () => {
    expect(nextInvoiceNumber('  ', 1)).toBe('INV-000002');
  });
});

describe('invoiceLines', () => {
  it('lists items with their options, then adjustments in bill order', () => {
    const l = invoiceLines(seniorOrder);
    expect(l.items).toEqual([{ quantity: 1, name: 'Adobo meal', detail: 'Extra rice', amount: 112 }]);
    expect(l.adjustments).toEqual([
      { label: 'Less VAT (Senior/PWD)', amount: -12 },
      { label: 'Senior Citizen discount (20%)', amount: -20 },
    ]);
    expect(l.subtotal).toBe(112);
    expect(l.total).toBe(80);
    expect(l.vat).toEqual({ vatableSales: 0, vatAmount: 0, vatExemptSales: 80 });
    expect(l.holders).toEqual([{ type: 'SENIOR', name: 'Remedios Cruz', idNumber: 'OSCA-123' }]);
  });

  it('adds loyalty and service charge lines', () => {
    const l = invoiceLines({ ...seniorOrder, discountAmount: 0, discountReason: null, vatRemoved: 0, discountHolders: null, loyaltyDiscount: 30, serviceCharge: 8.2, totalAmount: 90.2, vatableSales: 73.39, vatAmount: 8.81, vatExemptSales: 0 });
    expect(l.adjustments).toEqual([
      { label: 'Loyalty reward', amount: -30 },
      { label: 'Service charge', amount: 8.2 },
    ]);
  });

  it('handles orders saved before the bill breakdown existed', () => {
    const l = invoiceLines({ ...seniorOrder, grossAmount: 0, vatableSales: 0, vatExemptSales: 0, vatRemoved: 0, discountAmount: 22.4, discountReason: 'STUDENT_PWD', discountHolders: null, totalAmount: 89.6 });
    expect(l.subtotal).toBe(112);
    expect(l.vat).toBeNull();
    expect(l.adjustments).toEqual([{ label: 'Student/PWD discount (20%)', amount: -22.4 }]);
  });
});

describe('renderInvoiceHtml', () => {
  it('shows the business, invoice number, lines and holder details', () => {
    const html = renderInvoiceHtml(seniorOrder, business, { paper: '80', cash: { received: 100, change: 20 } });
    for (const text of ['Kusina ni Lola', 'TIN 123-456-789-000', 'INV-000042', 'Adobo meal', 'Extra rice', 'Less VAT (Senior/PWD)', 'Remedios Cruz', 'OSCA-123', 'VAT-exempt sales', 'Salamat po!', 'Cash', 'Change']) {
      expect(html).toContain(text);
    }
    expect(html).toContain('80mm');
  });

  it('escapes names so a customer name cannot inject markup', () => {
    const html = renderInvoiceHtml({ ...seniorOrder, customerName: '<img src=x onerror=alert(1)>' }, business, { paper: '58' });
    expect(html).not.toContain('<img src=x');
    expect(html).toContain('&lt;img src=x');
  });

  it('uses the page width for each paper size', () => {
    expect(renderInvoiceHtml(seniorOrder, business, { paper: '58' })).toContain('58mm');
    expect(renderInvoiceHtml(seniorOrder, business, { paper: 'A4' })).toContain('A4');
  });

  it('labels sales correctly for a business that is not VAT-registered', () => {
    const html = renderInvoiceHtml({ ...seniorOrder, vatExemptSales: 80 }, { ...business, vatRegistered: false }, { paper: '80' });
    expect(html).toContain('Non-VAT');
    expect(html).not.toContain('VAT-able sales');
  });

  it('marks a reprint', () => {
    expect(renderInvoiceHtml(seniorOrder, business, { paper: '80', copyLabel: 'Reprint' })).toContain('Reprint');
  });
});

describe('renderKitchenTicketHtml', () => {
  it('shows what to cook and where, without prices', () => {
    const html = renderKitchenTicketHtml(seniorOrder, { paper: '80' });
    expect(html).toContain('A001');
    expect(html).toContain('Table 3');
    expect(html).toContain('Adobo meal');
    expect(html).toContain('Extra rice');
    expect(html).not.toContain('112');
    expect(html).not.toContain('₱');
  });
});
