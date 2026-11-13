import { createRequire } from 'node:module';
import { generateKeyPairSync } from 'node:crypto';
import { mkdtempSync, readFileSync, rmSync, writeFileSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';

const require = createRequire(import.meta.url);
const core = require('../../lib/license/core.js') as typeof import('../../lib/license/core.js');
const stateMod = require('../../lib/license/state.js') as typeof import('../../lib/license/state.js');

const { privateKey, publicKey } = generateKeyPairSync('ed25519');
const privateKeyPem = privateKey.export({ type: 'pkcs8', format: 'pem' }).toString();
const publicKeyPem = publicKey.export({ type: 'spki', format: 'pem' }).toString();
const machine = core.machineCodeFromIdentity('guid-a', 'uuid-a');
const otherMachine = core.machineCodeFromIdentity('guid-b', 'uuid-b');
const VERSION = '1.0-draft';
const keyFor = (m = machine, licenseNo = 1001) => core.signLicense({ privateKeyPem, licenseNo, machineValue: m.value });

let dir: string;

function store(overrides: Partial<Parameters<typeof stateMod.createLicenseStore>[0]> = {}) {
  return stateMod.createLicenseStore({
    dir,
    publicKeyPem,
    revoked: [],
    agreementVersion: VERSION,
    machine: () => machine,
    now: () => new Date('2026-11-14T09:00:00Z'),
    ...overrides,
  });
}

const licenseFile = () => path.join(dir, stateMod.FILE_NAME);

beforeEach(() => {
  dir = mkdtempSync(path.join(tmpdir(), 'pebot-license-'));
  vi.spyOn(console, 'error').mockImplementation(() => {});
});
afterEach(() => {
  rmSync(dir, { recursive: true, force: true });
  vi.restoreAllMocks();
});

describe('activation flow', () => {
  test('a fresh install must accept the agreement, then needs a key', () => {
    const s = store();
    expect(s.get()).toMatchObject({ state: 'no-agreement', machineCode: machine.text });
    expect(s.isActive()).toBe(false);
    expect(s.acceptAgreement('0.9-old')).toEqual({ ok: false, reason: 'outdated-agreement' });
    expect(s.acceptAgreement(VERSION)).toMatchObject({ ok: true, status: { state: 'agreement-accepted', reason: 'no-key' } });
  });

  test('a key cannot be activated before the agreement is accepted', () => {
    expect(store().activate(keyFor())).toEqual({ ok: false, reason: 'no-agreement' });
  });

  test('a valid key activates and survives a restart', () => {
    const s = store();
    s.acceptAgreement(VERSION);
    const r = s.activate(`  ${keyFor()}\n`);
    expect(r).toMatchObject({ ok: true, licenseNo: 1001, status: { state: 'active', licenseNo: 1001 } });
    expect(s.isActive()).toBe(true);
    const saved = JSON.parse(readFileSync(licenseFile(), 'utf8'));
    expect(saved).toMatchObject({ key: keyFor().toUpperCase(), activatedAt: '2026-11-14T09:00:00.000Z', agreement: { version: VERSION } });
    // "Restart": a brand-new store reading the same folder, on a different date.
    expect(store({ now: () => new Date('2031-01-01T00:00:00Z') }).get()).toMatchObject({ state: 'active', licenseNo: 1001 });
  });

  test('wrong keys are refused and nothing is saved', () => {
    const s = store();
    s.acceptAgreement(VERSION);
    expect(s.activate(keyFor(otherMachine))).toEqual({ ok: false, reason: 'wrong-machine' });
    expect(s.activate('PEBOT-NOTAKEY')).toEqual({ ok: false, reason: 'invalid' });
    expect(JSON.parse(readFileSync(licenseFile(), 'utf8')).key).toBeNull();
  });

  test('a build without a seller key cannot be activated', () => {
    const s = store({ publicKeyPem: null });
    s.acceptAgreement(VERSION);
    expect(s.activate(keyFor())).toEqual({ ok: false, reason: 'not-configured' });
  });
});

describe('fails closed after activation when something is wrong', () => {
  function activated() {
    const s = store();
    s.acceptAgreement(VERSION);
    s.activate(keyFor());
    return s;
  }

  test('a hand-edited license file is not accepted', () => {
    activated();
    const saved = JSON.parse(readFileSync(licenseFile(), 'utf8'));
    const chars = saved.key.split('');
    chars[30] = chars[30] === 'A' ? 'B' : 'A';
    writeFileSync(licenseFile(), JSON.stringify({ ...saved, key: chars.join('') }));
    expect(store().get()).toMatchObject({ state: 'agreement-accepted', reason: 'invalid' });
  });

  test('a corrupt file means unlicensed, not a crash', () => {
    activated();
    writeFileSync(licenseFile(), '{ half-writ');
    expect(store().get()).toMatchObject({ state: 'no-agreement' });
  });

  test('copying the folder to another PC does not carry the license', () => {
    activated();
    expect(store({ machine: () => otherMachine }).get()).toMatchObject({ state: 'agreement-accepted', reason: 'wrong-machine' });
  });

  test('a revoked license stops working in a release that lists it', () => {
    activated();
    expect(store({ revoked: [1001] }).get()).toMatchObject({ state: 'agreement-accepted', reason: 'revoked' });
  });

  test('a new agreement version asks the owner to accept again', () => {
    activated();
    expect(store({ agreementVersion: '1.1' }).get()).toMatchObject({ state: 'no-agreement' });
  });

  test('if the PC identity cannot be read, Pebot stays locked and says so', () => {
    activated();
    const s = store({
      machine: () => {
        throw new Error('reg.exe blocked');
      },
    });
    expect(s.get()).toMatchObject({ state: 'agreement-accepted', reason: 'machine-unreadable', machineCode: null });
    expect(s.activate(keyFor())).toEqual({ ok: false, reason: 'machine-unreadable' });
  });
});

describe('moving to a new computer', () => {
  test('deactivation removes the key, keeps the agreement, and returns a verifiable code', () => {
    const s = store();
    s.acceptAgreement(VERSION);
    const key = keyFor();
    s.activate(key);
    const r = s.deactivate();
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.status).toMatchObject({ state: 'agreement-accepted', reason: 'no-key' });
    expect(core.verifyDeactivationCode({ code: r.deactivationCode, keyText: key, licenseNo: 1001, machineText: machine.text })).toBe(true);
    expect(JSON.parse(readFileSync(licenseFile(), 'utf8'))).toMatchObject({ key: null, agreement: { version: VERSION } });
  });

  test('there is nothing to deactivate on an unlicensed install', () => {
    expect(store().deactivate()).toEqual({ ok: false, reason: 'not-active' });
  });

  test('licensing only ever writes its own file', () => {
    const s = store();
    writeFileSync(path.join(dir, 'cafeos.db'), 'restaurant data');
    s.acceptAgreement(VERSION);
    s.activate(keyFor());
    s.deactivate();
    expect(readFileSync(path.join(dir, 'cafeos.db'), 'utf8')).toBe('restaurant data');
    expect(existsSync(`${licenseFile()}.${process.pid}.tmp`)).toBe(false);
  });
});

