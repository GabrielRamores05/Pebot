import { describe, expect, it } from 'vitest';
import {
  defaultHolidays,
  easterSunday,
  nightHours,
  proratedSalary,
  serviceChargeShares,
  shiftPay,
  thirteenthMonthPay,
} from '@/lib/labor-pay';

const at = (d: string, h: number, m = 0) => {
  const x = new Date(d + 'T00:00:00');
  x.setHours(h, m, 0, 0);
  return x;
};

describe('nightHours (10pm–6am)', () => {
  it('counts the part of a shift inside the night window', () => {
    expect(nightHours(at('2026-11-10', 18), at('2026-11-10', 23))).toBe(1);
    expect(nightHours(at('2026-11-10', 21), at('2026-11-11', 2))).toBe(4);
    expect(nightHours(at('2026-11-11', 5), at('2026-11-11', 13))).toBe(1);
    expect(nightHours(at('2026-11-10', 8), at('2026-11-10', 17))).toBe(0);
  });
});

describe('shiftPay (DOLE rates, hourly rate ₱80)', () => {
  const rate = 80;
  it('ordinary day: 8 hours, then overtime at +25%', () => {
    const p = shiftPay({ hours: 10, nightHours: 0, dayType: 'REGULAR', restDay: false }, rate);
    expect(p).toMatchObject({ regularHours: 8, overtimeHours: 2, basic: 640, overtimePay: 200, premium: 0, nightDiff: 0, total: 840 });
  });
  it('regular holiday worked: 200%', () => {
    expect(shiftPay({ hours: 8, nightHours: 0, dayType: 'REGULAR_HOLIDAY', restDay: false }, rate).total).toBe(1280);
  });
  it('regular holiday on a rest day: 260%', () => {
    expect(shiftPay({ hours: 8, nightHours: 0, dayType: 'REGULAR_HOLIDAY', restDay: true }, rate).total).toBe(1664);
  });
  it('special day worked: 130%; on a rest day 150%', () => {
    expect(shiftPay({ hours: 8, nightHours: 0, dayType: 'SPECIAL_HOLIDAY', restDay: false }, rate).total).toBe(832);
    expect(shiftPay({ hours: 8, nightHours: 0, dayType: 'SPECIAL_HOLIDAY', restDay: true }, rate).total).toBe(960);
  });
  it('rest day worked: 130%', () => {
    expect(shiftPay({ hours: 8, nightHours: 0, dayType: 'REGULAR', restDay: true }, rate).total).toBe(832);
  });
  it('overtime on a holiday is +30% of the holiday rate', () => {
    const p = shiftPay({ hours: 9, nightHours: 0, dayType: 'REGULAR_HOLIDAY', restDay: false }, rate);
    expect(p.overtimePay).toBe(208); // 80 × 2 × 1.30
  });
  it('night differential is +10% of the rate for that day', () => {
    expect(shiftPay({ hours: 8, nightHours: 2, dayType: 'REGULAR', restDay: false }, rate).nightDiff).toBe(16);
    expect(shiftPay({ hours: 8, nightHours: 2, dayType: 'REGULAR_HOLIDAY', restDay: false }, rate).nightDiff).toBe(32);
  });
  it('keeps basic pay separate from premiums (for 13th month)', () => {
    const p = shiftPay({ hours: 8, nightHours: 0, dayType: 'REGULAR_HOLIDAY', restDay: false }, rate);
    expect(p.basic).toBe(640);
    expect(p.premium).toBe(640);
  });
});

describe('proratedSalary', () => {
  it('pays half a month for a half-month period', () => {
    expect(proratedSalary(24000, '2026-11-01', '2026-11-15')).toBe(12000);
    expect(proratedSalary(24000, '2026-11-16', '2026-11-30')).toBe(12000);
  });
  it('pays a full month for a full calendar month', () => {
    expect(proratedSalary(24000, '2026-11-01', '2026-11-30')).toBe(24000);
  });
  it('prorates by days for other periods', () => {
    expect(proratedSalary(30000, '2026-11-01', '2026-11-10')).toBe(10000);
  });
});

