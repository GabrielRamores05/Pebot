import { createRequire } from 'node:module';
import { generateKeyPairSync } from 'node:crypto';
import { describe, expect, test } from 'vitest';

const require = createRequire(import.meta.url);
const core = require('../../lib/license/core.js') as typeof import('../../lib/license/core.js');

function keyPair() {
  const { privateKey, publicKey } = generateKeyPairSync('ed25519');
  return {
    privateKeyPem: privateKey.export({ type: 'pkcs8', format: 'pem' }).toString(),
    publicKeyPem: publicKey.export({ type: 'spki', format: 'pem' }).toString(),
  };
}

const seller = keyPair();
const machine = core.machineCodeFromIdentity('4C4C4544-0042-3510-8051-B3C04F4E3232', '0E9A3B1C-1111-2222-3333-444455556666');
const otherMachine = core.machineCodeFromIdentity('another-guid', 'another-uuid');

function issue(licenseNo = 1001, m = machine, extra: { productMajor?: number; privateKeyPem?: string } = {}) {
  return core.signLicense({
    privateKeyPem: extra.privateKeyPem ?? seller.privateKeyPem,
    licenseNo,
    machineValue: m.value,
    issuedAt: new Date('2026-11-14T08:00:00Z'),
    productMajor: extra.productMajor,
  });
}

const ctx = (overrides: Partial<Parameters<typeof core.verifyLicense>[1]> = {}) => ({
  publicKeyPem: seller.publicKeyPem,
  machineValue: machine.value,
  revoked: [] as number[],
  ...overrides,
});

describe('base32', () => {
  test('round-trips arbitrary bytes', () => {
    const bytes = Buffer.from([0, 1, 2, 250, 251, 252, 253, 254, 255, 17, 99]);
    const text = core.base32Encode(bytes);
    expect(text).toMatch(/^[0-9A-HJKMNP-TV-Z]+$/);
    expect(core.base32Decode(text, bytes.length)).toEqual(bytes);
  });

  test('rejects text of the wrong length or with foreign characters', () => {
    expect(core.base32Decode('ABC', 4)).toBeNull();
    expect(core.base32Decode('UUUUUUU', 4)).toBeNull();
  });
});

describe('machine code', () => {
  test('is stable for the same identity and looks like PBT-XXXX-XXXX-XXXX', () => {
    expect(machine.text).toMatch(/^PBT-[0-9A-HJKMNP-TV-Z]{4}-[0-9A-HJKMNP-TV-Z]{4}-[0-9A-HJKMNP-TV-Z]{4}$/);
    expect(core.machineCodeFromIdentity(' 4c4c4544-0042-3510-8051-b3c04f4e3232 ', '0e9a3b1c-1111-2222-3333-444455556666').text).toBe(
      machine.text,
    );
  });

  test('changes when either identity value changes (reformat, or drive moved to another PC)', () => {
    expect(core.machineCodeFromIdentity('new-guid-after-reformat', '0E9A3B1C-1111-2222-3333-444455556666').text).not.toBe(machine.text);
    expect(core.machineCodeFromIdentity('4C4C4544-0042-3510-8051-B3C04F4E3232', 'different-motherboard').text).not.toBe(machine.text);
  });

  test('parses what an owner might paste: lower case, no dashes, O for 0', () => {
    const loose = machine.text.toLowerCase().replace(/-/g, '').replace(/0/g, 'o');
    expect(core.parseMachineCode(loose)).toEqual(machine);
    expect(core.parseMachineCode(`  ${machine.text}  `)).toEqual(machine);
  });

  test('catches typos with the check character', () => {
    const body = machine.text.replace(/^PBT-/, '').replace(/-/g, '');
    let rejected = 0;
    let total = 0;
    for (let i = 0; i < body.length; i++) {
      for (const ch of core.ALPHABET) {
        if (ch === body[i]) continue;
        total++;
        if (!core.parseMachineCode(body.slice(0, i) + ch + body.slice(i + 1))) rejected++;
      }
    }
    expect(rejected / total).toBeGreaterThan(0.9);
    const wrongCheck = body.slice(0, 11) + core.ALPHABET[(core.ALPHABET.indexOf(body[11]) + 1) % 32];
    expect(core.parseMachineCode(wrongCheck)).toBeNull();
    expect(core.parseMachineCode('PBT-1234')).toBeNull();
    expect(core.parseMachineCode(42 as unknown as string)).toBeNull();
  });
});

