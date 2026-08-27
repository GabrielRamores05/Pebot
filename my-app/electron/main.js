/**
 * CaféOS – Electron Main Process
 *
 * Production paths (asar: false, electron-builder):
 *   resources/app/               ← files bundle (.next, node_modules, server.js, etc.)
 *   resources/prisma/dev.db      ← extraResources
 *   resources/icon.png           ← extraResources
 */

const { app, BrowserWindow, shell, Menu, Tray, nativeImage, dialog } = require('electron');
const path = require('path');
const { spawn } = require('child_process');
const http = require('http');
const fs = require('fs');
const crypto = require('crypto');

const PORT = 3000;
const isDev = !app.isPackaged;

let mainWindow = null;
let logWindow = null;
let serverProcess = null;
let tray = null;

// ─── File logger ──────────────────────────────────────────────────────────────
const LOG_FILE = path.join(app.getPath('userData'), 'cafeos.log');
// Clear log on each startup
try { fs.writeFileSync(LOG_FILE, ''); } catch (_) {}
function log(msg) {
  const line = `[${new Date().toISOString()}] ${msg}\n`;
  process.stdout.write(line);
  try { fs.appendFileSync(LOG_FILE, line); } catch (_) {}
}

// ─── Paths ────────────────────────────────────────────────────────────────────
const APP_DIR = isDev
  ? path.join(__dirname, '..')
  : path.join(process.resourcesPath, 'app');

const SERVER_SCRIPT = isDev
  ? path.join(__dirname, '..', 'server.js')
  : path.join(process.resourcesPath, 'app', 'server.js');

const ICON_PATH = isDev
  ? path.join(__dirname, '..', 'public', 'icons', 'icon-192.png')
  : path.join(process.resourcesPath, 'icon.png');

const ICON_32_PATH = isDev
  ? path.join(__dirname, '..', 'public', 'icons', 'icon-32.png')
  : path.join(process.resourcesPath, 'icon-32.png');

function getInstallJwtSecret() {
  const secretPath = path.join(app.getPath('userData'), 'jwt-secret');
  if (fs.existsSync(secretPath)) {
    return fs.readFileSync(secretPath, 'utf8').trim();
  }

  const secret = crypto.randomBytes(32).toString('hex');
  fs.writeFileSync(secretPath, `${secret}\n`, { mode: 0o600 });
  return secret;
}

// ─── Database setup ───────────────────────────────────────────────────────────
function setupDatabase() {
  const userDataPath = app.getPath('userData');
  const dbDest = path.join(userDataPath, 'cafeos.db');

  process.env.DATABASE_URL = `file:${dbDest}`;

  if (!fs.existsSync(dbDest)) {
    const dbSrc = isDev
      ? path.join(__dirname, '..', 'prisma', 'dev.db')
      : path.join(process.resourcesPath, 'prisma', 'dev.db');

    if (fs.existsSync(dbSrc)) {
      fs.copyFileSync(dbSrc, dbDest);
      log('DB copied to: ' + dbDest);
    } else {
      log('WARNING: No seed DB found, starting fresh at: ' + dbDest);
    }
  } else {
    log('Using existing DB at: ' + dbDest);
  }
}

