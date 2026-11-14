'use client';

import { useEffect, useState } from 'react';
import { isDesktopApp, listPrinters, type DesktopPrinter } from '@/lib/print-client';
import { printInvoice } from '@/lib/print-documents';
import type { InvoiceOrder } from '@/lib/invoice';

// Spec 019: where invoices and kitchen tickets print.

type Paper = '58' | '80' | 'A4';

interface Settings {
  businessName: string;
  businessAddress?: string;
  tin?: string;
  branchCode?: string;
  footerMessage?: string;
  vatRegistered?: boolean;
  receiptPrinter?: string | null;
  kitchenPrinter?: string | null;
  paperWidth?: string;
  autoPrintInvoice?: boolean;
  autoPrintKitchen?: boolean;
  birPermitNumber?: string | null;
}

const SAMPLE: InvoiceOrder = {
  orderNumber: 'ORD-TEST-A001',
  invoiceNumber: 'TEST-000000',
  createdAt: new Date().toISOString(),
  customerName: 'Test print',
  orderType: 'DINE_IN',
  table: { name: 'Table 1' },
  paymentMethod: 'CASH',
  items: [
    { quantity: 2, unitPrice: 120, subtotal: 240, product: { name: 'Chicken adobo' }, selections: null },
    { quantity: 1, unitPrice: 60, subtotal: 60, product: { name: 'Iced tea' }, selections: null },
  ],
  grossAmount: 300,
  loyaltyDiscount: 0,
  discountAmount: 0,
  vatRemoved: 0,
  vatableSales: 267.86,
  vatAmount: 32.14,
  vatExemptSales: 0,
  serviceCharge: 0,
  totalAmount: 300,
};

const field = 'mt-1 h-10 w-full rounded-xl border border-hair bg-card px-3 text-sm outline-none focus:border-accent';

