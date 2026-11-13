#!/usr/bin/env node
// @ts-check
'use strict';
// pebot-keygen: SELLER-ONLY tool for issuing Pebot license keys (spec 015).
// It is never shipped in the installer. Your private key lives in your seller
// folder, never in this repository. See README.md in this folder.

const crypto = require('crypto');
const fs = require('fs');
const os = require('os');
const path = require('path');
const core = require('../../my-app/lib/license/core.js');
const reg = require('./registry.js');

const REPO_ROOT = path.resolve(__dirname, '..', '..');
const PUBLIC_KEY_FILE = path.join(REPO_ROOT, 'my-app', 'lib', 'license', 'public-key.js');
const REVOKED_FILE = path.join(REPO_ROOT, 'my-app', 'lib', 'license', 'revoked.js');

const SWITCHES = new Set(['override', 'json', 'help']);

/** @param {string[]} argv */
function parseArgs(argv) {
  /** @type {Record<string, string | boolean>} */
  const flags = {};
  /** @type {string[]} */
  const positional = [];
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a.startsWith('--')) {
      const name = a.slice(2);
      const next = argv[i + 1];
      if (!SWITCHES.has(name) && next !== undefined && !next.startsWith('--')) {
        flags[name] = next;
        i++;
      } else {
        flags[name] = true;
      }
    } else {
      positional.push(a);
    }
  }
  return { flags, positional };
}

/** @param {string} msg */
function die(msg) {
  console.error(`\n  ✗ ${msg}\n`);
  process.exit(1);
}

/** @param {Record<string, string | boolean>} flags @param {string} name */
function str(flags, name) {
  const v = flags[name];
  return typeof v === 'string' && v.trim() ? v.trim() : null;
}

/** @param {Record<string, string | boolean>} flags */
function sellerDir(flags) {
  return path.resolve(str(flags, 'dir') ?? process.env.PEBOT_SELLER_DIR ?? path.join(os.homedir(), 'PebotSeller'));
}

/** @param {string} dir */
function paths(dir) {
  return {
    privateKey: path.join(dir, 'private-key.pem'),
    registry: path.join(dir, 'registry.json'),
    licenses: path.join(dir, 'licenses'),
  };
}

/** @param {string} dir @returns {import('./registry.js').Registry} */
function loadRegistry(dir) {
  const p = paths(dir).registry;
  if (!fs.existsSync(p)) die(`No registry at ${p}. Run "pebot-keygen init" first (or pass --dir).`);
  return JSON.parse(fs.readFileSync(p, 'utf8'));
}

/** Writes through a temp file and keeps a .bak of the previous registry. @param {string} dir @param {import('./registry.js').Registry} data */
function saveRegistry(dir, data) {
  const p = paths(dir).registry;
  if (fs.existsSync(p)) fs.copyFileSync(p, `${p}.bak`);
  fs.writeFileSync(`${p}.tmp`, JSON.stringify(data, null, 2));
  fs.renameSync(`${p}.tmp`, p);
}

/** @param {string} dir */
function loadPrivateKey(dir) {
  const p = paths(dir).privateKey;
  if (!fs.existsSync(p)) die(`No private key at ${p}. Run "pebot-keygen init" first (or pass --dir).`);
  return fs.readFileSync(p, 'utf8');
}

/** @param {string} text */
function slug(text) {
  return text.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 40) || 'customer';
}

/** @param {string} dir @param {number} licenseNo @param {string} machine @param {string} customer @param {string} key */
function writeLicFile(dir, licenseNo, machine, customer, key) {
  const dirPath = paths(dir).licenses;
  fs.mkdirSync(dirPath, { recursive: true });
  const file = path.join(dirPath, `${licenseNo}-${machine}-${slug(customer)}.lic`);
  fs.writeFileSync(file, `${key}\n# Licensed to ${customer}\n# License ${licenseNo}\n# Machine ${machine}\n`);
  return file;
}

/** @param {number} licenseNo @param {string} customer @param {string} machine @param {string} key @param {string} file */
function printKey(licenseNo, customer, machine, key, file) {
  console.log(`
  ✓ License #${licenseNo} for ${customer}
    Machine Code: ${machine}

  Send this key to the customer (copy the whole line):

${key}

  License file (send this instead if pasting is hard):
    ${file}
`);
}

