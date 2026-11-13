# Research: Pebot License Activation

## R1. Where enforcement lives

- **Decision**: A pure gate function in `lib/license/gate.js`, called by `server.js`. It runs before the Next.js request handler and in a Socket.IO `io.use` handshake middleware.
- **Rationale**: Every screen, API call and socket on the LAN passes through `server.js` (Principle V: Electron is only a window onto it). Next's `middleware.ts` runs on the edge runtime and cannot read files or the OS machine identity.
- **Alternatives**:
  - Electron-only check: rejected, because running `node server.js` directly would bypass it.
  - Per-route checks: rejected, because Principle II requires central enforcement.

## R2. Machine identity

- **Decision**: SHA-256 over `pebot-machine-v1|<MachineGuid>|<SMBIOS UUID>`, truncated to 55 bits. The 55 bits become 11 Crockford base32 characters plus 1 check character (5 bits of SHA-256 of the data characters), displayed as `PBT-XXXX-XXXX-XXXX`.
  - MachineGuid comes from `reg query HKLM\SOFTWARE\Microsoft\Cryptography /v MachineGuid`.
  - The SMBIOS UUID comes from `(Get-CimInstance Win32_ComputerSystemProduct).UUID`.
  - Read once at startup, with retries and a 15 s timeout.
- **Rationale**:
  - MachineGuid persists across reboots and Windows updates, and is regenerated on reinstall: that is the reformat case.
  - The SMBIOS UUID belongs to the motherboard, so a drive moved or cloned to another PC changes the code.
  - Neither depends on network adapters, which change when dongles or VPNs appear.
  - `wmic` is deprecated in Windows 11, so it is not used.
- **No fallback**: if either value can't be read, Pebot errors. It never substitutes a random value, because a code that changes between boots would lock out paying customers.
- **Dev OSes**: Linux uses `/etc/machine-id` plus `/sys/class/dmi/id/product_uuid` when readable. macOS uses `IOPlatformUUID`. Tests inject the identity values.
- **Alternatives**:
  - MAC address: unstable.
  - Disk serial: changes on drive swap, but cloning keeps it.
  - CPU ID: not unique per unit.

## R3. Key format and signature

- **Decision**: Ed25519 via Node's built-in `crypto`. No new dependency.
  - The payload is 15 bytes:
    - format version (1)
    - product major version (1)
    - license number (uint32)
    - machine code value (7 bytes, 55 bits)
    - issue day as days since 2026-01-01 (uint16)
  - The signature is over `"PEBOT-LICENSE\0" || payload`.
  - The key text is `PEBOT-` followed by Crockford base32 of payload‖signature (79 bytes, 127 characters).
  - Parsing ignores case, whitespace, line breaks and `-`.
- **Rationale**:
  - Asymmetric signing is the only way an offline app can verify without being able to mint keys (FR-004).
  - Base32 has no case or underscore issues in Messenger and avoids look-alike characters.
  - The issue date is informational only (FR-006).
- **Alternatives**:
  - HMAC: the secret would ship in the app.
  - RSA: much longer keys.
  - base64url: underscores can trigger chat formatting.

## R4. Deactivation code

- **Decision**: `DEACT-` + base32 of `licenseNo(4) ‖ nonce(3) ‖ HMAC-SHA256(key = SHA-256("pebot-deact-v1"‖licenseKeyText), msg = licenseNo‖machineCode‖nonce)[0..7]`. The seller verifies using the key text from the registry.
- **Rationale**: Matching a code to a license needs no shared secret beyond the key both sides already have. It is honest-owner proof, as the spec assumptions state. The 3-per-year limit is the real control.

## R5. Storage

- **Decision**: `pebot-license.json` sits in the same directory as the SQLite database: `dirname(getDatabasePath())`, which is Electron `userData` in production and `prisma/` in dev. It holds the key text, `activatedAt`, and the agreement version and acceptance time. It is re-verified on every start.
- **Rationale**: It survives app updates the same way the database does. Editing it gains nothing because the signature is checked again.
- **Dev**: `prisma/pebot-license.json` is added to `.gitignore`.

## R6. Local-only actions (FR-007)

- **Decision**: `server.js` strips any incoming `x-pebot-local` header, then sets `x-pebot-local: 1` only when `req.socket.remoteAddress` is loopback (`127.0.0.1`, `::1`, `::ffff:127.0.0.1`). The gate refuses `/activate` and mutating `/api/license/*` calls from non-loopback addresses. Route handlers check the header again as defence in depth.

## R7. Replacing subscription tiers (FR-019)

- **Finding**: Tier features `analytics`, `inventory`, `staff`, `settings`, `kitchen` and `loyalty` match Staff Management permission keys exactly. Seeded STAFF users have the REGULAR tier (all false), and staff permission defaults are also false. ADMIN always passed.
- **Decision**: `guardFeature` delegates to the existing permission check: ADMIN passes, others need `permissions[feature] === true`. The subscription page becomes Settings → License, and the client `hasFeature` reads permissions.
- **Schema**: The `Subscription` table and the seed are left untouched. Dropping them would be a migration with no user benefit, so it is deferred to the cleanup spec.
- **Rationale**: The owner controls access in one place (Staff Management) instead of a pricing tier, and no role silently gains access.

## R8. License agreement delivery

- **Decision**: One source file, `my-app/legal/pebot-license-agreement.txt`, holding English then Filipino under a `FILIPINO / TAGALOG` heading.
  - Used as electron-builder `nsis.license`. NSIS supports .txt; Filipino isn't an NSIS UI language, so both languages are shown in one file.
  - Shipped through `build.files`.
  - Served to the app by `GET /api/license/agreement?lang=en|fil`, which splits on the heading.
  - The version constant lives in `lib/license/agreement.js`, and a test asserts it appears in the text.

## R9. Seller tool

- **Decision**: `tools/pebot-keygen/` is plain Node CommonJS with no dependencies and is never packaged (the build only takes `my-app/`).
  - It reuses `my-app/lib/license/core.js` so app and tool cannot disagree on the format.
  - Private key and registry live in `%USERPROFILE%\PebotSeller\`, overridable with `--dir` or `PEBOT_SELLER_DIR`.
  - `init` writes the public key into `my-app/lib/license/public-key.js`.
  - `revoke` appends to `my-app/lib/license/revoked.js`.
- **Not run by the agent**: `init` is left for the seller to run. Creating the seller's master key is their action, and they must back it up.
- **Before `init`**: the shipped placeholder public key verifies nothing, so builds fail closed.

## R10. Dev-mode bypass

- **Decision**: None. The developer issues a key for their own machine, as the spec assumes. A bypass flag is exactly the "a bug gives free access" risk the owner rejected.
