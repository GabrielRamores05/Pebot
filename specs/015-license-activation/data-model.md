# Data Model: Pebot License Activation

No database tables are added. License state is a file next to the database, and the seller registry is a file on the seller's PC.

## MachineCode

| Field | Rule |
|---|---|
| value | 55-bit integer from the SHA-256 of machine identity (research R2) |
| text | `PBT-` + 3 groups of 4 Crockford base32 characters; the last character is the check |

Validation: alphabet `0-9 A-H J K M N P-T V-Z`. Input is case-insensitive, and `O→0` and `I/L→1` are normalized. The check character must match.

## LicensePayload (signed)

| Field | Size | Rule |
|---|---|---|
| formatVersion | 1 B | `1` |
| productMajor | 1 B | must equal the app's major version (`1`) |
| licenseNo | 4 B | ≥ 1001, unique per sale, kept across re-issues |
| machine | 7 B | MachineCode value |
| issuedDay | 2 B | days since 2026-01-01; informational only |

The key text is `PEBOT-` + base32(payload ‖ Ed25519 signature).

Verification results: `ok`, `invalid` (bad format or signature), `wrong-machine`, `wrong-version`, `revoked`, `not-configured` (placeholder public key).

## ActivationRecord: `pebot-license.json` (customer PC)

```json
{
  "agreement": { "version": "1.0-draft", "acceptedAt": "ISO-8601" },
  "key": "PEBOT-… | null",
  "activatedAt": "ISO-8601 | null"
}
```

States:
1. `no-agreement`: the file is missing or the agreement version is outdated.
2. `agreement-accepted`: the key is null or fails verification.
3. `active`: the key verifies for this machine.

Transitions:
- accept agreement: 1 → 2
- activate with a valid key: 2 → 3
- deactivate: 3 → 2, with the key cleared and a deactivation code returned
- revocation, hardware change or file edit: 3 → 2, evaluated at startup

## SellerRegistry: `registry.json` (seller PC)

```json
{
  "nextLicenseNo": 1001,
  "licenses": [{
    "licenseNo": 1001,
    "customer": "Aling Nena's Carinderia",
    "contact": "0917…",
    "status": "active | revoked",
    "issues": [{ "machineCode": "PBT-…", "issuedAt": "ISO", "key": "PEBOT-…",
                 "kind": "new | reissue", "deactivationCode": "DEACT-… | null",
                 "reason": "string | null", "override": false }],
    "revokedAt": "ISO | null", "revokeReason": "string | null",
    "notes": []
  }]
}
```

Re-activations in the last 12 months = issues with `kind = reissue` whose `issuedAt` is within 365 days. The free limit is 3. Going past it needs `--override`.

## RevocationList

`lib/license/revoked.js` exports an array of license numbers that ships with each release.