describe('where the license file lives', () => {
  const original = process.env.DATABASE_URL;
  afterEach(() => {
    if (original === undefined) delete process.env.DATABASE_URL;
    else process.env.DATABASE_URL = original;
  });

  test('next to an absolute database path (the installed app)', () => {
    const db = path.join(dir, 'AppData', 'cafeos.db');
    process.env.DATABASE_URL = `file:${db}`;
    expect(stateMod.defaultDataDir()).toBe(path.dirname(db));
  });

  test('relative paths resolve from prisma/, like Prisma does', () => {
    process.env.DATABASE_URL = 'file:./dev.db';
    expect(stateMod.defaultDataDir()).toBe(path.join(process.cwd(), 'prisma'));
    delete process.env.DATABASE_URL;
    expect(stateMod.defaultDataDir()).toBe(path.join(process.cwd(), 'prisma'));
  });
});

test('the process-wide store is shared between server.js and route handlers', () => {
  const g = globalThis as Record<string, unknown>;
  const saved = g.__pebotLicenseStore;
  delete g.__pebotLicenseStore;
  try {
    const a = stateMod.getLicenseStore();
    expect(stateMod.getLicenseStore()).toBe(a);
  } finally {
    if (saved) g.__pebotLicenseStore = saved;
    else delete g.__pebotLicenseStore;
  }
});
