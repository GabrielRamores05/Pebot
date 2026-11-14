import { describe, expect, it } from 'vitest';
import { payslipLines, renderPayslipHtml } from '@/lib/payslip';

const record = {
  periodStart: '2026-11-16', periodEnd: '2026-11-30', regularHours: 88, overtimeHours: 4, grossPay: 9200, netPay: 8500, status: 'DRAFT',
  breakdown: JSON.stringify({
    grossPay: 9200, basicPay: 7040, holidayPremium: 640, overtimePay: 400, nightDiff: 120, serviceChargeShare: 1000,
    sss: { employee: 450 }, philHealth: { employee: 230 }, pagIbig: { employee: 20 }, withholdingTax: 0, otherDeductions: 0, netPay: 8500,
  }),
  user: { name: 'Ana <Reyes>', position: 'Server' },
};

describe('payslip (spec 021)', () => {
  it('lists earnings and deductions that apply', () => {
    const l = payslipLines(record);
    expect(l.earnings.map(([k]) => k)).toEqual(['Basic pay', 'Holiday and rest-day premium', 'Overtime', 'Night differential', 'Service charge share']);
    expect(l.deductions.map(([k]) => k)).toEqual(['SSS', 'PhilHealth', 'Pag-IBIG']);
    expect(l.net).toBe(8500);
  });
  it('renders an escaped printable page', () => {
    const html = renderPayslipHtml(record, { businessName: 'Kusina ni Lola' });
    expect(html).toContain('PAYSLIP');
    expect(html).toContain('Ana &lt;Reyes&gt;');
    expect(html).toContain('₱8,500.00');
    expect(html).not.toContain('<Reyes>');
  });
  it('copes with an older run without a breakdown', () => {
    const l = payslipLines({ ...record, breakdown: null });
    expect(l.earnings).toEqual([['Basic pay', 9200]]);
  });
});
