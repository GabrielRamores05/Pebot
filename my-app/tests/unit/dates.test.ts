import { afterEach, describe, expect, test, vi } from 'vitest';
import { daysAgo, daysWindowFromParams, minutesSince, todayIsoDate } from '../../lib/dates';

afterEach(() => {
  vi.useRealTimers();
});

describe('todayIsoDate', () => {
  test('is the calendar day the API expects in ?date=', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-03-09T21:45:00.000Z'));
    expect(todayIsoDate()).toBe('2026-03-09');
  });
});

describe('minutesSince', () => {
  test('counts whole minutes of waiting', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-03-09T12:30:30.000Z'));
    expect(minutesSince('2026-03-09T12:00:00.000Z')).toBe(30);
    expect(minutesSince(new Date('2026-03-09T12:30:00.000Z'))).toBe(0);
  });

  test('never reports negative waiting for a future timestamp', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-03-09T12:00:00.000Z'));
    expect(minutesSince('2026-03-09T12:10:00.000Z')).toBe(0);
  });
});

describe('daysAgo', () => {
  test('walks the calendar back the given number of days', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-03-09T08:00:00.000Z'));
    expect(daysAgo(7).toISOString()).toBe('2026-03-02T08:00:00.000Z');
  });
});

describe('daysWindowFromParams', () => {
  test('uses the requested window', () => {
    const { days } = daysWindowFromParams(new URLSearchParams('days=7'));
    expect(days).toBe(7);
  });

  test('falls back to 30 days when the window is missing or nonsense', () => {
    expect(daysWindowFromParams(new URLSearchParams()).days).toBe(30);
    expect(daysWindowFromParams(new URLSearchParams('days=abc')).days).toBe(30);
    expect(daysWindowFromParams(new URLSearchParams('days=0')).days).toBe(30);
    expect(daysWindowFromParams(new URLSearchParams('days=-5')).days).toBe(30);
  });

  test('honours a caller-chosen fallback', () => {
    expect(daysWindowFromParams(new URLSearchParams(), 90).days).toBe(90);
  });

  test('starts the window that many days before now', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-03-09T08:00:00.000Z'));
    expect(daysWindowFromParams(new URLSearchParams('days=2')).dateFrom.toISOString()).toBe(
      '2026-03-07T08:00:00.000Z',
    );
  });
});
