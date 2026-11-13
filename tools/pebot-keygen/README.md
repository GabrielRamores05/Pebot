# pebot-keygen: issuing Pebot license keys

**Seller only.** This folder is never put in the installer, which only packages `my-app/`. It needs Node.js.

Run commands from the repo root:

```
tools\pebot-keygen\pebot-keygen.cmd <command>      (Windows)
node tools/pebot-keygen/pebot-keygen.js <command>  (any OS)
```

## One time: create your seller keys

```
tools\pebot-keygen\pebot-keygen.cmd init
```

This creates `C:\Users\<you>\PebotSeller\`, which holds:
- `private-key.pem`: **the only thing that can make valid keys.**
- `registry.json`: your record of every sale.
- `licenses\`: the `.lic` files you send to customers.

It also writes the public key into `my-app/lib/license/public-key.js`. Commit that file and rebuild the installer. Until then, every copy of Pebot stays locked.

**Back up the `PebotSeller` folder in two places**, for example a USB stick kept somewhere safe plus an encrypted copy. Never commit it, never send it, and don't keep the only copy on a laptop you carry.
- **If you lose it,** you can't issue keys for this version of Pebot.
- **If someone copies it,** they can make free keys.

## Each sale

1. The customer pays. You send them the installer.
2. They install it, accept the agreement, and send you the Machine Code from the activation screen.
3. You issue their key:
   ```
   tools\pebot-keygen\pebot-keygen.cmd issue --machine PBT-7K2M-QX9D-41HT --customer "Aling Nena's Carinderia" --contact "0917 123 4567"
   ```
4. Send the printed key over Messenger, or send the `.lic` file it saved. They paste the key or click **Import license file**.

## Customer moves to a new computer

- **Old PC still works:** they open Settings → License → Move to a new computer and send you the `DEACT-…` code plus the new Machine Code.
  ```
  pebot-keygen.cmd verify-deactivation DEACT-XXXX-…
  pebot-keygen.cmd reissue --license 1001 --machine PBT-NEW… --deactivation DEACT-XXXX-…
  ```
- **Old PC lost, stolen or dead:** record what they told you.
  ```
  pebot-keygen.cmd reissue --license 1001 --machine PBT-NEW… --reason "laptop stolen, owner statement via Messenger 2026-11-20"
  ```

Re-activation is free 3 times per 12 months. Beyond that the tool stops, so you can review the case. Add `--override` to proceed.

## Refunds

```
pebot-keygen.cmd revoke --license 1001 --reason "refunded 2026-11-20"
```

This marks the license revoked and adds the number to `my-app/lib/license/revoked.js`. Commit that file. The customer's copy stops working once they install a release built after the change.

## See all sales

```
pebot-keygen.cmd list
```

Use `--dir <path>` or the `PEBOT_SELLER_DIR` variable to work with a different seller folder, such as a test folder.