// ─── Run prisma db push to sync schema ───────────────────────────────────────
function migrateDatabase() {
  return new Promise(async (resolve, reject) => {
    const prismaCli = isDev
      ? path.join(__dirname, '..', 'node_modules', 'prisma', 'build', 'index.js')
      : path.join(process.resourcesPath, 'app', 'node_modules', 'prisma', 'build', 'index.js');

    const schemaPath = isDev
      ? path.join(__dirname, '..', 'prisma', 'schema.prisma')
      : path.join(process.resourcesPath, 'app', 'prisma', 'schema.prisma');

     if (!fs.existsSync(prismaCli)) {
      log('Prisma CLI not found at: ' + prismaCli + ' — running ensureSchema + verifySchema.');
      return ensureSchema()
        .then(() => verifySchema())
        .then(() => resolve({ success: true, skipped: true }))
        .catch((verifyErr) => {
          log('Schema fix/verify failed (Prisma CLI missing): ' + verifyErr.message);
          reject(verifyErr);
        });
    }

    await ensureSchema();
    log('Running prisma db push...');
    // Prisma writes its cache relative to the CLI's node_modules — inside
    // Program Files on installed builds, which is read-only for normal users.
    // Point every writable location at the user-data folder instead.
    const userDataDir = app.getPath('userData');
    const cacheDir = path.join(userDataDir, '.cache');
    const proc = spawn(process.execPath, [prismaCli, 'db', 'push', '--skip-generate', `--schema=${schemaPath}`], {
      cwd: userDataDir,
      env: {
        ...process.env,
        ELECTRON_RUN_AS_NODE: '1',
        DATABASE_URL: process.env.DATABASE_URL,
        USERPROFILE: userDataDir,
        HOME: userDataDir,
        APPDATA: path.join(userDataDir, 'AppData', 'Roaming'),
        XDG_CACHE_HOME: cacheDir,
        npm_config_cache: path.join(cacheDir, 'npm'),
      },
      stdio: 'pipe',
      shell: false,
    });

    let stdout = '';
    let stderr = '';

    proc.stdout.on('data', (d) => {
      const msg = d.toString().trim();
      if (msg) {
        stdout += msg + '\n';
        log('[prisma] ' + msg);
      }
    });
    proc.stderr.on('data', (d) => {
      const msg = d.toString().trim();
      if (msg) {
        stderr += msg + '\n';
        log('[prisma:err] ' + msg);
      }
    });
    let hasRetriedDataLoss = false;
    proc.on('exit', (code) => {
      log('prisma db push exited with code ' + code);
      if (code === 0) {
        verifySchema()
          .then(() => resolve({ success: true }))
          .catch((verifyErr) => {
            log('Schema verification failed: ' + verifyErr.message);
            reject(verifyErr);
          });
      } else {
        const errorMsg = stderr || 'prisma db push failed with code ' + code;
        if (!hasRetriedDataLoss && /without a default value|existing rows|cannot be executed|It is not possible/i.test(errorMsg)) {
          hasRetriedDataLoss = true;
          log('Retrying db push with --accept-data-loss (last resort)...');
          const retryProc = spawn(process.execPath, [prismaCli, 'db', 'push', '--skip-generate', '--accept-data-loss', `--schema=${schemaPath}`], {
            cwd: APP_DIR,
            env: {
              ...process.env,
              ELECTRON_RUN_AS_NODE: '1',
              DATABASE_URL: process.env.DATABASE_URL,
            },
            stdio: 'pipe',
            shell: false,
          });
          retryProc.stdout.on('data', (d) => { const m = d.toString().trim(); if (m) log('[prisma:retry] ' + m); });
          retryProc.stderr.on('data', (d) => { const m = d.toString().trim(); if (m) log('[prisma:retry:err] ' + m); });
          retryProc.on('exit', (retryCode) => {
            log('prisma db push (retry) exited with code ' + retryCode);
            if (retryCode === 0) {
              verifySchema()
                .then(() => resolve({ success: true }))
                .catch((verifyErr) => {
                  log('Schema verification failed after retry: ' + verifyErr.message);
                  reject(verifyErr);
                });
            } else {
              log('MIGRATION FAILED (retry): ' + (stderr || 'code ' + retryCode));
              reject(new Error(errorMsg + ' (retry with --accept-data-loss also failed)'));
            }
          });
          retryProc.on('error', (err) => {
            log('prisma db push (retry) error: ' + err.message);
            reject(err);
          });
        } else {
          log('MIGRATION FAILED: ' + errorMsg);
          reject(new Error(errorMsg));
        }
      }
    });
    proc.on('error', (err) => {
      log('prisma db push error: ' + err.message);
      reject(err);
    });
  });
}

