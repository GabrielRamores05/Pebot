# Plan: Compile CaféOS into a Standalone Executable (Windows)

## 1. System Architecture Mapping

### 1.1 Component Stack
| Layer | Technology | Version | File(s) |
|-------|-----------|---------|---------|
| Desktop Shell | Electron | 40.7.0 | `electron/main.js` |
| Web Server | Next.js (custom server) | 14.2.0 | `server.js` |
| UI Framework | React | 18.2.0 | `app/**/*.tsx`, `.next/` |
| Database Client | Prisma | 5.22.0 | `lib/prisma.ts`, `lib/prisma-client/` |
| Database Engine | SQLite | file-based | `prisma/dev.db` (bundled), `%APPDATA%\cafeos\cafeos.db` (runtime) |
| Real-time | Socket.IO | 4.8.3 | `server.js` (server), client via `next/socket.io` |
| LAN Discovery | mdns-js | 1.0.3 | `server.js` (mDNS advertise) |
| Auth | JWT (jose) | 6.1.3 | `lib/auth.ts` |
| Styling | TailwindCSS | 4 | `app/**/*.tsx` |
| Charts | Recharts | 3.7.0 | `app/admin/analytics/page.tsx` |
| State | Zustand | 5.0.12 | various |

### 1.2 Runtime Architecture
```
┌──────────────────────────────────────────────────────────┐
│                    Electron Main (main.js)                │
│  ┌───────────┐  ┌───────────┐  ┌──────────┐              │
│  │ setupDB   │  │ migrateDB │  │ seedDB   │  (spawn)      │
│  └───────────┘  └───────────┘  └──────────┘              │
│                       │ spawn(process.execPath)            │
│                       ▼                                    │
│  ┌─────────────────────────────────────┐                   │
│  │     Next.js Custom Server (3000)    │  ←── BrowserWindow│
│  │  ┌──────────────┐  ┌───────────┐   │    (loads URL)   │
│  │  │ Next.js App  │  │ Socket.IO │   │                  │
│  │  │ (.next)      │  │  (WS)     │   │                  │
│  │  │ API Routes   │  │ mDNS      │   │                  │
│  │  │ Prisma Client│  │ (Bonjour) │   │                  │
│  │  └──────────────┘  └───────────┘   │                  │
│  └─────────────────────────────────────┘                   │
└──────────────────────────────────────────────────────────┘
```

### 1.3 Build Pipeline
```
npm run build  ─→  next build  ─→  .next/  (compiled React app + API routes)
npx prisma generate  ─→  lib/prisma-client/  (client + native query engine)
npm run electron:build:win  ─→  electron-builder  ─→  dist-electron/
                                 (NSIS installer + portable dir)
```

