import { describe, expect, it } from 'vitest';
import path from 'path';
// eslint-disable-next-line @typescript-eslint/no-require-imports
const { pickUserDataDir } = require('../../electron/legacy-user-data.js');

const appData = path.join('C:', 'Users', 'owner', 'AppData', 'Roaming');
const dir = (name: string) => path.join(appData, name);
const withDatabasesIn = (...dirs: string[]) => (file: string) =>
  dirs.some((d) => file.toLowerCase() === path.join(d, 'cafeos.db').toLowerCase());

describe('pickUserDataDir (CaféOS → Pebot rename keeps existing data)', () => {
  it('keeps the old data folder when it holds a database and the new one does not', () => {
    const picked = pickUserDataDir({ current: dir('Pebot'), appData, exists: withDatabasesIn(dir('CaféOS')) });
    expect(picked).toBe(dir('CaféOS'));
  });

  it('finds data left under the old package name', () => {
    const picked = pickUserDataDir({ current: dir('Pebot'), appData, exists: withDatabasesIn(dir('cafeos')) });
    expect(picked).toBe(dir('cafeos'));
  });

  it('uses the new folder on a fresh machine', () => {
    const picked = pickUserDataDir({ current: dir('Pebot'), appData, exists: () => false });
    expect(picked).toBe(dir('Pebot'));
  });

  it('stays on the new folder once it has its own database', () => {
    const picked = pickUserDataDir({
      current: dir('Pebot'),
      appData,
      exists: withDatabasesIn(dir('Pebot'), dir('CaféOS')),
    });
    expect(picked).toBe(dir('Pebot'));
  });

  it('does nothing when the current folder already is the old one', () => {
    const picked = pickUserDataDir({ current: dir('cafeos'), appData, exists: () => false });
    expect(picked).toBe(dir('cafeos'));
  });
});
