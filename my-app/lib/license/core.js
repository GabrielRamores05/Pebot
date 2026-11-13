// @ts-check
'use strict';
// Pebot license format (spec 015). Plain CommonJS on purpose: server.js and the
// seller tool (tools/pebot-keygen) run under plain Node and must share this exact
// code with the app, or keys issued by the tool would stop verifying.
// Nothing here can mint a key without the seller's private key.

const crypto = require('crypto');

const ALPHABET = '0123456789ABCDEFGHJKMNPQRSTVWXYZ'; // Crockford base32: no I L O U
const FORMAT_VERSION = 1;
const PRODUCT_MAJOR = 1;
const PAYLOAD_BYTES = 15;
const SIGNATURE_BYTES = 64;
const KEY_PREFIX = 'PEBOT-';
const MACHINE_PREFIX = 'PBT';
const DEACT_PREFIX = 'DEACT';
const SIGN_DOMAIN = Buffer.from('PEBOT-LICENSE\0', 'utf8');
const EPOCH_MS = Date.UTC(2026, 0, 1);
const DAY_MS = 86_400_000;
const MACHINE_DATA_CHARS = 11; // 55 bits
const KEY_CHARS = Math.ceil(((PAYLOAD_BYTES + SIGNATURE_BYTES) * 8) / 5);
const DEACT_BYTES = 14; // licenseNo(4) + nonce(3) + mac(7)
const DEACT_CHARS = Math.ceil((DEACT_BYTES * 8) / 5);

/** @param {Buffer} bytes */
function base32Encode(bytes) {
  let out = '';
  let buffer = 0;
  let bits = 0;
  for (const byte of bytes) {
    buffer = (buffer << 8) | byte;
    bits += 8;
    while (bits >= 5) {
      out += ALPHABET[(buffer >>> (bits - 5)) & 31];
      bits -= 5;
    }
    buffer &= (1 << bits) - 1;
  }
  if (bits > 0) out += ALPHABET[(buffer << (5 - bits)) & 31];
  return out;
}

/**
 * @param {string} text normalized base32 (see normalizeBase32)
 * @param {number} byteLength
 * @returns {Buffer | null}
 */
function base32Decode(text, byteLength) {
  if (text.length !== Math.ceil((byteLength * 8) / 5)) return null;
  const out = Buffer.alloc(byteLength);
  let buffer = 0;
  let bits = 0;
  let index = 0;
  for (const ch of text) {
    const value = ALPHABET.indexOf(ch);
    if (value < 0) return null;
    buffer = (buffer << 5) | value;
    bits += 5;
    if (bits >= 8) {
      if (index < byteLength) out[index++] = (buffer >>> (bits - 8)) & 255;
      bits -= 8;
    }
    buffer &= (1 << bits) - 1;
  }
  // Leftover padding bits must be zero, so each value has exactly one spelling
  // and any altered character is rejected.
  if (buffer !== 0) return null;
  return index === byteLength ? out : null;
}

/** Upper-case, drop separators and whitespace, fix look-alike letters. @param {string} text */
function normalizeBase32(text) {
  return text
    .toUpperCase()
    .replace(/[\s-]/g, '')
    .replace(/O/g, '0')
    .replace(/[IL]/g, '1');
}

/** @param {string} dataChars */
function machineCheckChar(dataChars) {
  const digest = crypto.createHash('sha256').update(`pebot-mc-check|${dataChars}`).digest();
  return ALPHABET[digest[0] >>> 3];
}

/** @param {bigint} value 55-bit machine value */
function formatMachineCode(value) {
  let data = '';
  for (let i = MACHINE_DATA_CHARS - 1; i >= 0; i--) {
    data += ALPHABET[Number((value >> BigInt(i * 5)) & BigInt(31))];
  }
  const all = data + machineCheckChar(data);
  return `${MACHINE_PREFIX}-${all.slice(0, 4)}-${all.slice(4, 8)}-${all.slice(8, 12)}`;
}

/**
 * Machine code from the two OS identity strings (research R2).
 * @param {string} primary e.g. Windows MachineGuid
 * @param {string} secondary e.g. SMBIOS UUID
 */
function machineCodeFromIdentity(primary, secondary) {
  const digest = crypto
    .createHash('sha256')
    .update(`pebot-machine-v1|${primary.trim().toLowerCase()}|${secondary.trim().toLowerCase()}`)
    .digest();
  const value = digest.readBigUInt64BE(0) >> BigInt(9); // top 55 bits
  return { text: formatMachineCode(value), value };
}

