/**
 * Philippine labor pay rules for payroll (spec 021), after the DOLE Handbook on
 * Workers' Statutory Monetary Benefits. A calculation guide: the owner's
 * accountant should confirm the setup for their business.
 *
 *  Day                                  First 8 hours   Overtime (per hour)
 *  Ordinary day                         100%            +25%
 *  Rest day, or special day             130%            +30% of that day's rate
 *  Special day that is also a rest day  150%            +30%
 *  Regular holiday                      200%            +30%
 *  Regular holiday on a rest day        260%            +30%
 *  Night differential (10pm–6am): +10% of the hourly rate for that day.
 */

export type DayType = 'REGULAR' | 'SPECIAL_HOLIDAY' | 'REGULAR_HOLIDAY';

const round2 = (n: number) => Math.round((n + Number.EPSILON) * 100) / 100;

export function dayMultiplier(dayType: DayType, restDay: boolean): number {
  if (dayType === 'REGULAR_HOLIDAY') return restDay ? 2.6 : 2;
  if (dayType === 'SPECIAL_HOLIDAY') return restDay ? 1.5 : 1.3;
  return restDay ? 1.3 : 1;
}

/** Hours of a shift that fall between 10pm and 6am (local time). */
export function nightHours(clockIn: Date, clockOut: Date): number {
  let ms = 0;
  const start = new Date(clockIn);
  start.setHours(0, 0, 0, 0);
  start.setDate(start.getDate() - 1);
  for (let d = start; d < clockOut; d = new Date(d.getFullYear(), d.getMonth(), d.getDate() + 1)) {
    const nightStart = new Date(d.getFullYear(), d.getMonth(), d.getDate(), 22).getTime();
    const nightEnd = new Date(d.getFullYear(), d.getMonth(), d.getDate() + 1, 6).getTime();
    const a = Math.max(nightStart, clockIn.getTime());
    const b = Math.min(nightEnd, clockOut.getTime());
    if (b > a) ms += b - a;
  }
  return round2(ms / 3600000);
}

export interface ShiftInput {
  hours: number;
  nightHours: number;
  dayType: DayType;
  restDay: boolean;
}

export function shiftPay(shift: ShiftInput, hourlyRate: number) {
  const m = dayMultiplier(shift.dayType, shift.restDay);
  const regularHours = Math.min(shift.hours, 8);
  const overtimeHours = Math.max(0, shift.hours - 8);
  const ordinary = shift.dayType === 'REGULAR' && !shift.restDay;
  const basic = round2(regularHours * hourlyRate);
  const dayPay = round2(regularHours * hourlyRate * m);
  const overtimePay = round2(overtimeHours * hourlyRate * m * (ordinary ? 1.25 : 1.3));
  const nightDiff = round2(Math.min(shift.nightHours, shift.hours) * hourlyRate * m * 0.1);
  return {
    regularHours: round2(regularHours),
    overtimeHours: round2(overtimeHours),
    nightHours: round2(Math.min(shift.nightHours, shift.hours)),
    basic,
    premium: round2(dayPay - basic),
    overtimePay,
    nightDiff,
    total: round2(dayPay + overtimePay + nightDiff),
  };
}

/** A monthly salary for a pay period: half for the 1–15 / 16–end halves, whole for a calendar month, else by days. */
export function proratedSalary(monthly: number, periodStart: string, periodEnd: string): number {
  const s = new Date(periodStart + 'T00:00:00');
  const e = new Date(periodEnd + 'T00:00:00');
  const monthEnd = new Date(s.getFullYear(), s.getMonth() + 1, 0).getDate();
  const sameMonth = s.getFullYear() === e.getFullYear() && s.getMonth() === e.getMonth();
  if (sameMonth && s.getDate() === 1 && e.getDate() === monthEnd) return round2(monthly);
  if (sameMonth && ((s.getDate() === 1 && e.getDate() === 15) || (s.getDate() === 16 && e.getDate() === monthEnd))) return round2(monthly / 2);
  const days = Math.round((e.getTime() - s.getTime()) / 86400000) + 1;
  return round2((monthly * 12 * days) / 360);
}

