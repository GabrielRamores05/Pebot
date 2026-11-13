// @ts-check
'use strict';
// Reads the two OS identity values that the Machine Code is derived from
// (spec 015, research R2). If a value can't be read, this throws. It never falls
// back to a random value: a code that changes between restarts would lock out a
// paying customer.

const { execFileSync } = require('child_process');
const fs = require('fs');
const { machineCodeFromIdentity } = require('./core.js');

/** @typedef {(cmd: string, args: string[]) => string} Exec */
/** @typedef {(path: string) => string} ReadFile */

/** @type {Exec} */
const defaultExec = (cmd, args) =>
  execFileSync(cmd, args, { encoding: 'utf8', timeout: 15_000, windowsHide: true, stdio: ['ignore', 'pipe', 'ignore'] });

/** @type {ReadFile} */
const defaultReadFile = (p) => fs.readFileSync(p, 'utf8');

const UUID_RE = /[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}/;

/**
 * @param {() => string} fn
 * @param {number} attempts
 */
function retry(fn, attempts) {
  /** @type {unknown} */
  let last;
  for (let i = 0; i < attempts; i++) {
    try {
      return fn();
    } catch (e) {
      last = e;
    }
  }
  throw last;
}

/**
 * @param {{ platform?: string, exec?: Exec, readFile?: ReadFile, attempts?: number }} [opts]
 * @returns {{ primary: string, secondary: string }}
 */
function readMachineIdentity(opts = {}) {
  const platform = opts.platform ?? process.platform;
  const exec = opts.exec ?? defaultExec;
  const readFile = opts.readFile ?? defaultReadFile;
  const attempts = opts.attempts ?? 3;

  if (platform === 'win32') {
    const primary = retry(() => {
      const out = exec('reg', ['query', 'HKLM\\SOFTWARE\\Microsoft\\Cryptography', '/v', 'MachineGuid', '/reg:64']);
      const m = /MachineGuid\s+REG_SZ\s+(\S+)/i.exec(out);
      if (!m) throw new Error('MachineGuid not found');
      return m[1];
    }, attempts);
    const secondary = retry(() => {
      const out = exec('powershell.exe', [
        '-NoProfile',
        '-NonInteractive',
        '-Command',
        '(Get-CimInstance -ClassName Win32_ComputerSystemProduct).UUID',
      ]);
      const m = UUID_RE.exec(out);
      if (!m) throw new Error('SMBIOS UUID not found');
      return m[0];
    }, attempts);
    return { primary, secondary };
  }

  if (platform === 'darwin') {
    const out = retry(() => exec('ioreg', ['-rd1', '-c', 'IOPlatformExpertDevice']), attempts);
    const m = /"IOPlatformUUID"\s*=\s*"([^"]+)"/.exec(out);
    if (!m) throw new Error('IOPlatformUUID not found');
    return { primary: m[1], secondary: 'darwin' };
  }

  // Linux and other dev OSes. product_uuid often needs root, so it's optional,
  // but whether it's readable doesn't change between boots.
  const primary = readFile('/etc/machine-id').trim();
  if (!primary) throw new Error('/etc/machine-id is empty');
  let secondary = 'no-dmi';
  try {
    secondary = readFile('/sys/class/dmi/id/product_uuid').trim() || 'no-dmi';
  } catch {
    secondary = 'no-dmi';
  }
  return { primary, secondary };
}

/** @param {Parameters<typeof readMachineIdentity>[0]} [opts] */
function getMachineCode(opts) {
  const { primary, secondary } = readMachineIdentity(opts);
  return machineCodeFromIdentity(primary, secondary);
}

module.exports = { readMachineIdentity, getMachineCode };
