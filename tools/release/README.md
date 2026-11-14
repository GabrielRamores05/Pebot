# Building the Pebot installer

Run on **your own PC** (the one that holds `PebotSeller`):

1. Once: `tools\pebot-keygen\pebot-keygen.cmd init`, then back up the
   `PebotSeller` folder somewhere safe (USB + cloud). Commit
   `my-app\lib\license\public-key.js` — the public key is safe to share.
2. Every release: `tools\release\build-pebot.cmd`

The script refuses to build without the public key, runs the tests, builds the
Windows installer and copies it to `Pebot 1.0\` (not committed to git) with a
SHA-256 checksum file.

## Publishing an update (so customers get the "update available" notice)

Installed copies check the **latest release** of the public repository
`GabrielRamores05/pebot-releases` (only installers live there, so the source
repository can be private). Create that repository once, empty, public.

For each release:
1. Raise `"version"` in `my-app/package.json` (for example 1.0.5) and commit.
2. Run `tools\release\build-pebot.cmd`.
3. Publish it:
   `gh release create v1.0.5 "Pebot 1.0\Pebot Setup 1.0.5.exe" --repo GabrielRamores05/pebot-releases --title "Pebot 1.0.5" --notes "What changed, in plain words"`

Within six hours every online Pebot shows the notice. To use another address
(for example your website), set `PEBOT_UPDATE_FEED` to a URL that returns
`{"version": "1.0.5", "url": "https://github.com/...", "notes": "..."}`.
