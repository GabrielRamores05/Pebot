'use client';

// Spec 019: print an order's sales invoice or kitchen ticket with the owner's printer settings.

import { renderInvoiceHtml, renderKitchenTicketHtml, type InvoiceBusiness, type InvoiceOrder, type Paper } from '@/lib/invoice';
import { printHtml } from '@/lib/print-client';

export interface PrintSettings extends InvoiceBusiness {
  receiptPrinter?: string | null;
  kitchenPrinter?: string | null;
  paperWidth?: string | null;
  autoPrintInvoice?: boolean | null;
  autoPrintKitchen?: boolean | null;
}

function paperOf(settings: PrintSettings | null | undefined, override?: Paper): Paper {
  if (override) return override;
  const p = settings?.paperWidth;
  return p === '58' || p === 'A4' ? p : '80';
}

export async function printInvoice(
  order: InvoiceOrder,
  settings: PrintSettings | null | undefined,
  opts: { paper?: Paper; cash?: { received: number; change: number } | null; copyLabel?: string } = {},
) {
  const business: InvoiceBusiness = {
    businessName: settings?.businessName || 'My Restaurant',
    businessAddress: settings?.businessAddress,
    tin: settings?.tin,
    branchCode: settings?.branchCode,
    footerMessage: settings?.footerMessage,
    vatRegistered: settings?.vatRegistered ?? true,
  };
  const paper = paperOf(settings, opts.paper);
  const html = renderInvoiceHtml(order, business, { paper, cash: opts.cash, copyLabel: opts.copyLabel });
  // A4 goes through the dialog so the owner can pick an office printer.
  return printHtml(html, { printer: paper === 'A4' ? null : settings?.receiptPrinter ?? null });
}

export async function printKitchenTicket(order: InvoiceOrder, settings: PrintSettings | null | undefined, station?: string) {
  const paper = paperOf(settings) === '58' ? '58' : '80';
  const html = renderKitchenTicketHtml(order, { paper, station });
  return printHtml(html, { printer: settings?.kitchenPrinter || settings?.receiptPrinter || null });
}