export default function PrintingPanel() {
  const [s, setS] = useState<Settings | null>(null);
  const [printers, setPrinters] = useState<DesktopPrinter[]>([]);
  const [desktop, setDesktop] = useState(false);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);

  useEffect(() => {
    setDesktop(isDesktopApp());
    fetch('/api/settings/business').then((r) => r.json()).then(setS).catch(() => setMsg({ ok: false, text: 'Could not load settings.' }));
    listPrinters().then(setPrinters).catch(() => setPrinters([]));
  }, []);

  if (!s) return <p className="py-10 text-center text-sm text-faint">Loading…</p>;

  const set = (patch: Partial<Settings>) => setS({ ...s, ...patch });

  async function save() {
    if (!s) return;
    setSaving(true);
    setMsg(null);
    try {
      const res = await fetch('/api/settings/business', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          receiptPrinter: s.receiptPrinter || null,
          kitchenPrinter: s.kitchenPrinter || null,
          paperWidth: s.paperWidth || '80',
          autoPrintInvoice: Boolean(s.autoPrintInvoice),
          autoPrintKitchen: Boolean(s.autoPrintKitchen),
          birPermitNumber: s.birPermitNumber?.trim() || null,
        }),
      });
      const data = await res.json().catch(() => ({}));
      setMsg(res.ok ? { ok: true, text: 'Printing settings saved.' } : { ok: false, text: data.error || 'Could not save.' });
    } catch {
      setMsg({ ok: false, text: 'Network error. Try again.' });
    } finally {
      setSaving(false);
    }
  }

  async function testPrint() {
    if (!s) return;
    const r = await printInvoice(SAMPLE, s, { copyLabel: 'Test print' });
    setMsg(r.ok ? { ok: true, text: 'Test page sent to the printer.' } : { ok: false, text: `Test print failed: ${r.error ?? 'printer problem'}` });
  }

  const printerSelect = (value: string | null | undefined, onChange: (v: string | null) => void, emptyLabel: string) =>
    desktop ? (
      <select value={value ?? ''} onChange={(e) => onChange(e.target.value || null)} className={field}>
        <option value="">{emptyLabel}</option>
        {printers.map((p) => (
          <option key={p.name} value={p.name}>{p.displayName}{p.isDefault ? ' (Windows default)' : ''}</option>
        ))}
      </select>
    ) : (
      <input value={value ?? ''} onChange={(e) => onChange(e.target.value || null)} placeholder="Printer name as shown in Windows" className={field} />
    );

  return (
    <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_320px]">
      <section className="c-card space-y-5 p-5">
        <div>
          <h2 className="text-base font-bold">Printers</h2>
          <p className="text-xs text-faint">
            {desktop
              ? 'Pick the printer for each job. With a printer chosen, Pebot prints straight away without asking.'
              : 'Printers can be picked on the main PC (the Pebot app). On this device, printing opens the print dialog.'}
          </p>
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <label className="text-xs font-semibold text-muted">
            Invoices and receipts
            {printerSelect(s.receiptPrinter, (v) => set({ receiptPrinter: v }), 'Ask each time')}
          </label>
          <label className="text-xs font-semibold text-muted">
            Kitchen tickets
            {printerSelect(s.kitchenPrinter, (v) => set({ kitchenPrinter: v }), 'Same as invoices')}
          </label>
        </div>

        <label className="block text-xs font-semibold text-muted">
          BIR Permit to Use (PTU) number
          <input
            value={s.birPermitNumber ?? ''}
            onChange={(e) => set({ birPermitNumber: e.target.value })}
            placeholder="Leave blank until BIR issues one"
            className="mt-1 block h-10 w-full max-w-sm rounded-xl border border-hair bg-card px-3 text-sm text-ink outline-none focus:border-accent"
          />
          <span className="mt-1 block font-normal text-faint">
            Pebot is not BIR-accredited. Without a PTU number, printouts say SALES SLIP and &quot;This is not an official receipt&quot;. Keep issuing your BIR-registered receipts.
          </span>
        </label>

        <div>
          <p className="text-xs font-semibold text-muted">Paper</p>
          <div className="mt-1 inline-flex rounded-xl bg-panel p-1">
            {(['58', '80', 'A4'] as Paper[]).map((p) => (
              <button
                key={p}
                onClick={() => set({ paperWidth: p })}
                className={`h-9 rounded-[10px] px-4 text-[13px] font-semibold ${(s.paperWidth || '80') === p ? 'bg-card text-ink shadow-card' : 'text-muted'}`}
              >
                {p === 'A4' ? 'A4 sheet' : `${p} mm roll`}
              </button>
            ))}
          </div>
        </div>

        <div className="space-y-2">
          <label className="flex cursor-pointer items-center gap-3 text-sm">
            <input type="checkbox" checked={Boolean(s.autoPrintInvoice)} onChange={(e) => set({ autoPrintInvoice: e.target.checked })} className="h-4 w-4 accent-[var(--c-accent)]" />
            Print the invoice automatically after each sale
          </label>
          <label className="flex cursor-pointer items-center gap-3 text-sm">
            <input type="checkbox" checked={Boolean(s.autoPrintKitchen)} onChange={(e) => set({ autoPrintKitchen: e.target.checked })} className="h-4 w-4 accent-[var(--c-accent)]" />
            Print a kitchen ticket for each new order from the POS
          </label>
        </div>

        {msg && <p className={`rounded-xl px-4 py-3 text-sm ${msg.ok ? 'bg-good-bg text-good' : 'bg-danger-bg text-danger'}`} role="status">{msg.text}</p>}

        <div className="flex flex-wrap gap-2">
          <button onClick={save} disabled={saving} className="c-btn c-btn--primary disabled:opacity-50">{saving ? 'Saving…' : 'Save printing settings'}</button>
          <button onClick={testPrint} className="c-btn c-btn--ghost">Print a test invoice</button>
        </div>
      </section>

      <aside className="c-card space-y-3 p-5 text-sm">
        <h3 className="font-bold">Good to know</h3>
        <p className="text-muted">Invoices are numbered in order from the prefix in Business settings (for example INV-000001). The number is given when the order is paid.</p>
        <p className="text-muted">To open the cash drawer on each sale, turn on the drawer option in your receipt printer&apos;s Windows settings. Most thermal printers have it.</p>
        <p className="text-muted">Reprints from Order History are marked “Reprint”.</p>
      </aside>
    </div>
  );
}
