# Contract: `pebot-keygen` (seller-only CLI)

Run with `node tools/pebot-keygen/pebot-keygen.js <command>` or `tools\pebot-keygen\pebot-keygen.cmd <command>`.

Global option: `--dir <path>` (default `$PEBOT_SELLER_DIR`, else `~/PebotSeller`).

| Command | Arguments | Effect | Exit |
|---|---|---|---|
| `init` | — | Creates `private-key.pem` and `registry.json` in the seller dir, writes the public key to `my-app/lib/license/public-key.js`, and prints backup instructions. | 1 if a private key already exists |
| `issue` | `--machine PBT-… --customer "<name>" --contact "<contact>" [--note "<text>"]` | Validates the machine code, assigns the next license number, prints the key, writes `licenses/<licenseNo>-<machine>.lic`, and appends to the registry. | 1 on a bad code, missing args, or no key |
| `reissue` | `--license N --machine PBT-… (--deactivation DEACT-… \| --reason "<text>") [--override]` | Re-binds the license to a new PC. Verifies the deactivation code if given. Enforces 3 per 365 days unless `--override`. | 1 on a failed check |
| `verify-deactivation` | `<DEACT-…>` | Prints the license number, customer, and whether the code matches the license's current key. | 1 if no match |
| `list` | `[--json]` | Shows a table of licenses: number, customer, contact, current machine, first issued, re-activations in the last 12 months, status. | 0 |
| `revoke` | `--license N --reason "<text>"` | Marks the license revoked and adds N to `my-app/lib/license/revoked.js`. | 1 if unknown |

The `.lic` file contents are the key text on its own line, followed by `# Licensed to <customer>` and `# License <N>`. Pebot reads the first `PEBOT-` line.