// ─── Pre-migration: add NOT NULL columns that db push can't handle ──────────────
function ensureSchema() {
  return new Promise(async (resolve, reject) => {
    const prismaClientPath = path.join(APP_DIR, 'lib', 'prisma-client');
    if (!fs.existsSync(prismaClientPath)) {
      log('Prisma client not found at: ' + prismaClientPath + ' — skipping ensureSchema');
      return resolve();
    }
    let prisma;
    try {
      const { PrismaClient } = require(prismaClientPath);
      prisma = new PrismaClient();

      const cols = await prisma.$queryRaw`PRAGMA table_info(RestaurantTable)`;
      const hasSlug = cols.some((c) => c.name === 'slug');

      if (!hasSlug) {
        log('Pre-migration: adding slug column to RestaurantTable...');
        await prisma.$executeRaw`ALTER TABLE "RestaurantTable" ADD COLUMN "slug" TEXT`;
        await prisma.$executeRaw`UPDATE "RestaurantTable" SET "slug" = LOWER(name) WHERE "slug" IS NULL`;
        await prisma.$executeRaw`CREATE UNIQUE INDEX IF NOT EXISTS "RestaurantTable_slug_key" ON "RestaurantTable"("slug")`;
        log('Pre-migration: slug column added and populated');
      }

      await prisma.$disconnect();
      resolve();
    } catch (err) {
      log('ensureSchema error: ' + err.message);
      try { await prisma?.$disconnect(); } catch (_) {}
      reject(err);
    }
  });
}

// ─── Verify critical schema columns after migration ────────────────────────────
function verifySchema() {
  return new Promise(async (resolve, reject) => {
    try {
      const prismaClientPath = path.join(APP_DIR, 'lib', 'prisma-client');
      if (!fs.existsSync(prismaClientPath)) {
        log('Prisma client not found at: ' + prismaClientPath + ' — skipping verification');
        return resolve();
      }
      const { PrismaClient } = require(prismaClientPath);
      const verifyPrisma = new PrismaClient();
      const cols = await verifyPrisma.$queryRaw`PRAGMA table_info(RestaurantTable)`;
      await verifyPrisma.$disconnect();
      const hasSlug = cols.some((c) => c.name === 'slug');
      if (!hasSlug) {
        return reject(new Error('Schema verification failed: RestaurantTable.slug column missing'));
      }
      log('Schema verification passed: slug column present');
      resolve();
    } catch (err) {
      log('Schema verification error: ' + err.message);
      reject(err);
    }
  });
}

// ─── Seed default data on first install ──────────────────────────────────────
function seedDatabase() {
  return new Promise((resolve, reject) => {
    const seedScript = isDev
      ? path.join(__dirname, 'seed.js')
      : path.join(process.resourcesPath, 'app', 'electron', 'seed.js');

    if (!fs.existsSync(seedScript)) {
      log('Seed script not found at: ' + seedScript + ' — skipping.');
      return resolve({ success: true, skipped: true });
    }

    log('Running seed script...');
    const proc = spawn(process.execPath, [seedScript], {
      cwd: APP_DIR,
      env: {
        ...process.env,
        ELECTRON_RUN_AS_NODE: '1',
        DATABASE_URL: process.env.DATABASE_URL,
      },
      stdio: 'pipe',
      shell: false,
    });

    let stdout = '';
    let stderr = '';

    proc.stdout.on('data', (d) => { const m = d.toString().trim(); if (m) { stdout += m + '\n'; log('[seed] ' + m); } });
    proc.stderr.on('data', (d) => { const m = d.toString().trim(); if (m) { stderr += m + '\n'; log('[seed:err] ' + m); } });
    proc.on('exit', (code) => {
      log('Seed exited with code ' + code);
      if (code === 0) {
        resolve({ success: true });
      } else {
        const errorMsg = stderr || 'Seed script failed with code ' + code;
        log('SEED FAILED: ' + errorMsg);
        reject(new Error(errorMsg));
      }
    });
    proc.on('error', (err) => {
      log('Seed error: ' + err.message);
      reject(err);
    });
  });
}

