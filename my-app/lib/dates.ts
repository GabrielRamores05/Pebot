/**
 * The calendar day as the API routes expect it in `?date=` — YYYY-MM-DD.
 */
export function todayIsoDate(): string {
  return new Date().toISOString().slice(0, 10);
}

/** Whole minutes elapsed since a timestamp; never negative. */
export function minutesSince(date: string | Date): number {
  const then = date instanceof Date ? date.getTime() : new Date(date).getTime();
  return Math.max(0, Math.floor((Date.now() - then) / 60000));
}

/** Start of a rolling window that ends now, `days` days back. */
export function daysAgo(days: number): Date {
  const from = new Date();
  from.setDate(from.getDate() - days);
  return from;
}

/**
 * The `?days=` window a reporting route was asked for, defaulting to 30 days
 * and refusing anything that is not a positive whole number of days.
 */
export function daysWindowFromParams(
  searchParams: URLSearchParams,
  fallbackDays = 30,
): { days: number; dateFrom: Date } {
  const raw = parseInt(searchParams.get('days') || '', 10);
  const days = Number.isFinite(raw) && raw > 0 ? raw : fallbackDays;
  return { days, dateFrom: daysAgo(days) };
}