/** 13th-month pay: basic salary earned in the calendar year ÷ 12 (PD 851). */
export function thirteenthMonthPay(basicEarnedThisYear: number): number {
  return round2(basicEarnedThisYear / 12);
}

/** Equal shares of service charges among covered staff (RA 11360). Leftover centavos go to the first shares. */
export function serviceChargeShares(total: number, staffIds: number[]): Record<number, number> {
  const out: Record<number, number> = {};
  if (staffIds.length === 0) return out;
  const cents = Math.round(total * 100);
  const each = Math.floor(cents / staffIds.length);
  let extra = cents - each * staffIds.length;
  for (const id of staffIds) {
    out[id] = (each + (extra > 0 ? 1 : 0)) / 100;
    if (extra > 0) extra--;
  }
  return out;
}

const iso = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

/** Easter Sunday (Gregorian), YYYY-MM-DD. */
export function easterSunday(year: number): string {
  const a = year % 19, b = Math.floor(year / 100), c = year % 100, d = Math.floor(b / 4), e = b % 4;
  const f = Math.floor((b + 8) / 25), g = Math.floor((b - f + 1) / 3), h = (19 * a + b - d - g + 15) % 30;
  const i = Math.floor(c / 4), k = c % 4, l = (32 + 2 * e + 2 * i - h - k) % 7, m = Math.floor((a + 11 * h + 22 * l) / 451);
  const month = Math.floor((h + l - 7 * m + 114) / 31), day = ((h + l - 7 * m + 114) % 31) + 1;
  return iso(new Date(year, month - 1, day));
}

export interface HolidayDef {
  date: string;
  name: string;
  type: Exclude<DayType, 'REGULAR'>;
}

/**
 * Holidays fixed by law (RA 9492 and later laws) plus the Holy Week dates.
 * Islamic holidays, Chinese New Year and extra special days are set by yearly
 * proclamation: the owner adds them in Staff & HR → Holidays.
 */
export function defaultHolidays(year: number): HolidayDef[] {
  const easter = new Date(easterSunday(year) + 'T00:00:00');
  const off = (n: number) => iso(new Date(easter.getFullYear(), easter.getMonth(), easter.getDate() + n));
  const lastMondayAug = (() => { const d = new Date(year, 8, 0); while (d.getDay() !== 1) d.setDate(d.getDate() - 1); return iso(d); })();
  const R = 'REGULAR_HOLIDAY' as const;
  const S = 'SPECIAL_HOLIDAY' as const;
  return [
    { date: `${year}-01-01`, name: "New Year's Day", type: R },
    { date: off(-3), name: 'Maundy Thursday', type: R },
    { date: off(-2), name: 'Good Friday', type: R },
    { date: off(-1), name: 'Black Saturday', type: S },
    { date: `${year}-04-09`, name: 'Araw ng Kagitingan', type: R },
    { date: `${year}-05-01`, name: 'Labor Day', type: R },
    { date: `${year}-06-12`, name: 'Independence Day', type: R },
    { date: `${year}-08-21`, name: 'Ninoy Aquino Day', type: S },
    { date: lastMondayAug, name: 'National Heroes Day', type: R },
    { date: `${year}-11-01`, name: "All Saints' Day", type: S },
    { date: `${year}-11-30`, name: 'Bonifacio Day', type: R },
    { date: `${year}-12-08`, name: 'Feast of the Immaculate Conception', type: S },
    { date: `${year}-12-24`, name: 'Christmas Eve', type: S },
    { date: `${year}-12-25`, name: 'Christmas Day', type: R },
    { date: `${year}-12-30`, name: 'Rizal Day', type: R },
    { date: `${year}-12-31`, name: 'Last Day of the Year', type: S },
  ].sort((a, b) => a.date.localeCompare(b.date));
}
