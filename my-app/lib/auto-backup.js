/**
 * Automatic daily backup (spec 022). CommonJS so server.js (the scheduler) and
 * the Next.js routes share it.
 *
 * Copies the SQLite database once a day into <database folder>/backups and, if
 * the owner set one, a second folder (a USB stick or another drive), keeping the
 * newest N copies in each. Settings and the last result live in
 * <database folder>/pebot-backup.json, so no database change is needed.
 */
/* eslint-disable @typescript-eslint/no-require-imports */
const fs = require('fs');
const path = require('path');

const DAY_MS = 24 * 60 * 60 * 1000;
const PREFIX = 'pebot-backup-';
const DEFAULTS = { extraFolder: null, keep: 14, lastAt: null, lastOk: null, lastError: null, lastFiles: [] };

function dbPathFromEnv(env = process.env) {
  const url = env.DATABASE_URL || '';
  if (url.startsWith('file:')) {
    const p = url.slice(5);
    return path.isAbsolute(p) ? p : path.resolve(p);
  }
  return path.join(process.cwd(), 'prisma', 'dev.db');
}

const configPath = (dbPath) => path.join(path.dirname(dbPath), 'pebot-backup.json');
const defaultFolder = (dbPath) => path.join(path.dirname(dbPath), 'backups');

function readConfig(dbPath) {
  try {
    return { ...DEFAULTS, ...JSON.parse(fs.readFileSync(configPath(dbPath), 'utf8')) };
  } catch {
    return { ...DEFAULTS };
  }
}

function writeConfig(dbPath, cfg) {
  fs.writeFileSync(configPath(dbPath), JSON.stringify({ ...DEFAULTS, ...cfg }, null, 2));
}

function pad(n) { return String(n).padStart(2, '0'); }

/** pebot-backup-2026-11-14-0930.db (local time). */
function backupFileName(date) {
  return `${PREFIX}${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}-${pad(date.getHours())}${pad(date.getMinutes())}.db`;
}

/** Due when there is no successful backup in the last 24 hours. */
function isDue(lastOkIso, now = new Date()) {
  if (!lastOkIso) return true;
  const t = Date.parse(lastOkIso);
  return !Number.isFinite(t) || now.getTime() - t >= DAY_MS;
}

/** Backup files to delete so only the newest `keep` remain. Names sort by time. */
function filesToPrune(names, keep) {
  const ours = names.filter((n) => n.startsWith(PREFIX) && n.endsWith('.db')).sort();
  return ours.slice(0, Math.max(0, ours.length - Math.max(1, keep)));
}

/** Reasons a folder can't hold backups, or null when it is fine. */
function folderProblem(folder) {
  if (!folder || typeof folder !== 'string') return 'Choose a folder.';
  if (!path.isAbsolute(folder)) return 'Use a full folder path, like E:\\PebotBackups.';
  try {
    fs.mkdirSync(folder, { recursive: true });
    const probe = path.join(folder, `.pebot-write-test-${process.pid}`);
    fs.writeFileSync(probe, 'ok');
    fs.unlinkSync(probe);
    return null;
  } catch {
    return 'Pebot cannot write to that folder. Is the drive plugged in?';
  }
}

/**
 * A consistent copy without a second database connection: copy, then make sure
 * the file did not change while copying (retry a few times if it did).
 */
function snapshot(dbPath, dest) {
  for (let attempt = 0; attempt < 4; attempt++) {
    const before = fs.statSync(dbPath);
    fs.copyFileSync(dbPath, dest);
    const after = fs.statSync(dbPath);
    if (before.mtimeMs === after.mtimeMs && before.size === after.size) {
      const head = Buffer.alloc(16);
      const fd = fs.openSync(dest, 'r');
      try { fs.readSync(fd, head, 0, 16, 0); } finally { fs.closeSync(fd); }
      if (head.toString('latin1').startsWith('SQLite format 3')) return;
      try { fs.unlinkSync(dest); } catch { /* ignore */ }
      throw new Error('The copy is not a valid database.');
    }
  }
  throw new Error('The database kept changing while copying. Try again in a quiet moment.');
}

/** Run one backup now into the default folder and the extra folder (if set). */
function runBackup(dbPath, now = new Date()) {
  const cfg = readConfig(dbPath);
  const folders = [defaultFolder(dbPath)];
  if (cfg.extraFolder) folders.push(cfg.extraFolder);
  const name = backupFileName(now);
  const files = [];
  const errors = [];
  for (const folder of folders) {
    try {
      const problem = folderProblem(folder);
      if (problem) throw new Error(problem);
      const dest = path.join(folder, name);
      snapshot(dbPath, dest);
      files.push(dest);
      for (const old of filesToPrune(fs.readdirSync(folder), cfg.keep)) {
        try { fs.unlinkSync(path.join(folder, old)); } catch { /* in use: try next time */ }
      }
    } catch (e) {
      errors.push(`${folder}: ${e && e.message ? e.message : String(e)}`);
    }
  }
  const next = {
    ...cfg,
    lastAt: now.toISOString(),
    lastOk: files.length > 0 ? now.toISOString() : cfg.lastOk,
    lastError: errors.length ? errors.join(' · ') : null,
    lastFiles: files,
  };
  writeConfig(dbPath, next);
  return next;
}

/** server.js: check at start and every 30 minutes; back up when due. */
function startScheduler(dbPath = dbPathFromEnv(), log = console) {
  const tick = () => {
    try {
      if (!fs.existsSync(dbPath)) return;
      const cfg = readConfig(dbPath);
      if (!isDue(cfg.lastOk)) return;
      const r = runBackup(dbPath);
      if (r.lastError) log.error('[backup]', r.lastError);
      else log.log('[backup] saved', r.lastFiles.join(', '));
    } catch (e) {
      log.error('[backup] failed', e);
    }
  };
  setTimeout(tick, 60 * 1000).unref?.();
  const timer = setInterval(tick, 30 * 60 * 1000);
  timer.unref?.();
  return timer;
}

module.exports = {
  backupFileName,
  configPath,
  dbPathFromEnv,
  defaultFolder,
  filesToPrune,
  folderProblem,
  isDue,
  readConfig,
  runBackup,
  startScheduler,
  writeConfig,
};
