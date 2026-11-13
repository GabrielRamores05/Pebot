# Quickstart: validating license activation

## Prerequisites
- Node 20+, and `npm install` done in `my-app/`.
- A disposable seller dir: `export PEBOT_SELLER_DIR=$(mktemp -d)` (never your real one).

## Automated
```bash
cd my-app
npm run test:unit          # includes tests/unit/license-*.test.ts
npx tsc --noEmit && npm run lint
```

## Manual end-to-end
1. Run `node tools/pebot-keygen/pebot-keygen.js init --dir "$PEBOT_SELLER_DIR"`.
   - Expect a backup warning and `my-app/lib/license/public-key.js` updated.
   - Restore that file with `git checkout` after testing if you used a throwaway dir.
2. Run `cd my-app && npm run dev`, then open http://localhost:3000.
   - Expect a redirect to `/activate` showing the agreement. You must accept it before the Machine Code appears.
3. From another device on the LAN, open `http://<ip>:3000/menu`.
   - Expect the "being set up" page.
   - `curl http://<ip>:3000/api/products` returns 403 `LICENSE_REQUIRED`.
4. Run `node tools/pebot-keygen/pebot-keygen.js issue --machine <code from screen> --customer Test --contact 0917`.
5. Paste the key on `/activate`. Expect the app to open, and Settings → License to show it as active.
6. Restart `npm run dev`. Expect no prompt.
7. Change one character in the key inside `prisma/pebot-license.json` and restart. Expect the activation screen.
8. Use Settings → License → Move to a new computer, then run `verify-deactivation <code>`. Expect a match.
9. Build the installer with `npm run electron:build:win`. Expect the agreement page before installation, and neither `tools/` nor any `.pem` file in `dist-electron/win-unpacked`.
