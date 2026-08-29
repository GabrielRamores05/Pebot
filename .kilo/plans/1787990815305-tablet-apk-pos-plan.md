# Plan: Standalone APK POS for Tablet-Only, No-WiFi Cafés

## Problem Diagnosis

The client has **no WiFi and no PC/laptop** — only tablets using mobile data. The PostgreSQL/Nen connection string does **not** solve this: you still need to host the Next.js + Socket.IO server process somewhere. The tablet *is* the client browser, not the server. Connecting Prisma to a remote database just moves the data out of SQLite without giving the tablets a server to talk to.

The user's actual proposal is sound and different from what was pursued: **package the entire system (server + client UI + SQLite) as a standalone Android APK** that runs on the tablet, stores data locally, and can export/import a SQLite file for later migration to a desktop unit. This is feasible.

## Current Architecture (reference)

- `server.js` — Custom Next.js HTTP server + Socket.IO, binds `0.0.0.0:3000`, mDNS via `smartcafeos.local`
- `prisma/schema.prisma` — `provider = "sqlite"`, `DATABASE_URL` from env
- `lib/db-path.ts` — Resolves SQLite file from `DATABASE_URL` (`file:` URL)
- `lib/prisma.ts` — Singleton PrismaClient, reads `datasourceUrl: process.env.DATABASE_URL`
- `app/api/backup/route.ts` — Reads SQLite file, zips it, downloads to client
- `app/api/restore/route.ts` — Validates SQLite magic bytes, disconnects Prisma, swaps file
- `next.config.js:24` — `output: 'standalone'` when `CI=true` (for Docker/container builds)
- `Dockerfile` — Already packages the server as a standalone container (no Electron)
- `app/api/health/route.ts` — Health endpoint, dependency-free

The server.js + Next.js build already runs as a standalone process (proven by the Dockerfile). Embedding it in an APK is a packaging problem, not a code rewrite.

## Proposed Approach: Capacitor + Embedded Node.js Server

Use **Capacitor** as the Android shell, with **nodejs-mobile** (or equivalent) to embed a Node.js runtime that runs `server.js`. The tablet's WebView connects to `http://localhost:3000`.

```
+------------------+        HTTP/WebSocket        +---------------------+
|   Tablet WebView | <-- localhost:3000 ---------> | Embedded Node.js    |
|   (Next.js UI)   |                              | server.js + .next   |
+------------------+                              | Prisma + SQLite     |
                                                   | (app data dir)      |
                                                   +---------------------+
```

### Why this works with the existing codebase
- **Minimal code changes**: server.js, Next.js routes, Prisma, Socket.IO all run unchanged inside the embedded Node.js runtime. The WebView loads the same UI.
- **Auth works**: cookie-based sessions function normally since the server is on localhost.
- **Socket.IO works**: WebSocket connections to localhost work in a WebView.
- **SQLite path**: map `DATABASE_URL="file:<app_data_dir>/dev.db"` so the SQLite file lives in the APK's private storage.
- **Export/Import**: the existing `/api/backup` and `/api/restore` endpoints already zip/unzip the SQLite file. A small export button in the admin UI triggers a download. Import reverses it.
- **Migration**: the exported SQLite file is schema-identical to the desktop `dev.db` (same `schema.prisma`). Copying it to a new desktop unit and running `prisma db push` should work.

### Technical challenges & mitigations

| Challenge | Mitigation |
|---|---|
| APK size (Node.js + Next.js + node_modules) | nodejs-mobile bundles V8 (~30MB). Next.js standalone build is lean. Expect ~80-120MB APK. |
| Android storage permissions (Android 10+ scoped storage) | Store SQLite in `context.getFilesDir()` (private, no permission needed). Export via `Intent.ACTION_SEND` or DownloadManager. |
| nodejs-mobile native module compatibility | Prisma's `prisma-client-js` engine runs as a binary download, not a compiled native module — should work. Verify `@prisma/engines` platform availability. |
| Background execution (Android killing the process) | Run server as a **foreground service** with a persistent notification. |
| Mobile data for customer QR ordering | Without WiFi, the tablet's mobile IP is behind carrier NAT — external devices can't connect. See Question 1. |

## Key Decisions (open)

### Decision 1 — Single tablet vs. multi-tablet coordination (BLOCKER)
If the café operates with **one tablet** (staff handles all orders), the embedded-server approach works perfectly — standalone, offline, no coordination needed.

If they need **multiple tablets** (e.g., staff POS + kitchen display) over mobile data (no WiFi), this is an unsolved problem: carrier NAT prevents peer-to-peer connections. Options would be: (a) a cloud relay server, or (b) one tablet hosts the server and others connect via a reverse tunnel — both complex and at odds with local-first.

### Decision 2 — Customer self-ordering via QR (needs resolution)
Without WiFi, customers can't scan a QR code that points to the tablet's local IP. If customer self-ordering is required, it needs a cloud-facing component (publicly reachable server). If staff-assisted ordering is sufficient, the standalone APK covers everything.

### Decision 3 — Constitution amendment for APK mode (if Proceeding)
The constitution locks "One Windows PC per location" as the deployment model. An APK-only deployment is a new mode. The constitution says: "Do not build sync; do not foreclose it." The APK's local SQLite IS the single source of truth per location — same principle, different host. This doesn't change the data model or money rules. It should be recorded as a new deployment mode, not a deviation.

## Implementation Path (high-level)

1. **Spike**: Verify `nodejs-mobile` (or Capacitor's built-in server capabilities) can run `server.js` + Next.js build inside an Android shell. Test that Prisma + SQLite works with `DATABASE_URL` pointing to app-private storage.
2. **Create Android project**: Initialize a Capacitor Android project, integrate node runtime.
3. **Bundle the build**: Copy `.next/` standalone output, `node_modules`, `server.js`, `prisma/schema.prisma` as APK assets.
4. **Map SQLite path**: Set `DATABASE_URL="file:<files_dir>/dev.db"` at APK startup.
5. **Seed on first launch**: Run the existing seed script (or bundle a seed DB as an asset).
6. **Export flow**: Add an "Export Data" button in the admin panel that triggers the existing `/api/backup` endpoint; on Android, use DownloadManager or share intent.
7. **Import flow**: Add "Import Data" that calls `/api/restore`; file picker returns a `.zip` → existing restore logic handles the rest.
8. **Foreground service**: Keep the server alive when the app is backgrounded.
9. **Test migration**: Export from APK → import on desktop to verify SQLite schema compatibility.

## Out of scope (for now)
- React Native rewrite (Option 2) — too much code churn; embedded server preserves the existing codebase.
- Cloud synchronization — no cloud backup in the MVP; pure local-first as the constitution intends.
- iOS version — user specified APK (Android-only).
- Multi-tablet coordination without WiFi — blocked on Decision 1.
