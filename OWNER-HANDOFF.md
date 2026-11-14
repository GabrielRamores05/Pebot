# Pebot: what to do next (owner hand-off)

Written 14 November 2026, when work moved from a borrowed PC to the owner's own PC.
Follow the parts in order. Each step says what you should see if it worked.

**Where things stand**
- `main` has specs 015–023: licensing, restaurant checkout, redesign, printing,
  voids and PINs, payroll, backups, profit report and the security fixes.
- Branch `024-qa-and-hardening` (pushed, **not merged yet**) has the QA fixes:
  - installer build fixed
  - semi-monthly payroll fixed
  - Revenue counts only paid orders
  - "not an official receipt" wording until you enter a BIR permit number
  - editable government rates
  - update notice
  - automated money tests
  - the setup guide
  Part 3 merges it.
- No seller key exists yet, so every copy of Pebot stays locked until you do Part 4.

---

## Part 1. Lock down GitHub (5 minutes, do this first)

1. **Make the source code private.** On github.com, open
   `GabrielRamores05/Pebot` → **Settings** → scroll to **Danger Zone** →
   **Change visibility** → **Private**.
   Why: right now anyone can read Pebot's code, including how the license check works.
2. **Create the public releases repository** that installed copies check for updates:
   github.com → **New repository** → name `pebot-releases` → **Public** →
   tick "Add a README" → Create.
   Only installers go there, never code.

**You should see:** Pebot shows a lock icon (Private), and `pebot-releases` exists and is Public.

---

## Part 2. Set up your PC (30 minutes, once)

Install these (accept the defaults):
- **Node.js 24 LTS** from nodejs.org (this project was built with Node 24.14)
- **Git for Windows** from git-scm.com
- **GitHub CLI** from cli.github.com, then run `gh auth login` in a terminal and sign in
- **Google Chrome** (used by the automated tests)
- **VS Code** (optional, for reading code)

Then open **PowerShell** and run:

```powershell
cd $HOME\Documents
git clone https://github.com/GabrielRamores05/Pebot.git
cd Pebot\my-app
npm ci
npx playwright install chromium
```

**You should see:** `npm ci` ends without red `ERR!` lines. Warnings are fine.

Check that the code is healthy:

```powershell
npm run test:unit
```

**You should see:** `Tests  680 passed` (or more), on the `024` branch after Part 3.

---

## Part 3. Merge the QA branch into main (5 minutes)

```powershell
cd $HOME\Documents\Pebot
git fetch origin
gh pr create --base main --head 024-qa-and-hardening --title "QA fixes, payroll rates, update notice, e2e tests" --body "See OWNER-HANDOFF.md"
gh pr merge --merge
git checkout main
git pull
```

**You should see:** `git log --oneline -3` shows the merge at the top.

---

## Part 4. Create your seller key (10 minutes, ONCE in your life)

This is the key that makes license keys. Do it **only on your own PC**.

```powershell
cd $HOME\Documents\Pebot
tools\pebot-keygen\pebot-keygen.cmd init
```

