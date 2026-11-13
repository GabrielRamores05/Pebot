import { createRequire } from 'node:module';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, test } from 'vitest';

const require = createRequire(import.meta.url);
const agreement = require('../../lib/license/agreement.js') as typeof import('../../lib/license/agreement.js');

const file = path.join(__dirname, '..', '..', 'legal', 'pebot-license-agreement.txt');
const text = readFileSync(file, 'utf8');

describe('license agreement text', () => {
  test('shows the version the app asks owners to accept', () => {
    expect(text).toContain(`Version ${agreement.AGREEMENT_VERSION}`);
    expect(text).toContain(`Bersyon ${agreement.AGREEMENT_VERSION}`);
  });

  test('is plain ASCII so the Windows installer shows it correctly', () => {
    expect(/^[\x09\x0a\x0d\x20-\x7e]*$/.test(text)).toBe(true);
  });

  test('covers every term the owner decided (FR-022, FR-023)', () => {
    const required = [
      'DRAFT - PENDING REVIEW BY A PHILIPPINE LAWYER',
      'PHP 4,999',
      'ONE restaurant location',
      'as long as we sell and maintain Pebot',
      "12 months' notice",
      'Monday to Saturday, 9:00 AM to 6:00 PM',
      'within 1 business day',
      'same business day',
      'version 1.x updates',
      'up to 3 times in any 12-month period',
      'within 7 days of purchase',
      'BACKUPS ARE YOUR RESPONSIBILITY',
      'limited to the amount you paid',
      'fraud, bad faith, gross negligence',
      'NOT accredited by the Bureau of Internal Revenue',
      'Republic Act No. 10173',
      'Republic Act No. 8792',
      'laws of the Republic of the Philippines',
    ];
    for (const phrase of required) expect(text, phrase).toContain(phrase);
    expect(text.toLowerCase()).not.toContain('no refund');
  });
});

describe('splitAgreement', () => {
  test('gives the app one language at a time', () => {
    const { en, fil } = agreement.splitAgreement(text);
    expect(en.startsWith('PEBOT SOFTWARE LICENSE AGREEMENT')).toBe(true);
    expect(en).not.toContain('KASUNDUAN');
    expect(en).not.toMatch(/={10,}\s*$/);
    expect(fil.startsWith('KASUNDUAN SA LISENSYA NG PEBOT SOFTWARE')).toBe(true);
    expect(fil).not.toContain('PEBOT SOFTWARE LICENSE AGREEMENT');
  });

  test('falls back to the whole text if the Filipino heading is missing', () => {
    expect(agreement.splitAgreement('Only English\r\nhere')).toEqual({ en: 'Only English\r\nhere', fil: 'Only English\r\nhere' });
  });

  test('readAgreement returns the requested language with the version', () => {
    expect(agreement.readAgreement('fil', file)).toMatchObject({ version: agreement.AGREEMENT_VERSION, lang: 'fil' });
    expect(agreement.agreementPath()).toMatch(/legal[\\/]pebot-license-agreement\.txt$/);
  });
});
