/**
 * Printable payslip (spec 021). Pure: builds an HTML page from a payroll record
 * and its saved breakdown.
 */
import { escapeHtml } from '@/lib/invoice';

export interface PayslipRecord {
  periodStart: string | Date;
  periodEnd: string | Date;
  regularHours: number;
  overtimeHours: number;
  grossPay: number;
  netPay: number;
  status: string;
  breakdown?: string | null;
  user?: { name: string; position?: string | null } | null;
}

const peso = (n: number | undefined) => `₱${(n ?? 0).toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const day = (d: string | Date) => new Date(d).toLocaleDateString('en-PH', { year: 'numeric', month: 'short', day: 'numeric' });

export function payslipLines(record: PayslipRecord) {
  let b: Record<string, any> = {};
  try { b = record.breakdown ? JSON.parse(record.breakdown) : {}; } catch { b = {}; }
  const earnings = [
    ['Basic pay', b.basicPay ?? record.grossPay],
    ['Holiday and rest-day premium', b.holidayPremium],
    ['Overtime', b.overtimePay],
    ['Night differential', b.nightDiff],
    ['Service charge share', b.serviceChargeShare],
  ].filter(([, v]) => typeof v === 'number' && (v as number) > 0) as [string, number][];
  const deductions = [
    ['SSS', b.sss?.employee],
    ['PhilHealth', b.philHealth?.employee],
    ['Pag-IBIG', b.pagIbig?.employee],
    ['Withholding tax', b.withholdingTax],
    ['Other deductions', b.otherDeductions],
  ].filter(([, v]) => typeof v === 'number' && (v as number) > 0) as [string, number][];
  return { earnings, deductions, gross: b.grossPay ?? record.grossPay, net: b.netPay ?? record.netPay, employerCost: b.employerCost as number | undefined };
}

export function renderPayslipHtml(record: PayslipRecord, business: { businessName: string; businessAddress?: string | null; tin?: string | null }): string {
  const e = escapeHtml;
  const l = payslipLines(record);
  const row = (label: string, value: string, cls = '') => `<tr class="${cls}"><td>${e(label)}</td><td class="n">${value}</td></tr>`;
  return `<!DOCTYPE html><html><head><meta charset="utf-8"><title>Payslip ${e(record.user?.name ?? '')}</title><style>
    @page { size: A5; margin: 12mm; }
    body { font-family: "Manrope", "Segoe UI", Arial, sans-serif; font-size: 12px; color: #111; margin: 0; }
    h1 { font-size: 18px; margin: 0; } .muted { color: #555; }
    .top { display: flex; justify-content: space-between; align-items: flex-start; border-bottom: 2px solid #111; padding-bottom: 8px; margin-bottom: 10px; }
    table { width: 100%; border-collapse: collapse; margin-bottom: 10px; }
    td { padding: 4px 0; border-bottom: 1px solid #e5e5e5; } td.n { text-align: right; font-variant-numeric: tabular-nums; }
    th { text-align: left; font-size: 11px; text-transform: uppercase; letter-spacing: .06em; color: #555; padding: 6px 0 2px; }
    .total td { font-weight: 800; border-bottom: 0; border-top: 1px solid #111; }
    .net { background: #f2f2f2; padding: 10px 12px; display: flex; justify-content: space-between; font-size: 16px; font-weight: 800; border-radius: 6px; }
    .sign { margin-top: 28px; display: flex; gap: 24px; } .sign div { flex: 1; border-top: 1px solid #111; padding-top: 4px; text-align: center; font-size: 11px; }
  </style></head><body>
  <div class="top">
    <div><h1>${e(business.businessName)}</h1>${business.businessAddress ? `<div class="muted">${e(business.businessAddress)}</div>` : ''}${business.tin ? `<div class="muted">TIN ${e(business.tin)}</div>` : ''}</div>
    <div style="text-align:right"><b>PAYSLIP</b><div class="muted">${e(day(record.periodStart))} – ${e(day(record.periodEnd))}</div></div>
  </div>
  <div><b>${e(record.user?.name ?? 'Staff')}</b>${record.user?.position ? ` · ${e(record.user.position)}` : ''}</div>
  <div class="muted" style="margin-bottom:8px">${record.regularHours} regular hours · ${record.overtimeHours} overtime hours</div>
  <table><tr><th colspan="2">Earnings</th></tr>${l.earnings.map(([k, v]) => row(k, peso(v))).join('')}${row('Gross pay', peso(l.gross), 'total')}</table>
  <table><tr><th colspan="2">Deductions</th></tr>${l.deductions.map(([k, v]) => row(k, '−' + peso(v))).join('') || row('None', peso(0))}</table>
  <div class="net"><span>Net pay</span><span>${peso(l.net)}</span></div>
  <div class="sign"><div>Prepared by</div><div>Received by</div></div>
  <p class="muted" style="font-size:10px;margin-top:14px">Computed by Pebot as a guide to Philippine rules (SSS, PhilHealth, Pag-IBIG, BIR withholding, DOLE premiums). The employer files and pays the agencies.</p>
</body></html>`;
}
