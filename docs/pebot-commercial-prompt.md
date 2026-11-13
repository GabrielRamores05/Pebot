# Pebot: turn the café POS into a sellable restaurant POS

Read AGENTS.md, .specify/memory/constitution.md and PEBOT_MASTER_PROMPT.md first. They still apply.
Where this request conflicts with them, say so and propose a constitution amendment
(/speckit-constitution, with a version bump). Don't override them without saying anything.

## Goal

I want to sell Pebot to Philippine restaurant owners, not only cafés: carinderias, fast food,
casual dining, bakeries and milk-tea shops. The price is ₱4,999, one-time, for lifetime use and
support. It must stay fully offline (Principle I). The aim is to make an owner's day easier.

## Business decisions already made (don't ask me again)

1. **License scope:** one license covers one restaurant location. That means the main PC plus
   unlimited tablets, cashier terminals, kitchen screens and customer QR phones on its LAN.
   A second branch needs a second license, at a discount (suggested ₱3,499).
2. **Re-activation:** free, up to 3 times a year per license. More than that, I review the case
   first.
   - If the old PC still works, Pebot gives a deactivation code when it's deactivated or
     uninstalled. The owner sends it to me as proof the old PC is off.
   - If the PC was lost, stolen or died, a short written statement from the owner is enough.
3. **"Lifetime support":**
   - "Lifetime" means for as long as I sell and maintain Pebot. If I ever stop, customers get
     12 months' notice and a final build that needs no activation.
   - Channels: Messenger and email. Remote screen-sharing by appointment. On-site visits are
     paid and quoted separately.
   - Hours: Mon–Sat, 9 AM–6 PM. Reply within 1 business day. Same-day help when the owner can't
     take orders.
   - Updates: bug and security fixes are free forever, and so are all 1.x feature updates. Big
     new versions get an optional discounted upgrade price.
   - Not covered: hardware, untested printers, recovering data from a failed drive, and the
     customer's network setup.
4. **No trial. Sales flow:**
   1. The customer pays.
   2. I send them the installer.
   3. They install it. Pebot shows only the agreement and then an activation screen with the
      Machine Code.
   4. They send me the Machine Code. I generate the license key and send it back.

   Nothing in the app works without a valid key: no trial mode, no grace period, and no
   time-based unlock that a bug or a changed clock could turn into free lifetime access. If no
   license is found, or it doesn't match this PC, Pebot fails closed and shows the activation
   screen.
5. **Refunds:**
   - 7-day refund if Pebot can't be made to work on the customer's setup.
   - Refunded keys are marked revoked in the seller key registry.
   - The agreement must not say "no refunds". Under the DTI rules, a defect gets fixed or refunded.

## Step 1: plan only, no code changes

Scan the whole repo (my-app/ and cafeos-tablet/). Then write one plan document and stop for my
approval. The plan must have:

1. An inventory of current features, each tagged keep / upgrade / missing for restaurants.
   **No feature gets removed.** Upgrades only.
2. The plan split into Spec Kit features (specs/015-…, 016-…), in priority order, with
   dependencies. Suggested order: licensing + agreement, restaurant generalization, UI/UX
   redesign, welcome page + Pebot mascot, celebration calendar, dead-code cleanup.
3. The constitution amendments this needs: scope changes from "cafés" to "restaurants and food
   businesses", a new licensing principle, and product naming (CaféOS vs Pebot).
4. Any remaining business questions not answered under "Business decisions already made". Ask
   them one at a time, with options and a recommendation, per the constitution.

## Workstreams

### A. Restaurant feature upgrades

Check the app against what a PH restaurant needs and propose the gaps:
- dine-in, take-out and delivery
- table map, merge/transfer tables
- kitchen tickets per station
- modifiers, combos
- split bill, service charge
- Senior Citizen / PWD 20% discount with VAT exemption (RA 9994 / RA 10754)
- void/refund with manager PIN
- shifts and cash drawer, X/Z-style end-of-day reports
- thermal receipt printing (58/80mm ESC/POS)
- recipe costing
- backup to USB

Replace café-only wording ("barista", "drinks") with neutral terms.

### B. UI/UX redesign

Keep the premium feel. It must not look AI-made. First browse https://skills.sh/ for frontend and
design skills, and cite which ones you used and what you took from each. Avoid these AI tells:
- purple/blue gradients
- glassmorphism everywhere
- emoji as icons
- gradient hero text
- identical rounded cards
- sparkle icons
- filler marketing copy

Build a real design system instead: type scale, restrained palette, spacing, states. It should
extend the existing token layer in globals.css.

POS needs come first:
- big touch targets for tablets
- few taps per order
- keyboard shortcuts for cashiers
- readable in bright kitchens
- WCAG AA contrast
- respects prefers-reduced-motion

### C. Welcome page + Pebot mascot