const commands = {
  /** @param {Record<string, string | boolean>} flags */
  init(flags) {
    const dir = sellerDir(flags);
    const p = paths(dir);
    if (fs.existsSync(p.privateKey)) {
      die(`A private key already exists at ${p.privateKey}. Refusing to overwrite it: every key you issued depends on it.`);
    }
    fs.mkdirSync(dir, { recursive: true });
    const { privateKey, publicKey } = crypto.generateKeyPairSync('ed25519');
    fs.writeFileSync(p.privateKey, privateKey.export({ type: 'pkcs8', format: 'pem' }), { mode: 0o600 });
    if (!fs.existsSync(p.registry)) saveRegistry(dir, reg.emptyRegistry());
    const pem = String(publicKey.export({ type: 'spki', format: 'pem' })).trim();
    const source = fs.readFileSync(PUBLIC_KEY_FILE, 'utf8');
    const pattern = /const PUBLIC_KEY_PEM = [\s\S]*?;\r?\n/;
    if (!pattern.test(source)) die(`Couldn't find PUBLIC_KEY_PEM in ${PUBLIC_KEY_FILE}. Your private key was created; add the public key by hand:\n\n${pem}`);
    const updated = source.replace(pattern, `const PUBLIC_KEY_PEM = ${JSON.stringify(pem + '\n')};\n`);
    fs.writeFileSync(PUBLIC_KEY_FILE, updated);
    console.log(`
  ✓ Seller keys created.

    Private key : ${p.privateKey}
    Registry    : ${p.registry}
    Public key  : written into my-app/lib/license/public-key.js (commit this file)

  IMPORTANT. Do this now:
    1. Back up the folder ${dir} to TWO places, e.g. a USB stick kept somewhere
       safe and an encrypted cloud or password-manager copy.
    2. Never send private-key.pem to anyone, never put it in the repo or on GitHub,
       and don't keep the only copy on a laptop you carry around.
    3. If you lose it you can't issue keys for this version of Pebot.
       If someone copies it they can make free keys.
    4. Rebuild the installer so it contains the new public key.
`);
  },

  /** @param {Record<string, string | boolean>} flags */
  issue(flags) {
    const dir = sellerDir(flags);
    const machineIn = str(flags, 'machine');
    const customer = str(flags, 'customer');
    const contact = str(flags, 'contact');
    if (!machineIn || !customer || !contact) die('Usage: issue --machine PBT-XXXX-XXXX-XXXX --customer "Name" --contact "0917… / email"');
    const machine = core.parseMachineCode(machineIn);
    if (!machine) die(`"${machineIn}" is not a valid Machine Code. Ask the customer to copy it again (it looks like PBT-7K2M-QX9D-41HT).`);
    const privateKeyPem = loadPrivateKey(dir);
    const data = loadRegistry(dir);
    const now = new Date();
    const entry = reg.addLicense(data, {
      customer,
      contact,
      machineCode: machine.text,
      now,
      note: str(flags, 'note') ?? undefined,
      key: (licenseNo) => core.signLicense({ privateKeyPem, licenseNo, machineValue: machine.value, issuedAt: now }),
    });
    saveRegistry(dir, data);
    const key = reg.currentIssue(entry).key;
    printKey(entry.licenseNo, customer, machine.text, key, writeLicFile(dir, entry.licenseNo, machine.text, customer, key));
  },

  /** @param {Record<string, string | boolean>} flags */
  reissue(flags) {
    const dir = sellerDir(flags);
    const licenseNo = Number(str(flags, 'license'));
    const machineIn = str(flags, 'machine');
    if (!Number.isInteger(licenseNo) || !machineIn) {
      die('Usage: reissue --license 1001 --machine PBT-… (--deactivation DEACT-… | --reason "what happened") [--override]');
    }
    const machine = core.parseMachineCode(/** @type {string} */ (machineIn));
    if (!machine) die(`"${machineIn}" is not a valid Machine Code.`);
    const data = loadRegistry(dir);
    const entry = reg.findLicense(data, licenseNo);
    const deactivationCode = str(flags, 'deactivation');
    let deactivationOk = null;
    if (deactivationCode && entry) {
      const current = reg.currentIssue(entry);
      deactivationOk = core.verifyDeactivationCode({ code: deactivationCode, keyText: current.key, licenseNo, machineText: current.machineCode });
    }
    const now = new Date();
    const reason = str(flags, 'reason');
    const override = flags.override === true;
    const check = reg.checkReissue(entry, { deactivationOk, reason: reason ?? undefined, override, now });
    if (!check.ok) die(check.error);
    const e = /** @type {import('./registry.js').LicenseEntry} */ (entry);
    const privateKeyPem = loadPrivateKey(dir);
    const key = core.signLicense({ privateKeyPem, licenseNo, machineValue: machine.value, issuedAt: now });
    reg.addReissue(e, { machineCode: machine.text, key, now, deactivationCode, reason, override });
    saveRegistry(dir, data);
    printKey(licenseNo, e.customer, machine.text, key, writeLicFile(dir, licenseNo, machine.text, e.customer, key));
    console.log(`  Re-activations in the last 12 months: ${reg.reactivationsLastYear(e, now)} of ${reg.FREE_REACTIVATIONS_PER_YEAR} free.\n`);
  },

  /** @param {Record<string, string | boolean>} flags @param {string[]} positional */
  'verify-deactivation'(flags, positional) {
    const code = positional[0] ?? str(flags, 'code');
    if (!code) die('Usage: verify-deactivation DEACT-XXXX-…');
    const parsed = core.parseDeactivationCode(/** @type {string} */ (code));
    if (!parsed) die('That is not a valid deactivation code. Ask the owner to send it again.');
    const p = /** @type {NonNullable<typeof parsed>} */ (parsed);
    const entry = reg.findLicense(loadRegistry(sellerDir(flags)), p.licenseNo);
    if (!entry) die(`The code is for license #${p.licenseNo}, which isn't in your registry.`);
    const e = /** @type {import('./registry.js').LicenseEntry} */ (entry);
    const current = reg.currentIssue(e);
    const ok = core.verifyDeactivationCode({ code: /** @type {string} */ (code), keyText: current.key, licenseNo: e.licenseNo, machineText: current.machineCode });
    if (!ok) die(`The code does NOT match license #${e.licenseNo} (${e.customer}) on ${current.machineCode}.`);
    console.log(`\n  ✓ Valid: license #${e.licenseNo}, ${e.customer}, was removed from ${current.machineCode}.\n    Next: reissue --license ${e.licenseNo} --machine <new code> --deactivation ${code}\n`);
  },

  /** @param {Record<string, string | boolean>} flags */
  list(flags) {
    const data = loadRegistry(sellerDir(flags));
    const now = new Date();
    if (flags.json === true) {
      console.log(JSON.stringify(data, null, 2));
      return;
    }
    if (data.licenses.length === 0) {
      console.log('\n  No licenses issued yet.\n');
      return;
    }
    const rows = data.licenses.map((l) => ({
      'License': `#${l.licenseNo}`,
      'Customer': l.customer,
      'Contact': l.contact,
      'Machine': reg.currentIssue(l).machineCode,
      'First issued': new Date(l.issues[0].issuedAt).toLocaleDateString('en-CA'),
      'Re-activations (12 mo)': `${reg.reactivationsLastYear(l, now)}/${reg.FREE_REACTIVATIONS_PER_YEAR}`,
      'Status': l.status,
    }));
    console.table(rows);
  },

  /** @param {Record<string, string | boolean>} flags */
  revoke(flags) {
    const dir = sellerDir(flags);
    const licenseNo = Number(str(flags, 'license'));
    const reason = str(flags, 'reason');
    if (!Number.isInteger(licenseNo) || !reason) die('Usage: revoke --license 1001 --reason "refunded 2026-11-20"');
    const data = loadRegistry(dir);
    const entry = reg.findLicense(data, licenseNo);
    if (!entry) die(`No license #${licenseNo} in the registry.`);
    reg.revokeLicense(/** @type {import('./registry.js').LicenseEntry} */ (entry), /** @type {string} */ (reason), new Date());
    saveRegistry(dir, data);
    fs.writeFileSync(REVOKED_FILE, reg.addToRevokedSource(fs.readFileSync(REVOKED_FILE, 'utf8'), licenseNo));
    console.log(`\n  ✓ License #${licenseNo} revoked and added to my-app/lib/license/revoked.js.\n    It stops working for the customer once they install a release built after this. Commit revoked.js.\n`);
  },
};

function help() {
  console.log(`
  pebot-keygen: issue Pebot license keys (seller only)

    init                                   create your seller keys (once)
    issue --machine PBT-… --customer "…" --contact "…" [--note "…"]
    reissue --license N --machine PBT-… (--deactivation DEACT-… | --reason "…") [--override]
    verify-deactivation DEACT-…
    list [--json]
    revoke --license N --reason "…"

  Seller folder: --dir <path>, or PEBOT_SELLER_DIR, default ~/PebotSeller
`);
}

function main() {
  const [command, ...rest] = process.argv.slice(2);
  const { flags, positional } = parseArgs(rest);
  const fn = /** @type {Record<string, (f: typeof flags, p: string[]) => void>} */ (commands)[command ?? ''];
  if (!fn) {
    help();
    process.exit(command ? 1 : 0);
  }
  fn(flags, positional);
}

if (require.main === module) main();

module.exports = { parseArgs };