// ─── Start Next.js server ─────────────────────────────────────────────────────
function startServer() {
  return new Promise((resolve, reject) => {
    log('SERVER_SCRIPT: ' + SERVER_SCRIPT);
    log('APP_DIR: ' + APP_DIR);
    log('SERVER_SCRIPT exists: ' + fs.existsSync(SERVER_SCRIPT));

    if (!fs.existsSync(SERVER_SCRIPT)) {
      reject(new Error('server.js not found at: ' + SERVER_SCRIPT));
      return;
    }

    serverProcess = spawn(process.execPath, [SERVER_SCRIPT], {
      cwd: APP_DIR,
      env: {
        ...process.env,
        ELECTRON_RUN_AS_NODE: '1',
        NODE_ENV: isDev ? 'development' : 'production',
        PORT: String(PORT),
        DATABASE_URL: process.env.DATABASE_URL,
        APP_DIR: APP_DIR,
        NEXT_TURBOPACK: '0',
        // Ensure these are set even without .env file in packaged app
        JWT_SECRET: process.env.JWT_SECRET || getInstallJwtSecret(),
        NEXT_PUBLIC_WS_URL: `http://localhost:${PORT}`,
      },
      stdio: 'pipe',
    });

    let resolved = false;
    const doResolve = () => {
      if (!resolved) { resolved = true; resolve(); }
    };

    const interval = setInterval(() => {
      http.get(`http://localhost:${PORT}/`, (res) => {
        if (res.statusCode < 500) { clearInterval(interval); doResolve(); }
      }).on('error', () => {});
    }, 500);

    serverProcess.stdout.on('data', (data) => {
      const msg = data.toString();
      log('[server] ' + msg.trim());
      if (msg.includes('Local:') || msg.includes('localhost:')) {
        clearInterval(interval);
        doResolve();
      }
    });

    serverProcess.stderr.on('data', (data) => {
      log('[server:err] ' + data.toString().trim());
    });

    serverProcess.on('error', (err) => {
      log('Server spawn error: ' + err.message);
      if (!resolved) reject(err);
    });

    serverProcess.on('exit', (code) => {
      log('Server exited with code ' + code);
      if (code !== 0 && !resolved) {
        resolved = true;
        reject(new Error('Server process exited with code ' + code));
      }
    });

    setTimeout(() => { clearInterval(interval); doResolve(); }, 120000);
  });
}

// ─── BrowserWindow ────────────────────────────────────────────────────────────
function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1440,
    height: 900,
    minWidth: 800,
    minHeight: 600,
    title: 'CafeOS',
    backgroundColor: '#92400e',
    show: false,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
    },
    icon: ICON_PATH,
  });

  mainWindow.loadURL(`http://localhost:${PORT}`);
  mainWindow.once('ready-to-show', () => {
    mainWindow.show();
    if (isDev) mainWindow.webContents.openDevTools({ mode: 'detach' });
  });
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url);
    return { action: 'deny' };
  });
  mainWindow.on('closed', () => { mainWindow = null; });
}