### 1.4 Production Startup Sequence
1. `app.whenReady()` fires
2. `setupDatabase()` — copies `prisma/dev.db` → `%APPDATA%\cafeos\cafeos.db` (first run only)
3. `migrateDatabase()` — spawns Prisma CLI to run `db push --schema=...` against the DB
4. `seedDatabase()` — spawns `electron/seed.js` to create default users/subscriptions
5. `startServer()` — spawns `server.js` via `process.execPath` (Electron's Node.js)
6. Wait for HTTP server to respond (up to 90s)
7. Close splash, show main window at `http://localhost:3000`

### 1.5 Key Paths (Production)
| Resource | Dev Path | Production Path |
|----------|----------|-----------------|
| App bundle | `./` | `%RESOURCES%\app\` |
| Next.js build | `./.next/` | `%RESOURCES%\app\.next\` |
| Prisma client | `./lib/prisma-client/` | `%RESOURCES%\app\lib\prisma-client\` |
| Prisma CLI | `./node_modules/prisma/` | `%RESOURCES%\app\node_modules/prisma/` |
| SQLite DB | `./prisma/dev.db` | `%APPDATA%\cafeos\cafeos.db` |
| Server script | `./server.js` | `%RESOURCES%\app\server.js` |
| Seed script | `./electron/seed.js` | `%RESOURCES%\app\electron\seed.js` |

## 2. Dependency Analysis

### 2.1 Build Dependencies (devDependencies)
| Package | Purpose | Bundling Notes |
|---------|---------|----------------|
| `electron` 40.7.0 | Desktop shell | Ships with Node.js 20.x |
| `electron-builder` 26.8.1 | Packaging tool | Uses installed Electron |
| `next` 14.2.0 | Web framework | Compiled to `.next/` |
| `typescript` 5 | TS compiler | Not shipped (compiled) |
| `prisma` 5.22.0 | CLI for migrations | Ships to `node_modules/` (`db push`) |
| `ts-node` 10.9.2 | Seed runner | Ships for `db:seed` |
| `eslint` 9 | Linting | Not needed in production |
| `tailwindcss` 3.4 | CSS build | Compile-time only |

### 2.2 Runtime Dependencies (dependencies)
| Package | Type | Bundling Notes |
|---------|------|---------------|
| `@prisma/client` 5.22 | Pure JS wrapper | Ships to `lib/prisma-client/` |
| `next` 14.2.0 | Server framework | Ships in `node_modules/` |
| `react`, `react-dom` 18.2 | UI framework | Ships in `node_modules/` |
| `socket.io`, `socket.io-client` 4.8.3 | WebSocket | Ships in `node_modules/` |
| `mdns-js` 1.0.3 | mDNS/Bonjour | **Native bindings** — verify works with Electron's Node.js |
| `bcryptjs` 3.0.3 | Password hashing | Pure JS (no native) |
| `jsonwebtoken`, `jose` 6.1.3 | JWT auth | Ships in `node_modules/` |
| `qrcode`, `@zxing/library` | QR/barcode | Ships in `node_modules/` |
| `jsbarcode`, `html2canvas` | Barcode, screenshot | Ships in `node_modules/` |
| `jspdf` 4.2.1 | PDF generation | Ships in `node_modules/` |
| `jszip` 3.10.1 | ZIP archives | Ships in `node_modules/` |
| `recharts` 3.7.0 | Charts | Ships in `node_modules/` |
| `zustand` 5.0.12 | State mgmt | Ships in `node_modules/` |

### 2.3 Native Binaries (CRITICAL)
| Binary | Location | Required? |
|--------|----------|-----------|
| `query_engine-windows.dll.node` | `lib/prisma-client/` AND `node_modules/@prisma/engines/` | **Yes** — Prisma Client database engine |
| `schema-engine-windows.exe` | `node_modules/@prisma/engines/` | Only needed for CLI `db push`/`migrate` commands |
| `mdns-js` bindings | `node_modules/mdns-js/` | **Possibly** — uses native Node addon |

### 2.4 Environment Variables (Production)
| Var | Source | Notes |
|-----|--------|-------|
| `DATABASE_URL` | Set by `setupDatabase()` → `file:%APPDATA%\cafeos\cafeos.db` | Passed to server + seed processes |
| `JWT_SECRET` | `main.js` fallback if `.env` not loaded | Hardcoded fallback in code |
| `NODE_ENV` | Set to `production` in `startServer()` env | |
| `APP_DIR` | Set to `APP_DIR` in `startServer()` env | Server uses for `process.env.APP_DIR` |
| `PORT` | Set to `3000` in `startServer()` env | |

**ISSUE: `.env` files are NOT included in electron-builder `files` array.** All env vars must be set via the spawn env in `main.js` or use code fallbacks.

## 3. Build Configuration Analysis

### 3.1 Current `electron-builder` Config (`package.json` `build` section)
- `asar: false` — files extracted to `resources/app/` (correct for native modules)
- `files` — includes `electron/**/*`, `server.js`, `.next/**/*`, `public/**/*`, `lib/**/*`, `node_modules/**/*`, `prisma/schema.prisma`, `prisma/dev.db`
- `extraResources` — `prisma/dev.db`, icon files
- Windows: NSIS (installer) + dir (portable), x64 only
- `signAndEditExecutable: false` (no code signing)

### 3.2 Build Scripts
```
"build": "cross-env ... next build"
"electron:build:win": "cross-env CSC_IDENTITY_AUTO_DISCOVERY=false npm run build && electron-builder --win"
```
Steps: Next.js build → prisma generate → electron-builder package

### 3.3 Missing from Build Files
| Item | Included? | Impact |
|------|-----------|--------|
| `.env` / `.env.local` | No | All env vars must be passed via spawn env |
| `tsconfig.json` | No | Not needed at runtime |
| `prisma/migrations/` | Yes (added) | For future migration deploy |
| ESLint/Tailwind configs | No | Compile-time only |

## 4. Potential Failure Points & Mitigations

### 4.1 Critical Failure Points

| # | Failure Point | Risk | Current Mitigation | Recommended Enhancement |
|---|--------------|------|---------------------|------------------------|
| 1 | **Prisma query engine not bundled** | CRITICAL | `lib/**/*` is in `files` array | Verify `query_engine-windows.dll.node` is physically present in build output after packaging |
| 2 | **`.env` not included in build** | HIGH | Env vars passed via `startServer()` spawn | Explicitly pass all required env vars in `server.js` spawn config |
| 3 | **`backup/route.ts` uses `process.cwd()`** | HIGH | None | Fix to use `process.env.DATABASE_URL` path or `app.getPath('userData')` |
| 4 | **mdns-js native bindings** | MEDIUM | May work with Electron's Node.js | Test on clean Windows; use `--build-from-source` if needed |
| 5 | **90s startup timeout** | MEDIUM | `setTimeout` fallback in `startServer()` | Increase to 120s; add progress logging |
| 6 | **First-run migration + seed** | MEDIUM | `db push` + `seed.js` in startup | Already handled with error dialogs |
| 7 | **No code signing** | LOW | `signAndEditExecutable: false` | Document; can be added later with cert |
| 8 | **Hardcoded IPs in next.config.js** | LOW | `serverActions.allowedOrigins` list | Replace with dynamic origin or wildcard |

### 4.2 Error Handling
- `migrateDatabase()` — rejects on failure, shows error dialog, quits
- `seedDatabase()` — rejects on failure, shows error dialog, quits
- `startServer()` — rejects on failure, shows error dialog, quits
- `app.on('window-all-closed')` — does nothing (prevents exit)
- `app.on('before-quit')` — kills server process cleanly

### 4.3 Resource Management
- Server process killed on quit (`serverProcess.kill('SIGTERM')`)
- Prisma Client disconnected after schema verification
- Log file cleared on each startup (`fs.writeFileSync(LOG_FILE, '')`)
- Database file copied once (first run only), existing DB reused on upgrades

## 5. Implementation Roadmap

### Phase 1: Pre-build Verification
**Goal**: Ensure dev environment is ready and all assets are fresh

1. **Verify Prisma client + engines**
   ```bash
   cd my-app
   npx prisma generate
   ls lib/prisma-client/query_engine-windows.dll.node  # must exist
   ls lib/prisma-client/schema.prisma  # Prisma 5.x generates this
   ```

2. **Verify database is in sync**
   ```bash
   npx prisma db push  # should report "in sync"
   npm run db:seed  # should report "Seeding completed"
   ```

3. **Verify Next.js build**
   ```bash
   npm run build  # must complete without errors
   ls .next/standalone/  # verify standalone build output exists
   ```

### Phase 2: Fix Critical Bugs
**Goal**: Address the issues that would break in production

4. **Fix `backup/route.ts` path resolution**
   - File: `app/api/backup/route.ts`
   - Replace `process.cwd()` + `'prisma/dev.db'` with path resolved from `process.env.DATABASE_URL`
   - Parse `file:./path` format to get absolute DB path

5. **Ensure env vars are passed to server**
   - File: `electron/main.js` (startServer function)
   - Verify `DATABASE_URL`, `JWT_SECRET`, `NODE_ENV`, `PORT`, `APP_DIR` are all set in spawn env
   - Add any missing vars from `.env` (check `NEXTAUTH_URL`, `NEXT_PUBLIC_WS_URL`)

6. **Fix `next.config.js` hardcoded IPs**
   - File: `next.config.js`
   - Replace hardcoded IPs in `serverActions.allowedOrigins` with dynamic approach or `*`

### Phase 3: Build Configuration Refinement
**Goal**: Ensure all assets are properly bundled

7. **Verify `package.json` build `files` list**
   - Ensure `.env` is NOT included (security — contains dev DB path)
   - Ensure `lib/prisma-client/*.node` is included (verify via glob)
   - Verify `node_modules/@prisma/engines/` binaries are included

8. **Test `electron-builder` config**
   ```bash
   npm run electron:build:win
   ```
   - Verify build succeeds
   - Check output in `../dist-electron/`

### Phase 4: Packaging & Verification
**Goal**: Verify the packaged app works on a clean machine

9. **Verify build output**
   - Check `resources/app/.next/` exists
   - Check `resources/app/lib/prisma-client/` has `.node` binaries
   - Check `resources/app/node_modules/@prisma/engines/` has schema engine
   - Check `resources/prisma/dev.db` exists (extraResource)

10. **Test on clean Windows machine (or VM)**
    - Install via NSIS installer
    - Launch app
    - Verify:
      - Splash screen appears
      - Database migration runs without error
      - Seeding completes
      - Next.js server starts
      - Main window loads at `http://localhost:3000`
      - Login with `admin@cafeos.local` / `admin123`
      - Terminal page loads (was broken due to `slug` column)
      - Place an order
      - Backup works

### Phase 5: Optional Enhancements
**Goal**: Improve robustness (not required for basic compilation)

11. **Increase startup timeout** (if needed)
    - `electron/main.js:279` — increase 90000ms to 120000ms

12. **Add build-time Prisma engine verification script**
    - Script to check all native binaries are present before packaging

## 6. Validation Checklist

| Test | Expected Result |
|------|----------------|
| `npx prisma generate` | `lib/prisma-client/` contains `query_engine-windows.dll.node` |
| `npx prisma db push` | "The database is already in sync with the Prisma schema" |
| `npm run db:seed` | "Seeding completed!" + admin/staff accounts created |
| `npm run build` | `.next/` generated, no errors |
| `npm run electron:build:win` | `dist-electron/` created with NSIS installer + portable dir |
| Installer runs on clean Windows | App installs to `%LOCALAPPDATA%\Programs\CafeOS\` or chosen dir |
| First launch on clean machine | DB copied, migration + seed succeed, server starts, window opens |
| Login as admin | Dashboard loads without errors |
| Open Terminal (admin) | Loads without "slug column missing" or "Something went wrong" |
| Create order (customer menu) | Order created, visible in Terminal |
| Backup download (admin) | ZIP downloads with `dev.db` inside |
| mDNS service visible | "SMART CafeOS" appears in Bonjour browser on LAN |

## 7. Files to Modify

| File | Change |
|------|--------|
| `app/api/backup/route.ts` | Fix `process.cwd()` path to use `DATABASE_URL` |
| `electron/main.js` | Increase startup timeout (90000 → 120000); ensure all env vars passed |
| `next.config.js` | Replace hardcoded IPs in `serverActions.allowedOrigins` |
| `package.json` | Already includes `prisma/migrations/**/*`; verify `lib/` and `node_modules/` coverage |

## 8. Out of Scope

- Code signing (certificates required, can be added later)
- Single-file EXE distribution (user chose NSIS installer)
- Linux/macOS builds (Windows-only per current config)
- CI/CD pipeline setup
- Auto-update mechanism (electron-updater)

## 9. Implementation Results (COMPLETE)

### Changes Made to 4 Files:

| File | Change | Status |
|------|--------|--------|
| app/api/backup/route.ts | Replaced process.cwd() path with getDatabasePath() using DATABASE_URL | Complete |
| electron/main.js | Added verifySchema(); calls after db push AND when Prisma CLI missing; timeout 90s to 120s | Complete |
| next.config.js | Replaced hardcoded IPs with dynamic getAllowedOrigins() | Complete |
| package.json | Added node_modules/prisma/** and node_modules/@prisma/** to files; moved prisma to dependencies | Complete |

### Critical Finding:
Prisma CLI was a devDependency excluded from the build. Moved to dependencies so electron-builder includes the full @prisma/engines tree.

### Build Verification:
- prisma generate, db push, db:seed: all pass
- Next.js build: 69 pages generated
- tsc --noEmit: passes
- NSIS installer: CafeOS Setup 1.0.3.exe (415MB) built successfully

### Packaged App Verification:
All critical files present in win-unpacked/resources/app/
