# Building the Pebot installer

Run on **your own PC** (the one that holds `PebotSeller`):

1. Once: `tools\pebot-keygen\pebot-keygen.cmd init`, then back up the
   `PebotSeller` folder somewhere safe (USB + cloud). Commit
   `my-app\lib\license\public-key.js` — the public key is safe to share.
2. Every release: `tools\release\build-pebot.cmd`

The script refuses to build without the public key, runs the tests, builds the
Windows installer and copies it to `Pebot 1.0\` (not committed to git) with a
SHA-256 checksum file.
