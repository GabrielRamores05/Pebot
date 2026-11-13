// @ts-check
'use strict';
// License state for this install (spec 015, data-model "ActivationRecord").
// server.js and the Next.js route handlers load this file separately (webpack
// bundles routes), so the live store is kept on globalThis to make them share one.

const fs = require('fs');
const path = require('path');
const core = require('./core.js');
const { getMachineCode } = require('./machine-id.js');
const { PUBLIC_KEY_PEM } = require('./public-key.js');
const { REVOKED_LICENSES } = require('./revoked.js');
const { AGREEMENT_VERSION } = require('./agreement.js');

const FILE_NAME = 'pebot-license.json';

/**
 * @typedef {{ version: string, acceptedAt: string }} AgreementRecord
 * @typedef {{ agreement: AgreementRecord | null, key: string | null, activatedAt: string | null }} ActivationRecord
 * @typedef {'invalid'|'wrong-machine'|'wrong-version'|'revoked'|'not-configured'|'machine-unreadable'|'no-key'} LicenseReason
 * @typedef {{
 *   state: 'no-agreement' | 'agreement-accepted' | 'active',
 *   reason: LicenseReason | null,
 *   licenseNo: number | null,
 *   activatedAt: string | null,
 *   agreementVersion: string,
 *   machineCode: string | null,
 * }} LicenseStatus
 * @typedef {{
 *   dir: string,
 *   publicKeyPem: string | null,
 *   revoked: readonly number[],
 *   agreementVersion: string,
 *   machine: () => { text: string, value: bigint },
 *   now?: () => Date,
 * }} LicenseContext
 */

/** Directory holding the SQLite file. Prisma resolves relative paths from prisma/. */
function defaultDataDir() {
  const url = (process.env.DATABASE_URL || '').trim();
  if (url.startsWith('file:')) {
    const p = url.slice(5).split('?')[0];
    const abs = path.isAbsolute(p) ? p : path.resolve(process.cwd(), 'prisma', p);
    return path.dirname(abs);
  }
  return path.join(process.cwd(), 'prisma');
}

/** @param {string} dir @returns {ActivationRecord} */
function readRecord(dir) {
  try {
    const raw = JSON.parse(fs.readFileSync(path.join(dir, FILE_NAME), 'utf8'));
    return {
      agreement:
        raw && raw.agreement && typeof raw.agreement.version === 'string' && typeof raw.agreement.acceptedAt === 'string'
          ? { version: raw.agreement.version, acceptedAt: raw.agreement.acceptedAt }
          : null,
      key: raw && typeof raw.key === 'string' ? raw.key : null,
      activatedAt: raw && typeof raw.activatedAt === 'string' ? raw.activatedAt : null,
    };
  } catch {
    // Missing or corrupt file means unlicensed. The key can be pasted again.
    return { agreement: null, key: null, activatedAt: null };
  }
}

/** Atomic write: a crash mid-write can't leave a half-written license. @param {string} dir @param {ActivationRecord} record */
function writeRecord(dir, record) {
  fs.mkdirSync(dir, { recursive: true });
  const target = path.join(dir, FILE_NAME);
  const tmp = `${target}.${process.pid}.tmp`;
  fs.writeFileSync(tmp, JSON.stringify(record, null, 2), 'utf8');
  fs.renameSync(tmp, target);
}

/**
 * Pure evaluation of a record against this machine.
 * @param {ActivationRecord} record
 * @param {{ text: string, value: bigint } | null} machine
 * @param {Pick<LicenseContext, 'publicKeyPem' | 'revoked' | 'agreementVersion'>} ctx
 * @returns {LicenseStatus}
 */
function evaluate(record, machine, ctx) {
  /** @type {LicenseStatus} */
  const base = {
    state: 'no-agreement',
    reason: null,
    licenseNo: null,
    activatedAt: null,
    agreementVersion: ctx.agreementVersion,
    machineCode: machine ? machine.text : null,
  };
  if (!record.agreement || record.agreement.version !== ctx.agreementVersion) return base;
  if (!machine) return { ...base, state: 'agreement-accepted', reason: 'machine-unreadable' };
  if (!record.key) return { ...base, state: 'agreement-accepted', reason: 'no-key' };
  const result = core.verifyLicense(record.key, {
    publicKeyPem: ctx.publicKeyPem,
    machineValue: machine.value,
    revoked: ctx.revoked,
  });
  if (!result.ok) return { ...base, state: 'agreement-accepted', reason: result.reason };
  return { ...base, state: 'active', licenseNo: result.licenseNo, activatedAt: record.activatedAt };
}

