import { describe, expect, it } from 'vitest';
import { dayRange } from '@/modules/reports/service';

describe('dayRange', () => {
  it('covers one local calendar day', () => {
    const { from, to } = dayRange('2026-11-14');
    expect([from.getFullYear(), from.getMonth(), from.getDate(), from.getHours()]).toEqual([2026, 10, 14, 0]);
    expect(to.getTime() - from.getTime()).toBe(24 * 60 * 60 * 1000);
  });

  it('refuses malformed and impossible dates', () => {
    expect(() => dayRange('14/11/2026')).toThrow();
    expect(() => dayRange('2026-02-30')).toThrow();
    expect(() => dayRange('')).toThrow();
  });
});