**You should see:** it creates `C:\Users\<you>\PebotSeller\` and updates
`my-app\lib\license\public-key.js`.

Right away:
1. **Back up the whole `PebotSeller` folder in two places:** a USB stick kept at
   home, and an encrypted copy (for example a password-protected zip in Google Drive).
   - Lose it and you can never issue keys for this Pebot again.
   - If someone copies it, they can make free keys.
2. **Never** put `PebotSeller` inside the Pebot folder, never commit it, never send it.
3. Commit the public key. It's safe to share; it can only check keys, not make them:

```powershell
git add my-app/lib/license/public-key.js
git commit -m "license: seller public key"
git push
```

---

## Part 5. Try Pebot on your PC before building (30 minutes)

Use a **test database** so you never mix test orders with real data:

```powershell
cd $HOME\Documents\Pebot\my-app
$env:DATABASE_URL = "file:$HOME\Documents\Pebot\my-app\prisma\qa.db"   # full path; qa.db is never committed
$env:JWT_SECRET = "any-long-random-text-for-testing-only"
npx prisma db push
npm run seed
npm run build
$env:PORT = "3111"; npm start
```

Open **http://localhost:3111** in Chrome:
1. It asks you to accept the agreement, then shows a **Machine Code** (like `PBT-XXXX-XXXX-XXXX`).
2. In a **second** PowerShell window, give yourself a test license:
   ```powershell
   cd $HOME\Documents\Pebot
   tools\pebot-keygen\pebot-keygen.cmd issue --machine PBT-XXXX-XXXX-XXXX --customer "Owner test PC" --contact "me"
   ```
3. Paste the printed key into Pebot. **You should see** the sign-in page.
4. Sign in with `admin@cafeos.local` / `admin123` (demo account from the seed).

Then run the automated money checks (with the app still running):

```powershell
cd $HOME\Documents\Pebot\my-app
$env:PEBOT_URL = "http://localhost:3111"
npm run test:e2e
```

**You should see:** `9 passed`.
These tests create orders, so **never** point them at a restaurant's real Pebot.

Click through yourself too (about 20 minutes):
- [ ] New Order: sell 2 items with cash. Try a Senior Citizen discount.
- [ ] Order History: void an order. It asks for a manager PIN; set one first in
      Staff & HR → Team → edit yourself → PIN.
- [ ] Settings → Printing: print a test invoice. It should say **SALES SLIP** and
      "This is not an official receipt".
- [ ] Inventory → Ingredients → **Stock count** and **Log waste**.
- [ ] Analytics → Revenue: the profit report.
- [ ] Staff & HR → Payroll: give a staff member an hourly rate, clock them in and
      out, then **Run payroll**. Print a payslip.
- [ ] Settings → Account & Data: **Back up now**. You should see "Backed up".

Stop the app with `Ctrl + C`.

---

## Part 6. Build the installer (20 minutes)

```powershell
cd $HOME\Documents\Pebot
tools\release\build-pebot.cmd
```

It refuses to run without your public key (Part 4), runs the tests, then builds.

**You should see:** a folder `Pebot\Pebot 1.0\` with `Pebot Setup 1.0.4.exe` and a
`.sha256.txt` file. This folder is never committed.

Test the installer on a **second PC or a laptop** if you can:
- [ ] Install, accept the agreement, send yourself the Machine Code, activate.
- [ ] If an old CaféOS was installed there, check that its data came across.

---

## Part 7. Test with real hardware (1–2 hours, before the first sale)

You need a thermal receipt printer (58 mm and/or 80 mm) and a cash drawer.
1. Install the printer's **Windows driver** and print a Windows test page.
2. Settings → Printing: pick the printer and paper width, then print a test invoice and a kitchen ticket.
3. Cash drawer: in the printer's Windows settings, turn on "open cash drawer".
   Make a cash sale and check that the drawer opens.
4. Write down which printer models worked. That list helps your sales.

---

## Part 8. Publish the first release (10 minutes)

So installed copies can see updates:

```powershell
cd $HOME\Documents\Pebot
gh release create v1.0.4 "Pebot 1.0\Pebot Setup 1.0.4.exe" --repo GabrielRamores05/pebot-releases --title "Pebot 1.0.4" --notes "First release."
```

For every later update:
1. Raise `"version"` in `my-app\package.json` (for example `1.0.5`), commit and push.
2. Run `tools\release\build-pebot.cmd`.
3. Run `gh release create v1.0.5 "Pebot 1.0\Pebot Setup 1.0.5.exe" --repo GabrielRamores05/pebot-releases --title "Pebot 1.0.5" --notes "What changed, in plain words"`

Within 6 hours, every Pebot that is online shows the owner **"Pebot 1.0.5 is available → Download"**.

---

## Part 9. Selling (each customer)

1. The customer pays ₱4,999. You send them the installer (from `pebot-releases`, or by USB).
2. They install it and send you their **Machine Code**.
3. You run:
   ```powershell
   tools\pebot-keygen\pebot-keygen.cmd issue --machine PBT-.... --customer "Restaurant name" --contact "0917 ..."
   ```
4. Send them the key (Messenger is fine). They paste it and Pebot unlocks.
5. Send them `docs\setup-guide.md` (Wi-Fi, printers, backups, BIR, staff, opening-day checklist).

Moving a customer to a new PC, refunds, and the list of sales are all covered in
`tools\pebot-keygen\README.md`.

---

## Part 10. People to talk to before selling widely

- [ ] **Lawyer:** review the license agreement (`my-app\legal\pebot-license-agreement.txt`), fill in the
      `[SELLER NAME]`, `[SUPPORT …]` and `[CITY]` blanks, and review the refund policy.
- [ ] **Accountant:** check a Senior/PWD sale, the service charge split, and one
      semi-monthly payslip (SSS, PhilHealth, Pag-IBIG, tax).
- [ ] **BIR:** Pebot is **not** BIR-accredited. Say so clearly on the website and
      to every customer. They keep issuing their BIR-registered receipts. Applying
      for accreditation (a Permit to Use) is a later business decision.
- [ ] **One pilot restaurant for a week** before wide selling. You'll learn more
      from that than from any new feature.

---

## Part 11. Still to build (next sessions)

1. Rewrite the Inventory screen into smaller parts (it is one 2,100-line file).
   Test it by hand afterwards.
2. Welcome page with the Pebot robot mascot.
3. Philippine celebrations calendar.
4. Clean out old unused code (the `Subscription` and `POSLicense` tables, old CaféOS names).
5. Possibly a one-click button to add the legal leave types (Service Incentive
   Leave 5 days, Maternity 105, Paternity 7, Solo Parent 7) for new restaurants.

To continue with Claude Code on your PC, open the `Pebot` folder and say what you
want next. The rules it follows are in `AGENTS.md` and `.specify\memory\constitution.md`.

---

## Rules that protect the business

- **Never commit or send** the `PebotSeller` folder or `private-key.pem`.
- Before each commit, `git status` should **not** list anything under `PebotSeller`.
- `my-app\lib\license\public-key.js` **is** safe to commit, after Part 4.
- Build installers **only** with `tools\release\build-pebot.cmd`.
- Test only on test databases (`qa.db`), never on a customer's data.
- Back up `PebotSeller` again whenever `registry.json` has changed a lot (many new sales).

## If something goes wrong

| Problem | What to do |
|---|---|
| `npm ci` fails | Check `node -v` says v24. Delete `my-app\node_modules` and run `npm ci` again. |
| Build says "STOP: no seller public key yet" | Do Part 4, then commit `public-key.js`. |
| Pebot says "not activated" after an update | The installer was built before Part 4 or with a different key. Rebuild after Part 4. |
| `npm run test:e2e` cannot connect | Start the app first (Part 5) and set `PEBOT_URL`. |
| Pebot shows no update notice | Check that the release is in `pebot-releases`, is not a draft or pre-release, and that its version is higher than the installed one. |
| You lost `PebotSeller` | Restore it from the backup. With no backup, new keys need a new seller key and a new installer for every customer. |