/**
 * @param {string} input
 * @returns {{ text: string, value: bigint } | null} null when malformed or the check character is wrong
 */
function parseMachineCode(input) {
  if (typeof input !== 'string') return null;
  let s = input.trim().toUpperCase();
  if (s.startsWith(MACHINE_PREFIX)) s = s.slice(MACHINE_PREFIX.length);
  s = normalizeBase32(s);
  if (s.length !== MACHINE_DATA_CHARS + 1) return null;
  for (const ch of s) if (!ALPHABET.includes(ch)) return null;
  const data = s.slice(0, MACHINE_DATA_CHARS);
  if (machineCheckChar(data) !== s[MACHINE_DATA_CHARS]) return null;
  let value = BigInt(0);
  for (const ch of data) value = (value << BigInt(5)) | BigInt(ALPHABET.indexOf(ch));
  return { text: formatMachineCode(value), value };
}

/** @param {bigint} value */
function machineBytes(value) {
  const b = Buffer.alloc(8);
  b.writeBigUInt64BE(value);
  return b.subarray(1);
}

/** @param {Date} date */
function dayNumber(date) {
  const day = Math.floor((date.getTime() - EPOCH_MS) / DAY_MS);
  return Math.min(65535, Math.max(0, day));
}

/**
 * @param {{ licenseNo: number, machineValue: bigint, issuedAt: Date, productMajor?: number }} p
 * @returns {Buffer}
 */
function encodePayload(p) {
  if (!Number.isInteger(p.licenseNo) || p.licenseNo < 1 || p.licenseNo > 0xffffffff) {
    throw new Error('licenseNo must be a positive 32-bit integer');
  }
  const payload = Buffer.alloc(PAYLOAD_BYTES);
  payload[0] = FORMAT_VERSION;
  payload[1] = p.productMajor ?? PRODUCT_MAJOR;
  payload.writeUInt32BE(p.licenseNo, 2);
  machineBytes(p.machineValue).copy(payload, 6);
  payload.writeUInt16BE(dayNumber(p.issuedAt), 13);
  return payload;
}

/** @param {Buffer} payload */
function decodePayload(payload) {
  return {
    formatVersion: payload[0],
    productMajor: payload[1],
    licenseNo: payload.readUInt32BE(2),
    machineValue: Buffer.concat([Buffer.alloc(1), payload.subarray(6, 13)]).readBigUInt64BE(0),
    issuedAt: new Date(EPOCH_MS + payload.readUInt16BE(13) * DAY_MS),
  };
}

/**
 * Seller-side only: needs the private key.
 * @param {{ privateKeyPem: string, licenseNo: number, machineValue: bigint, issuedAt?: Date, productMajor?: number }} p
 */
function signLicense(p) {
  const payload = encodePayload({ ...p, issuedAt: p.issuedAt ?? new Date() });
  const signature = crypto.sign(null, Buffer.concat([SIGN_DOMAIN, payload]), crypto.createPrivateKey(p.privateKeyPem));
  return KEY_PREFIX + base32Encode(Buffer.concat([payload, signature]));
}

/**
 * Extract the license bytes from pasted text or a .lic file's contents.
 * @param {string} input
 * @returns {{ payload: Buffer, signature: Buffer, canonical: string } | null}
 */
function parseLicenseKey(input) {
  if (typeof input !== 'string' || input.length > 4000) return null;
  const line = input
    .split(/\r?\n/)
    .map((l) => l.trim())
    .find((l) => l.toUpperCase().startsWith(KEY_PREFIX));
  const raw = line ?? input.trim();
  if (!raw.toUpperCase().startsWith(KEY_PREFIX)) return null;
  const body = normalizeBase32(raw.slice(KEY_PREFIX.length));
  if (body.length !== KEY_CHARS) return null;
  const bytes = base32Decode(body, PAYLOAD_BYTES + SIGNATURE_BYTES);
  if (!bytes) return null;
  return {
    payload: bytes.subarray(0, PAYLOAD_BYTES),
    signature: bytes.subarray(PAYLOAD_BYTES),
    canonical: KEY_PREFIX + body,
  };
}

/**
 * @typedef {'invalid'|'wrong-machine'|'wrong-version'|'revoked'|'not-configured'} VerifyFailure
 * @param {string} keyText
 * @param {{ publicKeyPem: string | null, machineValue: bigint, revoked?: readonly number[], productMajor?: number }} ctx
 * @returns {{ ok: true, licenseNo: number, issuedAt: Date, canonical: string } | { ok: false, reason: VerifyFailure }}
 */