Redesign the welcome page around Pebot, an original robot character. Pebot:
- greets the owner on every open, by name and time of day ("Magandang umaga, …")
- can mention useful local facts, like yesterday's sales
- talks through speech bubbles plus offline voice (pre-recorded clips or OS speech; no cloud TTS)
- has a few short dances and jingles

Settings:
- mute voice and sound separately
- turn animations off
- control how often Pebot speaks

Pebot never appears or makes noise on order-taking, kitchen or customer screens, so it can't get
in the way during a rush. Jingles must be original or public domain. No copyrighted songs.

### D. Philippine celebrations calendar

Research PH holidays and celebrations and give Pebot a costume or behavior for each. Examples:
- New Year
- Chinese New Year
- Valentine's
- EDSA anniversary
- Holy Week
- Araw ng Kagitingan
- Labor Day
- Flores de Mayo
- Independence Day
- National Heroes Day
- Buwan ng Wika
- the "ber months" Christmas season from Sept 1
- Halloween
- Undas
- Bonifacio Day
- Simbang Gabi
- Christmas
- Rizal Day
- Eid'l Fitr / Eid'l Adha
- major fiestas (Sinulog, Ati-Atihan, Panagbenga, MassKara, Kadayawan)

Implementation rules:
- Calendar data lives locally in an editable data file, because proclamation dates change each year.
- Compute rule-based dates offline: Easter/Holy Week, last Monday of August.
- Use a lookup table for lunar and Islamic dates.

Respect the tone of each day:
- Good Friday, Undas and Ninoy Aquino Day get quiet, respectful treatment, with no dancing.
- Religious days get no parody.
- Don't dress Pebot in the Philippine flag (RA 8491). A small hand flag or the national colors is fine.

### E. Pebot license key (one PC, offline)

**Decided: manual offline activation.** No license server and no internet, at activation or ever.
The owner sends me the Machine Code (e.g. by Messenger) and I send back the key. Version the key
format so an optional online activation (with manual as fallback) can be added later without
breaking keys already issued. Don't build the online part now.

It works like this:
1. On first run the app shows a Machine Code built from stable hardware/OS identifiers.
2. I generate a signed activation key for that code with a seller-only tool. Use Ed25519. The
   private key is never shipped or committed.
3. The app checks the key with the embedded public key.
4. A key works on only that machine. The same key on another PC fails.

Requirements:
- **Survive reboots, Windows updates and app updates.** Only a real hardware change or a reformat
  may require re-activation.
- Enforce the check in the server process, not only in Electron (Principle V). Otherwise running
  the web app directly bypasses it.
- Reconcile or replace the existing /api/subscription and admin/settings/subscription with the
  lifetime model.
- Build a seller-only keygen tool. It is never shipped in the installer, and the private key is
  never committed. It needs these commands:
  - `init`: create the key pair once. The public key goes into the app; the private key is saved
    with backup instructions.
  - `issue`: takes a machine code and customer details. Prints the license key as copy-paste text
    and also writes a `.lic` file.
  - `deactivate-verify`: checks a deactivation code from a customer's old PC.
  - `list` / `revoke`: show and revoke entries in the registry.
- The registry is a local file: customer, contact, machine code, date, re-activation count,
  status.
- The app accepts the key both ways: pasted into the activation screen, or by importing the
  `.lic` file.
- Define a fair re-activation process for a reformatted or replaced PC.
- Be honest in the plan about what offline protection can and can't stop.

### F. License agreement shown in the installer

Write a plain-language EULA (English, plus a Filipino version) with a short summary at the top.
Show it as a click-through in the existing electron-builder NSIS installer. It must also be
viewable inside the app.

Cover:
- license grant: one PC, non-transferable except through the re-activation policy
- what "lifetime" and "support" mean exactly (channels, hours, response time, which updates)
- the customer owns their data, it stays local, and we can't access it
- **backups are the customer's responsibility.** The app provides backup tools.
- no liability for data loss from hardware failure, theft, lost laptop, reformat, virus or power
  outage
- liability capped at the price paid
- refund window
- Pebot is not BIR-accredited, its printouts are not official BIR invoices, and the owner handles
  their own BIR registration
- Data Privacy Act (RA 10173), with the customer as the data controller
- e-acceptance under the E-Commerce Act (RA 8792)
- Philippine governing law

It must be fair. No clause may try to waive liability for our own fraud or gross negligence.
Mark the document "draft — for review by a Philippine lawyer before sale."

### G. Clean up unused code

Find dead files, unused exports and unused dependencies (e.g. knip), in both my-app and
cafeos-tablet. Remove them only when lint, tsc, tests and the build prove they're unused. Never
remove a feature this way.

## Definition of done

Every spec meets the AGENTS.md checks (`pebot check`), all acceptance criteria have tests, and no
secrets are committed, especially the license private key.
