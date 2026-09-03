# Contract: Tablet ↔ PC Ledger Bridge (spec 013, Phase 2)

Status: design (implemented progressively). Owner decision basis: PC is the single
café ledger; tablet mirrors and pushes (see `specs/013-tablet-full-staff-parity/decisions.md`).

## 1. Topology

- The Windows PC runs the Next.js + Socket.IO server (`server.js`) on the café LAN,
  port 3000, Socket.IO path `/api/socket`. It is the canonical store ledger.
- The tablet is a staff terminal. Its Room DB is a **working mirror + offline cache**:
  it must keep working when the PC is unreachable (constitution §I) and reconcile on
  reconnect (server wins on conflicts; orders merge by `orderNumber`).
- Socket.IO client on the tablet connects to `http://<pc-ip>:3000` with
  `path: '/api/socket'`, joins rooms it cares about (`tables`, `order-*` as needed),
  and listens for the web's broadcast vocabulary below.

## 2. Auth: device pairing

- ADMIN opens PC Settings ▸ Account & Data (or new admin tool) and creates a
  **device credential**: POST `/api/tablet/devices` {name} → {secret}. Secrets are
  stored hashed in the PC database (Setting kv table) and can be revoked (DELETE).
- The tablet stores `{serverUrl, secret}` in `Settings`/SharedPreferences (System tab).
- Every tablet→PC request sends `Authorization: Bearer <secret>` plus headers
  `X-Cafeos-Device: <deviceId>`, `X-Cafeos-Staff: <actingStaffName>`,
  `X-Cafeos-Staff-Role: <role>` (informational/audit; PC trust rests on the secret).
- PC-side guard: thin helper `guardDevice` (device secret valid → proceed). Role
  decisions still happen on the tablet per AccessControl; the PC re-validates business
  invariants (money/value derived server-side, never from client amounts).

## 3. Push endpoints (to add on the PC — thin routes → one service call, constitution §IV)

- `POST /api/tablet/orders` — body: {order payload + items/options + payment evidence
  identity; discount identities only, never pesos} → **orders service create path**:
  recompute totals/discounts/loyalty/voucher server-side, assign canonical receipt
  serial in the finalize transaction, record payment, emit the normal web socket
  events (new-order, order-status-update, analytics…) so PC kitchen/live/analytics
  update instantly. Response: {orderId, orderNumber, receiptSerial} or 409 detail.
- `PATCH /api/tablet/orders/<orderNumber>` {status} — status transitions incl. cancel
  (PC applies its cancel rules & stock/voucher reversal).
- `POST /api/tablet/stock` {ingredientId or productId, delta, notes} — adjustments that
  originated on the tablet.
- `POST /api/tablet/attendance` {staffKey, action} and a generic
  `POST /api/tablet/audit` for local admin actions the PC should record.

## 4. Pull endpoints (to add on the PC)

- `GET /api/tablet/snapshot?since=<epochMs>` — catalog (categories/products/options/
  ingredients/recipes/suppliers), settings (BusinessSettings + voice), loyalty
  (vouchers/cards/settings), staff, tables, stations, and orders updated since
  `<since>`, as versioned JSON. Tablet applies it to its mirror (server-wins).
- Live deltas also arrive over Socket.IO (below), so snapshot is the bootstrap and the
  socket is the ongoing feed.

## 5. Socket.IO vocabulary (already broadcast by the web app — see `hooks/useSocket.ts`
and `server.js` rooms)

`new-order`, `order-status-update`, `order-message`, `order-followup`, `queue-update`,
`table-update`, `table-guest-joined`, `table-guest-updated`, `table-guest-left`,
`table-clean-request`, `product-update`, `inventory-update`, `ingredients-update`,
`loyalty-update`. Rooms: `order-<orderNumber>`, `tables`, plus role/page rooms used by
the web UI. The tablet joins `tables` and refreshes its mirror on each event; the old
bespoke WebSocket (`:3001/pebot-sync`) and its `SocketSyncManager` code path are
retired in favor of this channel.

## 6. Offline behavior & reconciliation

- While disconnected, tablet writes stay local and each **value-changing** action is
  appended to the local `OutboxQueue` table (Room v19) with an idempotency key =
  `orderNumber` (orders), `<entityType>:<entityKey>` otherwise.
- Offline orders carry a **provisional receipt series**: `Provisional-<deviceShortId>-NNNNNN`
  where the device short id is stable per install and NNNNNN is sequential per device
  (tablet-local sequence, never reused, never renumbered later — the provisional number
  stays on the record when the PC imports it, documented as a separate series).
- On reconnect: flush queue in order; each entry retried (attempts, exponential backoff,
  lastError recorded; terminal FAILED entries surface in Settings as "unsynced changes").
- Idempotency: PC looks up by `orderNumber`; already-present → respond with the existing
  canonical record (skip), so replays are safe.
- Conflict rule: **server wins** for catalog/settings/inventory/loyalty/staff mirror
  state. Tablet-originated orders are accepted unless they collide on orderNumber.
- After flush: tablet pull snapshot/socket deltas to converge its mirror.

## 7. What is NOT in the bridge

- No bidirectional master-master sync, no cloud, no changes to PC auth guards, no
  client-supplied pesos (PC derives money), no weakening of two-trust-zone (device
  secret ≠ staff session; device secret only enables this gateway).
- Customer QR channel stays on the PC (scope decision 1).

## 8. Implementation order

1. Tablet: `OutboxQueue` entity/DAO/migration v18→v19 + queue store (this round).
2. PC: device-credential admin tool + `guardDevice`; tablet push/pull routes calling
   existing services; emit vocabulary unchanged.
3. Tablet: REST client (okhttp or HttpURLConnection) with device auth; snapshot
   applier; Socket.IO client wired to web vocabulary (replaces bespoke WS); offline
   flush service; Settings ▸ System PC-connection UI; provisional receipt prefix.
4. Cross-checks: order lifecycle end-to-end online & offline; reconciliation report.
