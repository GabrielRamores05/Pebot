import { createRequire } from 'node:module';
import { describe, expect, test } from 'vitest';

const require = createRequire(import.meta.url);
const reg = require('../../../tools/pebot-keygen/registry.js') as typeof import('../../../tools/pebot-keygen/registry.js');
const { parseArgs } = require('../../../tools/pebot-keygen/pebot-keygen.js') as { parseArgs: (a: string[]) => { flags: Record<string, string | boolean>; positional: string[] } };

const now = new Date('2026-11-14T00:00:00Z');
const daysAgo = (d: number) => new Date(now.getTime() - d * 86_400_000);

function registryWithOne() {
  const data = reg.emptyRegistry();
  const entry = reg.addLicense(data, {
    customer: "Aling Nena's",
    contact: '0917',
    machineCode: 'PBT-AAAA-AAAA-AAAA',
    now: daysAgo(400),
    key: (n) => `KEY-${n}`,
  });
  return { data, entry };
}

describe('issuing', () => {
  test('license numbers start at 1001 and increase', () => {
    const { data, entry } = registryWithOne();
    expect(entry.licenseNo).toBe(1001);
    expect(entry.issues[0]).toMatchObject({ kind: 'new', key: 'KEY-1001', machineCode: 'PBT-AAAA-AAAA-AAAA' });
    const second = reg.addLicense(data, { customer: 'B', contact: 'b', machineCode: 'PBT-B', now, key: (n) => `KEY-${n}` });
    expect(second.licenseNo).toBe(1002);
    expect(data.nextLicenseNo).toBe(1003);
    expect(reg.findLicense(data, 1002)).toBe(second);
    expect(reg.findLicense(data, 9999)).toBeNull();
  });
});

describe('moving a license to a new PC', () => {
  test('needs a known, non-revoked license', () => {
    expect(reg.checkReissue(null, { deactivationOk: true, now })).toMatchObject({ ok: false });
    const { entry } = registryWithOne();
    reg.revokeLicense(entry, 'refunded', now);
    expect(reg.checkReissue(entry, { deactivationOk: true, now })).toMatchObject({ ok: false, error: expect.stringContaining('revoked') });
  });

  test('a bad deactivation code is refused; no code requires a written reason', () => {
    const { entry } = registryWithOne();
    expect(reg.checkReissue(entry, { deactivationOk: false, now })).toMatchObject({ ok: false });
    expect(reg.checkReissue(entry, { deactivationOk: null, now })).toMatchObject({ ok: false, error: expect.stringContaining('--reason') });
    expect(reg.checkReissue(entry, { deactivationOk: null, reason: 'stolen', now })).toEqual({ ok: true });
  });

  test('3 free re-activations per 12 months, then an override is required', () => {
    const { entry } = registryWithOne();
    for (const d of [300, 100, 10]) {
      expect(reg.checkReissue(entry, { deactivationOk: true, now: daysAgo(d) })).toEqual({ ok: true });
      reg.addReissue(entry, { machineCode: `PBT-${d}`, key: `K${d}`, now: daysAgo(d), deactivationCode: 'DEACT', reason: null, override: false });
    }
    expect(reg.reactivationsLastYear(entry, now)).toBe(3);
    expect(reg.checkReissue(entry, { deactivationOk: true, now })).toMatchObject({ ok: false, error: expect.stringContaining('--override') });
    expect(reg.checkReissue(entry, { deactivationOk: true, now, override: true })).toEqual({ ok: true });
    // A year later the oldest one no longer counts.
    expect(reg.reactivationsLastYear(entry, new Date(now.getTime() + 70 * 86_400_000))).toBe(2);
    expect(reg.currentIssue(entry).machineCode).toBe('PBT-10');
  });
});

describe('revocation', () => {
  test('marks the registry and adds the number to the shipped list once, sorted', () => {
    const { entry } = registryWithOne();
    reg.revokeLicense(entry, 'refunded 2026-11-20', now);
    expect(entry).toMatchObject({ status: 'revoked', revokeReason: 'refunded 2026-11-20', revokedAt: now.toISOString() });

    const source = "const REVOKED_LICENSES = [\n  // pebot-keygen:revoked-list\n];\n";
    const once = reg.addToRevokedSource(source, 1005);
    const twice = reg.addToRevokedSource(reg.addToRevokedSource(once, 1001), 1005);
    expect(twice).toBe("const REVOKED_LICENSES = [\n  // pebot-keygen:revoked-list\n  1001,\n  1005,\n];\n");
    expect(() => reg.addToRevokedSource('const X = [];', 1)).toThrow();
  });

  test('the real revoked.js still has the marker the tool needs', () => {
    const src = require('node:fs').readFileSync(require.resolve('../../lib/license/revoked.js'), 'utf8') as string;
    expect(() => reg.addToRevokedSource(src, 1001)).not.toThrow();
  });
});

test('command-line flags parse with values and switches', () => {
  expect(parseArgs(['--machine', 'PBT-1', '--override', 'DEACT-9', '--customer', 'A B'])).toEqual({
    flags: { machine: 'PBT-1', override: true, customer: 'A B' },
    positional: ['DEACT-9'],
  });
});