/** @param {LicenseContext} ctx */
function createLicenseStore(ctx) {
  const now = ctx.now ?? (() => new Date());
  /** @type {{ text: string, value: bigint } | null | undefined} */
  let machine;
  /** @type {LicenseStatus | null} */
  let status = null;

  function getMachine() {
    if (machine === undefined) {
      try {
        machine = ctx.machine();
      } catch (e) {
        console.error('[license] Could not read this PC\'s identity:', e instanceof Error ? e.message : e);
        machine = null;
      }
    }
    return machine;
  }

  function refresh() {
    status = evaluate(readRecord(ctx.dir), getMachine(), ctx);
    return status;
  }

  return {
    /** @returns {LicenseStatus} */
    get() {
      return status ?? refresh();
    },
    refresh,
    isActive() {
      return (status ?? refresh()).state === 'active';
    },
    /** @param {string} version */
    acceptAgreement(version) {
      if (version !== ctx.agreementVersion) return { ok: false, reason: 'outdated-agreement' };
      const record = readRecord(ctx.dir);
      writeRecord(ctx.dir, { ...record, agreement: { version, acceptedAt: now().toISOString() } });
      return { ok: true, status: refresh() };
    },
    /** @param {string} keyText */
    activate(keyText) {
      const record = readRecord(ctx.dir);
      if (!record.agreement || record.agreement.version !== ctx.agreementVersion) {
        return /** @type {const} */ ({ ok: false, reason: 'no-agreement' });
      }
      const m = getMachine();
      if (!m) return /** @type {const} */ ({ ok: false, reason: 'machine-unreadable' });
      const result = core.verifyLicense(keyText, { publicKeyPem: ctx.publicKeyPem, machineValue: m.value, revoked: ctx.revoked });
      if (!result.ok) return /** @type {const} */ ({ ok: false, reason: result.reason });
      writeRecord(ctx.dir, { ...record, key: result.canonical, activatedAt: now().toISOString() });
      return /** @type {const} */ ({ ok: true, status: refresh(), licenseNo: result.licenseNo });
    },
    /** Gives up the license on this PC. Restaurant data is not touched. */
    deactivate() {
      const current = refresh();
      const record = readRecord(ctx.dir);
      const m = getMachine();
      if (current.state !== 'active' || !record.key || !m || current.licenseNo === null) {
        return /** @type {const} */ ({ ok: false, reason: 'not-active' });
      }
      const code = core.createDeactivationCode({ keyText: record.key, licenseNo: current.licenseNo, machineText: m.text });
      writeRecord(ctx.dir, { ...record, key: null, activatedAt: null });
      return /** @type {const} */ ({ ok: true, deactivationCode: code, licenseNo: current.licenseNo, status: refresh() });
    },
  };
}

/** @typedef {ReturnType<typeof createLicenseStore>} LicenseStore */

const GLOBAL_KEY = '__pebotLicenseStore';

/** The process-wide store for the real install. @returns {LicenseStore} */
function getLicenseStore() {
  const g = /** @type {Record<string, LicenseStore | undefined>} */ (/** @type {unknown} */ (globalThis));
  let store = g[GLOBAL_KEY];
  if (!store) {
    store = createLicenseStore({
      dir: defaultDataDir(),
      publicKeyPem: PUBLIC_KEY_PEM,
      revoked: REVOKED_LICENSES,
      agreementVersion: AGREEMENT_VERSION,
      machine: () => getMachineCode(),
    });
    g[GLOBAL_KEY] = store;
  }
  return store;
}

module.exports = { FILE_NAME, defaultDataDir, readRecord, writeRecord, evaluate, createLicenseStore, getLicenseStore };