// ─── Log Window ────────────────────────────────────────────────────────────────
function openLogWindow() {
  if (logWindow) {
    logWindow.focus();
    return;
  }

  logWindow = new BrowserWindow({
    width: 900,
    height: 600,
    minWidth: 600,
    minHeight: 400,
    title: 'CafeOS - Console Log',
    backgroundColor: '#1e1e1e',
    show: false,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
    },
    icon: ICON_PATH,
  });

  const logHtml = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <title>CafeOS Console Log</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body {
      font-family: 'Monaco', 'Menlo', 'Ubuntu Mono', 'Consolas', 'source-code-pro', monospace;
      background: #1e1e1e;
      color: #d4d4d4;
      height: 100vh;
      display: flex;
      flex-direction: column;
    }
    .header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: 12px 16px;
      background: #252526;
      border-bottom: 1px solid #3c3c3c;
      flex-shrink: 0;
    }
    .header h1 {
      font-size: 14px;
      font-weight: 600;
      color: #e0e0e0;
    }
    .controls {
      display: flex;
      gap: 8px;
      align-items: center;
    }
    .btn {
      padding: 6px 12px;
      font-size: 12px;
      border: none;
      border-radius: 4px;
      cursor: pointer;
      font-family: inherit;
      transition: background 0.15s;
    }
    .btn-primary { background: #0e639c; color: white; }
    .btn-primary:hover { background: #1177bb; }
    .btn-secondary { background: #3c3c3c; color: #d4d4d4; }
    .btn-secondary:hover { background: #4a4a4a; }
    .btn-danger { background: #a1260d; color: white; }
    .btn-danger:hover { background: #c42e0f; }
    .status {
      font-size: 11px;
      color: #888;
      padding: 0 8px;
    }
    .status.connected { color: #4ec9b0; }
    .status.error { color: #f44747; }
    #logContent {
      flex: 1;
      overflow-y: auto;
      padding: 16px;
      line-height: 1.5;
      font-size: 12px;
      white-space: pre-wrap;
      word-break: break-word;
    }
    .log-line { margin: 2px 0; }
    .log-timestamp { color: #888; }
    .log-level-error { color: #f44747; font-weight: bold; }
    .log-level-warn { color: #dcdcaa; font-weight: bold; }
    .log-level-info { color: #4ec9b0; }
    .log-level-prisma { color: #9cdcfe; }
    .log-level-seed { color: #ce9178; }
    .log-level-server { color: #d4d4d4; }
    .log-message { color: #d4d4d4; }
    .empty-state {
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      height: 100%;
      color: #666;
      text-align: center;
      padding: 20px;
    }
    .empty-state svg { width: 64px; height: 64px; margin-bottom: 16px; opacity: 0.5; }
  </style>
</head>
<body>
  <div class="header">
    <h1>📋 CafeOS Console Log</h1>
    <div class="controls">
      <span id="status" class="status">Loading...</span>
      <button id="autoRefreshBtn" class="btn btn-secondary" onclick="toggleAutoRefresh()">Auto-refresh: ON</button>
      <button id="clearBtn" class="btn btn-danger" onclick="clearLog()">Clear Log</button>
      <button id="refreshBtn" class="btn btn-primary" onclick="loadLog()">Refresh</button>
    </div>
  </div>
  <div id="logContent"></div>

  <script>
    let autoRefresh = true;
    let refreshInterval = null;
    const logContent = document.getElementById('logContent');
    const statusEl = document.getElementById('status');
    const autoRefreshBtn = document.getElementById('autoRefreshBtn');

    function highlightLog(text) {
      return text
        .replace(/\\[(\\d{4}-\\d{2}-\\d{2}T[^\\]]+)\\]/g, '<span class="log-timestamp">[$1]</span>')
        .replace(/\\[ERROR\\]/g, '<span class="log-level-error">[ERROR]</span>')
        .replace(/\\[WARN\\]/g, '<span class="log-level-warn">[WARN]</span>')
        .replace(/\\[INFO\\]/g, '<span class="log-level-info">[INFO]</span>')
        .replace(/\\[prisma\\]/g, '<span class="log-level-prisma">[prisma]</span>')
        .replace(/\\[prisma:err\\]/g, '<span class="log-level-error">[prisma:err]</span>')
        .replace(/\\[seed\\]/g, '<span class="log-level-seed">[seed]</span>')
        .replace(/\\[seed:err\\]/g, '<span class="log-level-error">[seed:err]</span>')
        .replace(/\\[server\\]/g, '<span class="log-level-server">[server]</span>')
        .replace(/\\[server:err\\]/g, '<span class="log-level-error">[server:err]</span>');
    }

    async function loadLog() {
      try {
        const response = await fetch('http://localhost:${PORT}/api/debug/log');
        if (!response.ok) throw new Error('Failed to load log');
        const data = await response.json();
        statusEl.textContent = data.lines + ' lines • ' + new Date().toLocaleTimeString();
        statusEl.className = 'status connected';
        if (data.content.trim()) {
          logContent.innerHTML = data.content.split('\\n').map(line => {
            if (!line.trim()) return '<div class="log-line"></div>';
            return '<div class="log-line">' + highlightLog(line) + '</div>';
          }).join('');
          // Auto-scroll to bottom
          logContent.scrollTop = logContent.scrollHeight;
        } else {
          logContent.innerHTML = '<div class="empty-state"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M9 12h6M12 9v6"/></svg><p>Log file is empty</p></div>';
        }
      } catch (err) {
        statusEl.textContent = 'Error: ' + err.message;
        statusEl.className = 'status error';
        logContent.innerHTML = '<div class="empty-state"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><circle cx="12" cy="12" r="10"/><path d="M12 8v4M12 16h.01"/></svg><p>Failed to load log: ' + err.message + '</p></div>';
      }
    }

    function toggleAutoRefresh() {
      autoRefresh = !autoRefresh;
      autoRefreshBtn.textContent = 'Auto-refresh: ' + (autoRefresh ? 'ON' : 'OFF');
      autoRefreshBtn.className = 'btn ' + (autoRefresh ? 'btn-secondary' : 'btn-primary');
      if (autoRefresh) {
        startAutoRefresh();
      } else {
        stopAutoRefresh();
      }
    }

    function startAutoRefresh() {
      stopAutoRefresh();
      refreshInterval = setInterval(loadLog, 2000);
    }

    function stopAutoRefresh() {
      if (refreshInterval) {
        clearInterval(refreshInterval);
        refreshInterval = null;
      }
    }

    async function clearLog() {
      if (!confirm('Clear the log file? This cannot be undone.')) return;
      try {
        const response = await fetch('http://localhost:${PORT}/api/debug/log', { method: 'DELETE' });
        if (response.ok) {
          loadLog();
        } else {
          alert('Failed to clear log');
        }
      } catch (err) {
        alert('Error: ' + err.message);
      }
    }

    // Initial load
    loadLog();
    startAutoRefresh();

    // Cleanup on unload
    window.addEventListener('beforeunload', stopAutoRefresh);
  </script>
</body>
</html>
  `;

  logWindow.loadURL('data:text/html;charset=utf-8,' + encodeURIComponent(logHtml));

  logWindow.once('ready-to-show', () => {
    logWindow.show();
  });

  logWindow.on('closed', () => {
    logWindow = null;
  });
}

// ─── Tray ─────────────────────────────────────────────────────────────────────
function createTray() {
  const traySource = fs.existsSync(ICON_32_PATH) ? ICON_32_PATH : ICON_PATH;
  const icon = fs.existsSync(traySource)
    ? nativeImage.createFromPath(traySource).resize({ width: 16, height: 16 })
    : nativeImage.createEmpty();

  tray = new Tray(icon);
  tray.setToolTip('CafeOS - POS System');

  const menu = Menu.buildFromTemplate([
    { label: 'Open CafeOS',   click: () => { mainWindow?.show(); mainWindow?.focus(); } },
    { type: 'separator' },
    { label: 'Admin POS',     click: () => mainWindow?.loadURL(`http://localhost:${PORT}/admin`) },
    { label: 'Kitchen',       click: () => mainWindow?.loadURL(`http://localhost:${PORT}/kitchen`) },
    { label: 'Customer Menu', click: () => mainWindow?.loadURL(`http://localhost:${PORT}/menu`) },
    { label: 'Analytics',     click: () => mainWindow?.loadURL(`http://localhost:${PORT}/admin/analytics`) },
    { type: 'separator' },
    { label: 'Quit CafeOS',   role: 'quit' },
  ]);

  tray.setContextMenu(menu);
  tray.on('double-click', () => { mainWindow?.show(); mainWindow?.focus(); });
}

// ─── App Menu ─────────────────────────────────────────────────────────────────
function buildAppMenu() {
  const template = [
    {
      label: 'CafeOS',
      submenu: [
        { label: 'Home',          click: () => mainWindow?.loadURL(`http://localhost:${PORT}`) },
        { label: 'Customer Menu', click: () => mainWindow?.loadURL(`http://localhost:${PORT}/menu`) },
        { label: 'Admin POS',     click: () => mainWindow?.loadURL(`http://localhost:${PORT}/admin`) },
        { label: 'Kitchen',       click: () => mainWindow?.loadURL(`http://localhost:${PORT}/kitchen`) },
        { label: 'Analytics',     click: () => mainWindow?.loadURL(`http://localhost:${PORT}/admin/analytics`) },
        { label: 'Inventory',     click: () => mainWindow?.loadURL(`http://localhost:${PORT}/admin/inventory`) },
        { label: 'Tables',        click: () => mainWindow?.loadURL(`http://localhost:${PORT}/admin/tables`) },
        { type: 'separator' },
        { role: 'quit' },
      ],
    },
    {
      label: 'View',
      submenu: [
        { role: 'reload' },
        { role: 'forceReload' },
        { type: 'separator' },
        { role: 'resetZoom' },
        { role: 'zoomIn' },
        { role: 'zoomOut' },
        { type: 'separator' },
        { role: 'togglefullscreen' },
      ],
    },
    {
      label: 'Window',
      submenu: [{ role: 'minimize' }, { role: 'zoom' }, { role: 'close' }],
    },
    {
      label: 'Console Log',
      click: () => openLogWindow(),
    },
  ];
  Menu.setApplicationMenu(Menu.buildFromTemplate(template));
}

// ─── Lifecycle ────────────────────────────────────────────────────────────────
app.whenReady().then(async () => {
  log('CafeOS starting... isDev=' + isDev);
  log('execPath: ' + process.execPath);
  log('resourcesPath: ' + (process.resourcesPath || 'N/A'));

  setupDatabase();
  try {
    await migrateDatabase();
    log('Database migration completed successfully');
  } catch (err) {
    log('FATAL: Database migration failed: ' + err.message);
    dialog.showErrorBox(
      'CafeOS - Database Migration Error',
      `Failed to migrate database:\n${err.message}\n\nSee log file:\n${LOG_FILE}`
    );
    app.quit();
    return;
  }

  try {
    await seedDatabase();
    log('Database seeding completed successfully');
  } catch (err) {
    log('FATAL: Database seeding failed: ' + err.message);
    dialog.showErrorBox(
      'CafeOS - Database Seeding Error',
      `Failed to seed database:\n${err.message}\n\nSee log file:\n${LOG_FILE}`
    );
    app.quit();
    return;
  }

  buildAppMenu();

  const splash = new BrowserWindow({
    width: 420,
    height: 300,
    frame: false,
    resizable: false,
    alwaysOnTop: true,
    backgroundColor: '#92400e',
    webPreferences: { nodeIntegration: false },
  });

  splash.loadURL(`data:text/html,<!DOCTYPE html>
    <html><body style="background:#92400e;display:flex;flex-direction:column;
      align-items:center;justify-content:center;height:100vh;margin:0;
      font-family:sans-serif;color:white;user-select:none">
      <div style="font-size:72px;margin-bottom:8px">&#x2615;</div>
      <h1 style="margin:0 0 8px;font-size:26px;font-weight:700">CafeOS</h1>
      <p style="opacity:0.8;margin:0;font-size:14px">Starting server, please wait...</p>
    </body></html>`);

  try {
    await startServer();
  } catch (err) {
    log('FATAL: ' + err.message);
    const logPath = LOG_FILE;
    dialog.showErrorBox(
      'CafeOS - Startup Error',
      `Failed to start server:\n${err.message}\n\nSee log file:\n${logPath}`
    );
    app.quit();
    return;
  }

  splash.close();
  createWindow();
  createTray();
});

app.on('window-all-closed', () => {});

app.on('activate', () => {
  if (mainWindow === null) createWindow();
});

app.on('before-quit', () => {
  if (serverProcess) { serverProcess.kill('SIGTERM'); serverProcess = null; }
  if (tray) { tray.destroy(); tray = null; }
});
