# Contract: License HTTP API and gate

All responses are JSON. "Local" means the request came from the main PC itself (`x-pebot-local: 1`, which only `server.js` sets).

| Method | Path | Who | Request | Response |
|---|---|---|---|---|
| GET | `/api/license/status` | anyone (gate-allowed) | — | `{ state: 'no-agreement'\|'agreement-accepted'\|'active', reason?: VerifyFailure, licenseNo?: number, activatedAt?: string, agreementVersion: string, local: boolean, machineCode?: string }`. `machineCode` is included only when local. |
| GET | `/api/license/agreement?lang=en\|fil` | anyone | — | `{ version: string, lang: 'en'\|'fil', text: string }` |
| POST | `/api/license/agreement` | local | `{ version: string }` (must equal the current version) | `{ state }` |
| POST | `/api/license/activate` | local | `{ key: string }` (max 2,000 chars) | 200 `{ state: 'active', licenseNo }` or 422 `{ error, reason: VerifyFailure }` |
| POST | `/api/license/deactivate` | local + ADMIN session | `{ confirm: true }` | `{ deactivationCode: string }` |

`VerifyFailure` = `invalid | wrong-machine | wrong-version | revoked | not-configured | no-agreement`.

## Gate (server.js) when the state is not `active`

| Request | Local | Remote |
|---|---|---|
| `/_next/*`, `/fonts/*`, `/icons/*`, `/favicon.ico`, `/manifest*`, `/images/*` | allow | allow |
| `/api/license/status`, `GET /api/license/agreement` | allow | allow |
| `/activate`, `/legal/agreement`, other `/api/license/*` | allow | 403 |
| any other `/api/*` | 403 `{ error: 'LICENSE_REQUIRED' }` | same |
| any other page | 302 → `/activate` | 503 "being set up" HTML page |
| Socket.IO handshake | refused `LICENSE_REQUIRED` | same |

When the state is `active`, everything passes through, and `/activate` redirects to `/`.

Mutating `/api/license/*` calls are refused from non-local addresses even when active.
