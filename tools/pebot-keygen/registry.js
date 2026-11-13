// @ts-check
'use strict';
// Seller registry rules (spec 015, data-model "SellerRegistry"). Pure functions
// over a plain object, so they can be unit-tested without touching disk.

const FREE_REACTIVATIONS_PER_YEAR = 3;
const YEAR_MS = 365 * 86_400_000;
const FIRST_LICENSE_NO = 1001;

/**
 * @typedef {{ machineCode: string, issuedAt: string, key: string, kind: 'new' | 'reissue',
 *             deactivationCode: string | null, reason: string | null, override: boolean }} Issue
 * @typedef {{ licenseNo: number, customer: string, contact: string, status: 'active' | 'revoked',
 *             issues: Issue[], revokedAt: string | null, revokeReason: string | null, notes: string[] }} LicenseEntry
 * @typedef {{ nextLicenseNo: number, licenses: LicenseEntry[] }} Registry
 */

/** @returns {Registry} */
function emptyRegistry() {
  return { nextLicenseNo: FIRST_LICENSE_NO, licenses: [] };
}

/** @param {Registry} reg @param {number} licenseNo */
function findLicense(reg, licenseNo) {
  return reg.licenses.find((l) => l.licenseNo === licenseNo) ?? null;
}

/** @param {LicenseEntry} entry */
function currentIssue(entry) {
  return entry.issues[entry.issues.length - 1];
}

/** @param {LicenseEntry} entry @param {Date} now */
function reactivationsLastYear(entry, now) {
  return entry.issues.filter((i) => i.kind === 'reissue' && now.getTime() - Date.parse(i.issuedAt) < YEAR_MS).length;
}

/**
 * @param {Registry} reg
 * @param {{ customer: string, contact: string, machineCode: string, key: (licenseNo: number) => string, now: Date, note?: string }} p
 */
function addLicense(reg, p) {
  const licenseNo = reg.nextLicenseNo;
  /** @type {LicenseEntry} */
  const entry = {
    licenseNo,
    customer: p.customer,
    contact: p.contact,
    status: 'active',
    issues: [
      { machineCode: p.machineCode, issuedAt: p.now.toISOString(), key: p.key(licenseNo), kind: 'new', deactivationCode: null, reason: null, override: false },
    ],
    revokedAt: null,
    revokeReason: null,
    notes: p.note ? [p.note] : [],
  };
  reg.licenses.push(entry);
  reg.nextLicenseNo = licenseNo + 1;
  return entry;
}

/**
 * Checks the rules for moving a license to a new PC. Doesn't change anything.
 * @param {LicenseEntry | null} entry
 * @param {{ deactivationOk: boolean | null, reason?: string, override?: boolean, now: Date }} p
 * @returns {{ ok: true } | { ok: false, error: string }}
 */
function checkReissue(entry, p) {
  if (!entry) return { ok: false, error: 'No license with that number in the registry.' };
  if (entry.status === 'revoked') return { ok: false, error: `License ${entry.licenseNo} is revoked.` };
  if (p.deactivationOk === false) {
    return { ok: false, error: 'The deactivation code does not match this license. Ask the owner to send it again.' };
  }
  if (p.deactivationOk === null && !(p.reason && p.reason.trim())) {
    return { ok: false, error: 'No deactivation code: give --reason "what happened" (e.g. stolen, owner statement via Messenger).' };
  }
  const used = reactivationsLastYear(entry, p.now);
  if (used >= FREE_REACTIVATIONS_PER_YEAR && !p.override) {
    return {
      ok: false,
      error: `License ${entry.licenseNo} already used ${used} free re-activations in the last 12 months. Review the case, then re-run with --override.`,
    };
  }
  return { ok: true };
}

/**
 * @param {LicenseEntry} entry
 * @param {{ machineCode: string, key: string, now: Date, deactivationCode: string | null, reason: string | null, override: boolean }} p
 */
function addReissue(entry, p) {
  entry.issues.push({
    machineCode: p.machineCode,
    issuedAt: p.now.toISOString(),
    key: p.key,
    kind: 'reissue',
    deactivationCode: p.deactivationCode,
    reason: p.reason,
    override: p.override,
  });
  return entry;
}

/** @param {LicenseEntry} entry @param {string} reason @param {Date} now */
function revokeLicense(entry, reason, now) {
  entry.status = 'revoked';
  entry.revokedAt = now.toISOString();
  entry.revokeReason = reason;
  return entry;
}

/** Adds a license number to the revoked list source, keeping it sorted and unique. @param {string} source @param {number} licenseNo */
function addToRevokedSource(source, licenseNo) {
  const marker = '// pebot-keygen:revoked-list';
  if (!source.includes(marker)) throw new Error('revoked.js is missing the pebot-keygen marker');
  const existing = new Set((source.match(/^\s*(\d+),\s*$/gm) ?? []).map((l) => Number(l.trim().replace(',', ''))));
  existing.add(licenseNo);
  const lines = [...existing].sort((a, b) => a - b).map((n) => `  ${n},`);
  return source.replace(/\[\s*\/\/ pebot-keygen:revoked-list[\s\S]*?\]/, `[\n  ${marker}\n${lines.join('\n')}\n]`);
}

module.exports = {
  FREE_REACTIVATIONS_PER_YEAR,
  emptyRegistry,
  findLicense,
  currentIssue,
  reactivationsLastYear,
  addLicense,
  checkReissue,
  addReissue,
  revokeLicense,
  addToRevokedSource,
};
