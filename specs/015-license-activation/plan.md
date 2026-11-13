# Implementation Plan: Pebot License Activation

**Branch**: `015-license-activation` | **Date**: 2026-11-14 | **Spec**: [spec.md](spec.md)

**Input**: Feature specification from `/specs/015-license-activation/spec.md`

## Summary

Pebot fails closed until the main PC holds an Ed25519-signed license bound to its Machine Code (MachineGuid + SMBIOS UUID).

- Enforcement is one pure gate called by `server.js` for HTTP and the Socket.IO handshake.
- Activation is handled by thin `/api/license/*` routes over a `modules/license` service.
- A seller-only CLI in `tools/pebot-keygen/` issues keys and keeps the registry, sharing the format code in `my-app/lib/license/core.js`.
- The license agreement is one text file, shown by the NSIS installer and in-app.
- Subscription-tier gating is replaced by the existing Staff Management permissions.

## Technical Context

- **Language/Version**: TypeScript (strict) for app code. Plain Node CommonJS JS for code that `server.js` and the CLI must `require` (`lib/license/*.js`); it is type-checked through `allowJs` with JSDoc.
- **Primary Dependencies**: Node built-in `crypto` (Ed25519, SHA-256, HMAC), `child_process` (machine identity), Next.js route handlers, Zod, Zustand. **No new packages.**
- **Storage**: `pebot-license.json` next to the SQLite file. The seller's `registry.json` and `private-key.pem` are outside the repo.
- **Testing**: Vitest unit tests (`tests/unit/license-*.test.ts`), using temp dirs and freshly generated key pairs.
- **Target Platform**: Windows 10/11 main PC (Electron 40 shell). Dev on any OS.
- **Project Type**: Local-first web app plus a desktop shell, and a seller CLI.
- **Performance Goals**: The gate adds no I/O per request (in-memory state). Machine identity is read once at start (≤15 s timeout, typically under 1 s).
- **Constraints**: Fully offline. No date dependence. No dev bypass. Private key never in the repo or installer.
- **Scale/Scope**: One license per location. Hundreds of seller registry entries.

## Constitution Check

| Principle | Status |
|---|---|
| I. Local-first, offline | ✅ No network at any step. |
| II. Central enforcement, realtime same as HTTP | ✅ One gate in `server.js` covers HTTP and the Socket.IO handshake. |
| III. Money and records append-only | ✅ Not touched. Activation and deactivation are written to `AuditEvent` with an insert only. |
| IV. Thin routes, domain modules | ✅ Routes validate with Zod and call one `modules/license/service.ts` function. No Prisma in the module except through `logAction`. |
| V. Electron is a shell | ✅ No licensing code in Electron. Running `server.js` alone is still gated. |
| VI. Tests | ✅ Each service, core and gate function and the keygen registry logic have unit tests. Existing subscription tests are updated deliberately, not weakened (see Complexity). |
| VII. No silent data loss | ✅ Activation, deactivation and revocation never touch the database. Deactivation requires admin, confirmation and local access. |
| Locked decisions | ✅ No new dependencies. |
| Scope ("independent cafés") | ⚠️ Selling to restaurants and adding licensing **requires amendment 1.1.0** (task T001). Done before implementation, as governance requires. |

Re-check after design: no new violations.

## Project Structure

```text
my-app/
├── lib/license/
│   ├── core.js           # base32, machine-code format, key encode/verify, deactivation code (shared with CLI)
│   ├── core.d.ts
│   ├── machine-id.js     # OS identity → machine code
│   ├── gate.js           # pure request classifier + Socket.IO check
│   ├── state.js          # load/verify license file, in-memory state, refresh
│   ├── agreement.js      # AGREEMENT_VERSION, text loader/splitter
│   ├── public-key.js     # written by `pebot-keygen init`; placeholder until then
│   └── revoked.js        # revoked license numbers
├── modules/license/{schema.ts, service.ts}
├── app/api/license/{status,agreement,activate,deactivate}/route.ts
├── app/activate/page.tsx            # agreement → machine code → key
├── app/legal/agreement/page.tsx     # read-only agreement, EN/FIL
├── app/admin/settings/license/page.tsx   # replaces settings/subscription
├── legal/pebot-license-agreement.txt
├── server.js                         # calls gate before Next handler + io.use
└── tests/unit/license-{core,gate,state,service,keygen,agreement}.test.ts
tools/pebot-keygen/{pebot-keygen.js, registry.js, pebot-keygen.cmd, README.md}
```

## Complexity Tracking

| Item | Why | Simpler alternative rejected |
|---|---|---|
| Shared `.js` instead of `.ts` for `lib/license` core | `server.js` and the CLI run under plain Node with no TS build step. | Duplicating the format in two languages could drift, which would break issued keys. |
| `tests/unit/subscription*.test.ts` assertions change | Tier gating is intentionally removed (FR-019). The tests are rewritten to assert the new permission-based rule, not deleted. | Keeping tier gating contradicts the owner's single-price decision. |

## Implementation notes (2026-11-14)

Deviations from the plan, all resolved:

- **No `core.d.ts`.** `allowJs` plus JSDoc gives the TypeScript side full types, and a hand-written declaration file would be a second copy that could drift.
- **The subscription store, `/api/subscription` and `lib/subscription.ts` were deleted, not converted.** After FR-019 nothing reads them. `guardFeature` now uses the Staff Management permission flags. The `Subscription` table and seed rows are untouched and left for the cleanup spec.
- **Socket.IO is refused at the transport handshake too** (`allowRequest`), in addition to `io.use`. The end-to-end run showed the engine handshake opening before the namespace check.
- **base32 decoding rejects non-zero padding bits.** A test found that an altered last character could decode to the same bytes.
- **ESLint:** `lib/license/**/*.js` is exempt from `no-require-imports`, because it is CommonJS shared with `server.js` and the seller tool.

Verified end to end on a dev server on 2026-11-14:
- unlicensed redirects, 403 and 503 responses
- LAN versus local behaviour
- a spoofed `x-pebot-local` header is refused
- agreement, then activation
- wrong-machine and invalid keys are rejected
- the license survives a restart
- an edited license file locks Pebot again
- keygen `init`, `issue`, `reissue`, `verify-deactivation`, `list` and `revoke`, including the 3-per-year limit

Not yet verified (needs the owner's machine and a browser):
- The NSIS installer's agreement page (`npm run electron:build:win`).
- A visual check of `/activate` and Settings → License in a browser.
- The Playwright acceptance suite and the Android tablet app against a locked server. Both now need an activated install. The tablet shows a generic error on `LICENSE_REQUIRED`; a friendlier message belongs to a tablet spec.
