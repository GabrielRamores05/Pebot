import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import fs from 'fs';
import os from 'os';
import path from 'path';
// eslint-disable-next-line @typescript-eslint/no-require-imports
const ab = require('../../lib/auto-backup.js');

describe('auto backup helpers (spec 022)', () => {
  it('names files by local date and time', () => {
    expect(ab.backupFileName(new Date(2026, 10, 14, 9, 5))).toBe('pebot-backup-2026-11-14-0905.db');
  });
  it('is due after 24 hours or when never run', () => {
    const now = new Date('2026-11-14T10:00:00Z');
    expect(ab.isDue(null, now)).toBe(true);
    expect(ab.isDue('2026-11-13T11:00:00Z', now)).toBe(false);
    expect(ab.isDue('2026-11-13T10:00:00Z', now)).toBe(true);
  });
  it('keeps only the newest copies and ignores other files', () => {
    const names = ['pebot-backup-2026-11-01-0900.db', 'notes.txt', 'pebot-backup-2026-11-03-0900.db', 'pebot-backup-2026-11-02-0900.db'];
    expect(ab.filesToPrune(names, 2)).toEqual(['pebot-backup-2026-11-01-0900.db']);
    expect(ab.filesToPrune(names, 0)).toEqual(['pebot-backup-2026-11-01-0900.db', 'pebot-backup-2026-11-02-0900.db']);
  });
  it('rejects relative folders', () => {
    expect(ab.folderProblem('backups')).toMatch(/full folder path/);
  });
});

describe('runBackup', () => {
  let dir: string;
  let db: string;
  beforeEach(() => {
    dir = fs.mkdtempSync(path.join(os.tmpdir(), 'pebot-backup-'));
    db = path.join(dir, 'pebot.db');
    fs.writeFileSync(db, Buffer.concat([Buffer.from('SQLite format 3\0', 'latin1'), Buffer.alloc(100)]));
  });
  afterEach(() => fs.rmSync(dir, { recursive: true, force: true }));

  it('copies the database to the default and extra folders and records the result', () => {
    const usb = path.join(dir, 'usb');
    ab.writeConfig(db, { extraFolder: usb, keep: 2 });
    const r = ab.runBackup(db, new Date(2026, 10, 14, 9, 0));
    expect(r.lastError).toBeNull();
    expect(r.lastFiles).toHaveLength(2);
    expect(fs.existsSync(path.join(dir, 'backups', 'pebot-backup-2026-11-14-0900.db'))).toBe(true);
    expect(fs.existsSync(path.join(usb, 'pebot-backup-2026-11-14-0900.db'))).toBe(true);
    ab.runBackup(db, new Date(2026, 10, 15, 9, 0));
    ab.runBackup(db, new Date(2026, 10, 16, 9, 0));
    expect(fs.readdirSync(path.join(dir, 'backups')).sort()).toEqual(['pebot-backup-2026-11-15-0900.db', 'pebot-backup-2026-11-16-0900.db']);
    expect(ab.readConfig(db).lastOk).toBe(new Date(2026, 10, 16, 9, 0).toISOString());
  });

  it('refuses to save a file that is not a database', () => {
    fs.writeFileSync(db, 'not a db');
    const r = ab.runBackup(db, new Date(2026, 10, 14, 9, 0));
    expect(r.lastFiles).toHaveLength(0);
    expect(r.lastError).toMatch(/not a valid database/);
    expect(r.lastOk).toBeNull();
  });
});
