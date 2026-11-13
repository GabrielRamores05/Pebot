// @ts-check
'use strict';
// The license agreement has one source, legal/pebot-license-agreement.txt. The
// NSIS installer shows the whole file, and the app shows one language at a time.
// Bump AGREEMENT_VERSION whenever the text changes: owners are asked to accept again.

const fs = require('fs');
const path = require('path');

const AGREEMENT_VERSION = '1.0-draft';
const FILIPINO_MARKER = 'FILIPINO / TAGALOG';

function agreementPath() {
  const base = process.env.APP_DIR && process.env.APP_DIR.trim() ? process.env.APP_DIR : process.cwd();
  return path.join(base, 'legal', 'pebot-license-agreement.txt');
}

/**
 * Split the combined text into its English and Filipino halves.
 * @param {string} text
 * @returns {{ en: string, fil: string }}
 */
function splitAgreement(text) {
  const lines = text.replace(/\r\n/g, '\n').split('\n');
  const idx = lines.findIndex((l) => l.trim() === FILIPINO_MARKER);
  if (idx < 0) return { en: text.trim(), fil: text.trim() };
  // Drop the ==== rule lines that frame the marker.
  let enEnd = idx;
  while (enEnd > 0 && /^=+$/.test(lines[enEnd - 1].trim())) enEnd--;
  let filStart = idx + 1;
  while (filStart < lines.length && /^=+$/.test(lines[filStart].trim())) filStart++;
  return {
    en: lines.slice(0, enEnd).join('\n').trim(),
    fil: lines.slice(filStart).join('\n').trim(),
  };
}

/**
 * @param {'en' | 'fil'} lang
 * @param {string} [filePath]
 */
function readAgreement(lang, filePath = agreementPath()) {
  const parts = splitAgreement(fs.readFileSync(filePath, 'utf8'));
  return { version: AGREEMENT_VERSION, lang, text: parts[lang] };
}

module.exports = { AGREEMENT_VERSION, FILIPINO_MARKER, agreementPath, splitAgreement, readAgreement };