function verifyLicense(keyText, ctx) {
  if (!ctx.publicKeyPem) return { ok: false, reason: 'not-configured' };
  const parsed = parseLicenseKey(keyText);
  if (!parsed) return { ok: false, reason: 'invalid' };
  let valid = false;
  try {
    valid = crypto.verify(
      null,
      Buffer.concat([SIGN_DOMAIN, parsed.payload]),
      crypto.createPublicKey(ctx.publicKeyPem),
      parsed.signature,
    );
  } catch {
    valid = false;
  }
  if (!valid) return { ok: false, reason: 'invalid' };
  const p = decodePayload(parsed.payload);
  if (p.formatVersion !== FORMAT_VERSION) return { ok: false, reason: 'invalid' };
  if (p.productMajor !== (ctx.productMajor ?? PRODUCT_MAJOR)) return { ok: false, reason: 'wrong-version' };
  if (p.machineValue !== ctx.machineValue) return { ok: false, reason: 'wrong-machine' };
  if ((ctx.revoked ?? []).includes(p.licenseNo)) return { ok: false, reason: 'revoked' };
  return { ok: true, licenseNo: p.licenseNo, issuedAt: p.issuedAt, canonical: parsed.canonical };
}

/** @param {string} canonicalKey @param {number} licenseNo @param {string} machineText @param {Buffer} nonce */
function deactivationMac(canonicalKey, licenseNo, machineText, nonce) {
  const key = crypto.createHash('sha256').update(`pebot-deact-v1|${canonicalKey}`).digest();
  const lic = Buffer.alloc(4);
  lic.writeUInt32BE(licenseNo);
  return crypto
    .createHmac('sha256', key)
    .update(Buffer.concat([lic, Buffer.from(machineText, 'utf8'), nonce]))
    .digest()
    .subarray(0, 7);
}

/**
 * Honest-owner proof that an install gave up its license (research R4).
 * @param {{ keyText: string, licenseNo: number, machineText: string, nonce?: Buffer }} p
 */
function createDeactivationCode(p) {
  const parsed = parseLicenseKey(p.keyText);
  if (!parsed) throw new Error('Cannot create a deactivation code from an invalid key');
  const nonce = p.nonce ?? crypto.randomBytes(3);
  const lic = Buffer.alloc(4);
  lic.writeUInt32BE(p.licenseNo);
  const body = base32Encode(Buffer.concat([lic, nonce, deactivationMac(parsed.canonical, p.licenseNo, p.machineText, nonce)]));
  const groups = body.match(/.{1,4}/g) ?? [];
  return `${DEACT_PREFIX}-${groups.join('-')}`;
}

/** @param {string} input @returns {{ licenseNo: number, nonce: Buffer, mac: Buffer } | null} */
function parseDeactivationCode(input) {
  if (typeof input !== 'string') return null;
  let s = input.trim().toUpperCase();
  if (!s.startsWith(DEACT_PREFIX)) return null;
  s = normalizeBase32(s.slice(DEACT_PREFIX.length));
  if (s.length !== DEACT_CHARS) return null;
  const bytes = base32Decode(s, DEACT_BYTES);
  if (!bytes) return null;
  return { licenseNo: bytes.readUInt32BE(0), nonce: bytes.subarray(4, 7), mac: bytes.subarray(7) };
}

/** @param {{ code: string, keyText: string, licenseNo: number, machineText: string }} p */
function verifyDeactivationCode(p) {
  const parsed = parseDeactivationCode(p.code);
  const key = parseLicenseKey(p.keyText);
  if (!parsed || !key || parsed.licenseNo !== p.licenseNo) return false;
  const expected = deactivationMac(key.canonical, p.licenseNo, p.machineText, parsed.nonce);
  return crypto.timingSafeEqual(expected, parsed.mac);
}

module.exports = {
  ALPHABET,
  FORMAT_VERSION,
  PRODUCT_MAJOR,
  KEY_PREFIX,
  base32Encode,
  base32Decode,
  normalizeBase32,
  machineCodeFromIdentity,
  formatMachineCode,
  parseMachineCode,
  encodePayload,
  decodePayload,
  signLicense,
  parseLicenseKey,
  verifyLicense,
  createDeactivationCode,
  parseDeactivationCode,
  verifyDeactivationCode,
};