describe('license keys', () => {
  test('a key issued for this machine verifies and carries its license number', () => {
    const key = issue(1001);
    expect(key.startsWith('PEBOT-')).toBe(true);
    expect(key.length).toBeLessThanOrEqual(140);
    const result = core.verifyLicense(key, ctx());
    expect(result).toMatchObject({ ok: true, licenseNo: 1001 });
    if (result.ok) expect(result.issuedAt.toISOString().slice(0, 10)).toBe('2026-11-14');
  });

  test('a key for another computer is rejected as wrong-machine', () => {
    expect(core.verifyLicense(issue(1001, otherMachine), ctx())).toEqual({ ok: false, reason: 'wrong-machine' });
  });

  test('any altered character makes the key invalid', () => {
    const key = issue(1001);
    const body = key.slice('PEBOT-'.length);
    for (const i of [0, 5, 20, 40, 80, body.length - 1]) {
      const swapped = core.ALPHABET[(core.ALPHABET.indexOf(body[i]) + 7) % 32];
      const tampered = 'PEBOT-' + body.slice(0, i) + swapped + body.slice(i + 1);
      expect(core.verifyLicense(tampered, ctx())).toMatchObject({ ok: false });
    }
  });

  test('keys signed by anyone but the seller are invalid', () => {
    const forger = keyPair();
    expect(core.verifyLicense(issue(1001, machine, { privateKeyPem: forger.privateKeyPem }), ctx())).toEqual({
      ok: false,
      reason: 'invalid',
    });
  });

  test('made-up text, empty input and oversized input are invalid', () => {
    expect(core.verifyLicense('PEBOT-HELLO', ctx())).toEqual({ ok: false, reason: 'invalid' });
    expect(core.verifyLicense('', ctx())).toEqual({ ok: false, reason: 'invalid' });
    expect(core.verifyLicense('x'.repeat(5000), ctx())).toEqual({ ok: false, reason: 'invalid' });
  });

  test('a build without a seller public key accepts nothing (fail closed)', () => {
    expect(core.verifyLicense(issue(), ctx({ publicKeyPem: null }))).toEqual({ ok: false, reason: 'not-configured' });
  });

  test('revoked license numbers are refused', () => {
    expect(core.verifyLicense(issue(1002), ctx({ revoked: [1002] }))).toEqual({ ok: false, reason: 'revoked' });
  });

  test('a key for another major version is refused', () => {
    expect(core.verifyLicense(issue(1001, machine, { productMajor: 2 }), ctx())).toEqual({ ok: false, reason: 'wrong-version' });
  });

  test('tolerates Messenger copy-paste mess and reads .lic files', () => {
    const key = issue(1003);
    const messy = `\n  ${key.slice(0, 50)}\n${key.slice(50, 90).toLowerCase()} ${key.slice(90)}  \n`;
    expect(core.parseLicenseKey(messy.replace(/\n/g, ' '))).not.toBeNull();
    const lic = `${key}\n# Licensed to Aling Nena's Carinderia\n# License 1003\n`;
    expect(core.verifyLicense(lic, ctx())).toMatchObject({ ok: true, licenseNo: 1003 });
  });

  test('refuses impossible license numbers when signing', () => {
    expect(() => core.signLicense({ privateKeyPem: seller.privateKeyPem, licenseNo: 0, machineValue: machine.value })).toThrow();
  });
});

describe('deactivation codes', () => {
  const key = issue(1001);

  test('a code from the install verifies against the seller\'s copy of the key', () => {
    const code = core.createDeactivationCode({ keyText: key, licenseNo: 1001, machineText: machine.text });
    expect(code).toMatch(/^DEACT-/);
    expect(core.parseDeactivationCode(code)?.licenseNo).toBe(1001);
    expect(core.verifyDeactivationCode({ code, keyText: key, licenseNo: 1001, machineText: machine.text })).toBe(true);
    expect(core.verifyDeactivationCode({ code: code.toLowerCase(), keyText: key, licenseNo: 1001, machineText: machine.text })).toBe(true);
  });

  test('does not match another license, machine or a tampered code', () => {
    const code = core.createDeactivationCode({ keyText: key, licenseNo: 1001, machineText: machine.text, nonce: Buffer.from([1, 2, 3]) });
    expect(core.verifyDeactivationCode({ code, keyText: key, licenseNo: 1002, machineText: machine.text })).toBe(false);
    expect(core.verifyDeactivationCode({ code, keyText: key, licenseNo: 1001, machineText: otherMachine.text })).toBe(false);
    const last = code[code.length - 1];
    const tampered = code.slice(0, -1) + (last === 'A' ? 'B' : 'A');
    expect(core.verifyDeactivationCode({ code: tampered, keyText: key, licenseNo: 1001, machineText: machine.text })).toBe(false);
    expect(core.parseDeactivationCode('DEACT-123')).toBeNull();
    expect(core.parseDeactivationCode('nonsense')).toBeNull();
  });

  test('cannot be created from an invalid key', () => {
    expect(() => core.createDeactivationCode({ keyText: 'nope', licenseNo: 1, machineText: machine.text })).toThrow();
  });
});