describe('13th month and service charge', () => {
  it('13th month is basic pay earned in the year divided by 12', () => {
    expect(thirteenthMonthPay(180000)).toBe(15000);
  });
  it('splits service charge equally; leftover centavos go to the first shares', () => {
    expect(serviceChargeShares(1000, [1, 2, 3])).toEqual({ 1: 333.34, 2: 333.33, 3: 333.33 });
    expect(serviceChargeShares(0, [1, 2])).toEqual({ 1: 0, 2: 0 });
    expect(serviceChargeShares(500, [])).toEqual({});
  });
});

describe('default Philippine holidays', () => {
  it('computes Easter-based dates', () => {
    expect(easterSunday(2026)).toBe('2026-04-05');
    expect(easterSunday(2027)).toBe('2027-03-28');
  });
  it('includes the regular holidays of the year', () => {
    const h = defaultHolidays(2026);
    const regular = h.filter((x) => x.type === 'REGULAR_HOLIDAY').map((x) => x.date);
    expect(regular).toEqual(expect.arrayContaining([
      '2026-01-01', '2026-04-02', '2026-04-03', '2026-04-09', '2026-05-01', '2026-06-12', '2026-08-31', '2026-11-30', '2026-12-25', '2026-12-30',
    ]));
    expect(h.find((x) => x.date === '2026-04-04')).toMatchObject({ type: 'SPECIAL_HOLIDAY' });
    expect(h.find((x) => x.date === '2026-12-08')).toMatchObject({ type: 'SPECIAL_HOLIDAY' });
  });
});

import { periodPay } from '@/lib/labor-pay';

describe('periodPay (spec 021)', () => {
  const holidays = new Map([['2026-11-30', 'REGULAR_HOLIDAY' as const]]);

  it('adds up hourly pay over a period with holiday, overtime and night work', () => {
    const p = periodPay({
      shifts: [
        { date: '2026-11-28', hours: 8, nightHours: 0 },
        { date: '2026-11-29', hours: 10, nightHours: 2 },
        { date: '2026-11-30', hours: 8, nightHours: 0 },
      ],
      holidays,
      scheduledDates: null,
      hourlyRate: 80,
    });
    expect(p).toMatchObject({
      regularHours: 24, overtimeHours: 2, nightHours: 2, days: 3,
      basicPay: 1920, holidayPremium: 640, overtimePay: 200, nightDiff: 16, grossPay: 2776,
    });
  });

  it('treats an unscheduled day as a rest day when the person has a schedule', () => {
    const p = periodPay({
      shifts: [{ date: '2026-11-29', hours: 8, nightHours: 0 }],
      holidays: new Map(),
      scheduledDates: new Set(['2026-11-28']),
      hourlyRate: 100,
    });
    expect(p.holidayPremium).toBe(240); // rest day 130%
    expect(p.grossPay).toBe(1040);
  });

  it('pays salaried staff their prorated salary plus premiums only', () => {
    const p = periodPay({
      shifts: [{ date: '2026-11-30', hours: 8, nightHours: 0 }],
      holidays,
      scheduledDates: null,
      hourlyRate: 0,
      salary: { monthly: 31300, periodStart: '2026-11-16', periodEnd: '2026-11-30' },
    });
    // hourly equivalent = 31300 × 12 / 313 / 8 = 150; holiday premium = 8 × 150 × 1.0
    expect(p.basicPay).toBe(15650);
    expect(p.holidayPremium).toBe(1200);
    expect(p.grossPay).toBe(16850);
  });

  it('works for records without clock times (hours only)', () => {
    const p = periodPay({ shifts: [{ date: null, hours: 8, nightHours: 0 }, { date: null, hours: 10, nightHours: 0 }], holidays, scheduledDates: null, hourlyRate: 100 });
    expect(p).toMatchObject({ regularHours: 16, overtimeHours: 2, grossPay: 1850 });
  });
});
