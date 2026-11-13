# Feature Specification: Pebot License Activation

**Feature Branch**: `015-license-activation`

**Created**: 2026-11-14

**Status**: Draft

**Input**: User description: "Pebot commercial license activation (one location, offline). Pebot is being sold to Philippine restaurants for ₱4,999 one-time with lifetime use and support. Customer pays → seller sends installer → agreement → Machine Code → seller issues key with a seller-only tool → customer pastes key or imports .lic → Pebot unlocks on that PC only. No trial, fail closed. Survives reboots and updates. One license = one location with unlimited LAN devices. Re-activation free up to 3/year with deactivation code. Revocation via update. Keygen: init, issue, deactivate-verify, list, revoke. Old subscription tiers replaced. Fair Philippine-law license agreement, English + Filipino, draft for lawyer review." (full text in conversation record, summarized in the requirements below)

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Owner activates a newly installed Pebot (Priority: P1)

A restaurant owner has paid and received the installer. They install Pebot, read and accept the license agreement, and see an activation screen showing this PC's Machine Code. They send the code to the seller by Messenger, receive a license key, paste it in (or import the license file), and Pebot opens normally with every feature available.

**Why this priority**: Without it nothing can be sold. It is the whole purchase-to-use path.

**Independent Test**: On a fresh install, confirm that only the agreement and activation screen are reachable, enter a key issued for that PC's Machine Code, and confirm the full app is available.

**Acceptance Scenarios**:

1. **Given** a fresh install with no license, **When** the owner opens Pebot, **Then** they see the license agreement first, and after accepting, the activation screen with a Machine Code in the form `PBT-XXXX-XXXX-XXXX` and a button to copy it.
2. **Given** the activation screen, **When** the owner pastes a key issued for this PC's Machine Code, **Then** Pebot confirms activation and opens the normal app.
3. **Given** the activation screen, **When** the owner imports a license file issued for this PC, **Then** the result is the same as pasting the key.
4. **Given** an activated install, **When** the PC is restarted, Windows updates, or Pebot is updated to a newer version, **Then** Pebot opens without asking for a key again.
5. **Given** an activated install, **When** an admin opens Settings → License, **Then** they see that the license is active, its license number, the activation date, and the Machine Code.

---

### User Story 2 - A key cannot unlock Pebot anywhere else, and nothing works without one (Priority: P1)

A key shared with another restaurant, copied to another PC, or invented by someone does not unlock Pebot. Without a valid key for this PC, no part of Pebot that runs the business works: staff screens, kitchen, customer QR ordering, API and live updates.

**Why this priority**: This is what protects the seller's revenue. The seller explicitly rejected any trial or grace period because a defect could turn it into free lifetime use.

**Independent Test**: Use a key issued for a different Machine Code, a key with one character changed, and a made-up key, and confirm all are rejected. Then confirm that every business screen, API call and realtime connection is refused while unlicensed.

**Acceptance Scenarios**:

1. **Given** a key issued for a different Machine Code, **When** it is entered, **Then** Pebot rejects it with "This key belongs to a different computer. Send your Machine Code to Pebot support to get the right key."
2. **Given** a key with any character altered, **When** it is entered, **Then** Pebot rejects it as invalid.
3. **Given** an unlicensed install, **When** any device on the LAN requests a business screen, **Then** it is shown the activation screen instead, and business API requests and realtime connections are refused.
4. **Given** an activated install whose Windows is reinstalled, or whose drive is moved to another PC, **When** Pebot starts, **Then** it treats itself as unlicensed and shows the activation screen with the new Machine Code. Restaurant data is untouched.
5. **Given** a license file that was edited by hand, **When** Pebot starts, **Then** it treats itself as unlicensed.
6. **Given** any change to the PC's date or time, **When** Pebot starts, **Then** licensing behaves exactly the same, because nothing about the license depends on dates.

---

### User Story 3 - Seller issues and tracks license keys (Priority: P1)

The seller runs a private tool on their own computer. Once, they create their signing keys and are told how to back them up. For each sale they enter the customer's Machine Code, name and contact, and get a key as copy-paste text plus a license file. Every sale is recorded in a local registry they can list.

**Why this priority**: Owners cannot activate unless the seller can issue keys.

**Independent Test**: Run the tool's setup, issue a key for a Machine Code from a test install, activate that install with it, and list the registry entry.

**Acceptance Scenarios**:

1. **Given** no signing keys yet, **When** the seller runs setup, **Then** the tool creates them, shows where the private key is stored, warns that it must be backed up and never shared, and refuses to overwrite existing keys.
2. **Given** a mistyped Machine Code, **When** the seller tries to issue a key, **Then** the tool refuses and says the code is wrong. It does not issue a key that would never work.
3. **Given** a valid Machine Code, customer name and contact, **When** the seller issues a key, **Then** they get key text to paste into Messenger and a license file, and the sale is added to the registry.
4. **Given** issued licenses, **When** the seller lists the registry, **Then** each entry shows license number, customer, contact, Machine Code, issue date, re-activations used this year, and status.
5. **Given** the installer that customers receive, **When** its contents are inspected, **Then** it contains neither the seller tool nor the private key.

---

### User Story 4 - Owner reads and accepts a fair license agreement (Priority: P2)

Before installing, the owner sees the Pebot license agreement in plain language with a short summary at the top, and must accept it to continue. They can read it again anytime inside Pebot, in English or Filipino.

**Why this priority**: The seller needs clear terms on liability, support and refunds before selling. It doesn't block a technical demo, so it ranks below activation.

**Independent Test**: Run the installer and confirm it can't proceed without acceptance. In Pebot, open the agreement and switch between English and Filipino.

**Acceptance Scenarios**:

1. **Given** the installer, **When** it reaches the agreement step, **Then** the owner must accept to continue. Declining exits the installer.
2. **Given** a fresh install, **When** Pebot first opens, **Then** the owner accepts the agreement in-app before the activation screen. The acceptance is recorded with the agreement version and time.
3. **Given** an activated install, **When** anyone opens the agreement from Settings → License or from the activation screen, **Then** they can read the full text and switch language.
4. **Given** the agreement text, **When** it is reviewed, **Then** it covers:
   - grant and scope
   - lifetime meaning
   - support
   - updates
   - re-activation
   - refunds
   - data ownership and backups
   - liability limits
   - BIR disclosure
   - data privacy
   - electronic acceptance
   - governing law

   It is marked as a draft pending review by a Philippine lawyer.

---

### User Story 5 - Owner moves Pebot to a new PC (Priority: P2)

The owner is replacing their PC, or reformatted it. If the old PC still works, they open Settings → License → Move to a new computer. Pebot gives them a deactivation code and locks itself on that PC. They send the code and the new PC's Machine Code to the seller, who verifies it and issues a key for the new PC. This counts toward the 3 free re-activations a year.

**Why this priority**: Owners will reformat and replace PCs, and the seller promised fair re-activation. It isn't needed for the first sales.

**Independent Test**: Deactivate an activated install, verify the code with the seller tool, issue a key for a second Machine Code under the same license number, and confirm the re-activation count went up.

**Acceptance Scenarios**:

1. **Given** an activated install, **When** an admin chooses to move to a new computer and confirms, **Then** Pebot shows a deactivation code, removes the license from this PC, and returns to the activation screen. Restaurant data is not touched.
2. **Given** a deactivation code, **When** the seller verifies it against the registry, **Then** the tool confirms whether it came from that license.
3. **Given** a license with fewer than 3 re-activations in the last 12 months, **When** the seller re-issues it for a new Machine Code, **Then** a key is issued under the same license number and the count increases.
4. **Given** a license that already has 3 re-activations in the last 12 months, **When** the seller re-issues it, **Then** the tool warns that the free limit is reached and requires an explicit override to proceed.
5. **Given** an old PC that was lost or died, **When** the seller re-issues without a deactivation code, **Then** the tool requires a note recording why (e.g. "stolen, owner statement via Messenger 2026-11-20").

---

### User Story 6 - Seller revokes a refunded license (Priority: P3)

A customer is refunded within 7 days. The seller marks the license as revoked. Pebot builds released after that refuse that license, so it stops working when the customer installs an update.

**Why this priority**: Refunds should be rare. Revocation can't reach an install that is never updated, so it's a weaker control than the others.

**Independent Test**: Revoke a license in the registry, add it to the app's revocation list, and confirm an install with that key becomes unlicensed.

**Acceptance Scenarios**:

1. **Given** an issued license, **When** the seller revokes it, **Then** the registry marks it revoked with a reason and date, and the tool prints the license number to add to the next release.
2. **Given** a Pebot build whose revocation list contains a license number, **When** an install with that license starts, **Then** it is treated as unlicensed and the activation screen explains that the license was revoked.

### Edge Cases

- **Keys with extra characters.** Spaces, line breaks, or leftover text around a key pasted from Messenger are tolerated. Surrounding whitespace and line breaks are ignored.
- **Unreadable Machine Code.** If the PC's identity can't be read, for example because the OS blocks access, Pebot shows a plain error saying what to do. It never falls back to a weak or random code that changes on every restart.
- **Damaged license file.** If the stored license is corrupted or partly written, Pebot treats itself as unlicensed and asks for the key again. The key can be pasted again since the seller has it.
- **LAN devices while unlicensed.** Customer phones get a simple "This restaurant's system is being set up" page, not the owner's activation screen.
- **Activating from another device.** Activation is accepted only from the main PC itself, so a device on the Wi-Fi can't see or submit activation for the owner.
- **Existing installs with data.** An install that already has restaurant data but no license, such as the developer's current pilot, keeps all its data. It must be activated before use.
- **Wrong key type.** A key for a future major version is rejected with a message telling the owner to install that version.

## Requirements *(mandatory)*

### Functional Requirements

**Activation and enforcement**

- **FR-001**: The system MUST derive a Machine Code from identifiers of the PC that stay the same across restarts, Windows updates and Pebot updates. The code MUST change when Windows is reinstalled or the drive is moved to different hardware.
- **FR-002**: The Machine Code MUST be shown as `PBT-` plus 12 characters in three groups, using only characters that are hard to confuse (no `I`, `L`, `O` or `U`). It MUST include a check character so the seller tool catches typos.
- **FR-003**: The system MUST accept a license key only if it carries a valid signature from the seller's private key and names this PC's Machine Code. Anything else is rejected with a specific reason: wrong computer, invalid, revoked, or wrong version.
- **FR-004**: The system MUST NOT contain any way to create a valid key. Only the seller's private key can do that.
- **FR-005**: Until a valid license is present, the system MUST refuse every business page, business API request and realtime connection. Only these remain available: the agreement, the activation screen, the activation endpoints, static assets, and a plain "being set up" page for customer devices.
- **FR-006**: Licensing MUST NOT depend on the date or time. There is no trial, grace period or expiry.
- **FR-007**: Activation, deactivation and the Machine Code MUST be available only from the main PC itself, not from other devices on the LAN.
- **FR-008**: The license MUST be stored with the restaurant's data. It is checked again from scratch on every start, so an edited or copied license file never unlocks Pebot.
- **FR-009**: Enforcement MUST live in the local server that every screen and device goes through. It cannot live only in the desktop window.
- **FR-010**: Activation and deactivation MUST be written to the audit log.

**Seller tool**

- **FR-011**: The seller tool MUST run only on the seller's computer. It MUST NOT be included in the installer, and the private key MUST NOT be stored in the project repository.
- **FR-012**: The tool MUST provide these commands:
  - setup (create the keys once, refusing to overwrite)
  - issue
  - re-issue for a new PC
  - verify a deactivation code
  - list
  - revoke
- **FR-013**: Issue MUST validate the Machine Code checksum and produce both copy-paste text and a license file.
- **FR-014**: The registry MUST record license number, customer name, contact, Machine Code history, issue date, re-activation dates, status, and notes.
- **FR-015**: Re-issue MUST count re-activations in the last 12 months, warn at the free limit of 3, and require an override to go past it.
- **FR-016**: Re-issue without a deactivation code MUST require a written reason in the registry.

**Deactivation and revocation**

- **FR-017**: An admin MUST be able to deactivate the license on the current PC after confirming. This produces a deactivation code the seller tool can match to that license, and deletes no restaurant data.
- **FR-018**: Each release MUST carry a list of revoked license numbers. A license on that list is treated as unlicensed, with an explanation.

**Feature access**

- **FR-019**: A licensed install MUST have every feature. Subscription tiers no longer gate any feature for any role.

**License agreement**

- **FR-020**: The installer MUST show the license agreement and require acceptance before installing.
- **FR-021**: Pebot MUST require in-app acceptance of the current agreement version before activation, record the version and time, and let anyone open the agreement later from the activation screen or Settings → License.
- **FR-022**: The agreement MUST exist in English and Filipino, with a plain-language summary at the top. It MUST state:
  - **License grant:** one location; unlimited devices on that location's network; a second branch needs another license.
  - **"Lifetime":** as long as Pebot is sold and maintained. If discontinued, 12 months' notice and a final build that needs no activation.
  - **Support:** Messenger and email, Monday–Saturday 9 AM–6 PM Philippine time, reply within 1 business day, same-day when the restaurant cannot take orders, remote sessions by appointment, on-site visits paid.
  - **Updates:** fixes and all 1.x updates free; major versions at an optional discount.
  - **Re-activation:** free up to 3 times a year, with a deactivation code or the owner's statement.
  - **Refund:** within 7 days if Pebot cannot be made to work on their setup; defects are fixed or refunded; no "no refunds" wording.
  - **Data:** the customer owns their data, which stays on their PC; the seller cannot access it; backups are the customer's responsibility, and Pebot provides backup tools.
  - **Excluded losses:** no liability for data loss from hardware failure, theft, loss, reformatting, viruses or power outages.
  - **Liability cap:** total liability capped at the price paid, but never excluding liability that the law doesn't allow to be waived, such as fraud or gross negligence.
  - **BIR:** Pebot is not BIR-accredited, its printouts are not official BIR invoices, and the owner is responsible for their own BIR obligations.
  - **Data privacy:** the owner is the personal information controller under the Data Privacy Act.
  - **Acceptance:** electronic acceptance under the E-Commerce Act.
  - **Law:** Philippine law governs.
- **FR-023**: The agreement MUST carry a version and a visible "Draft — pending review by a Philippine lawyer" notice until the seller removes it.

### Key Entities

- **Machine Code**: the short identity of one PC, shown to the owner and sent to the seller.
- **License**: a signed grant. It has a license number, the Machine Code it is bound to, the product major version, and the issue date. One license can be re-issued to new Machine Codes over time.
- **Activation record**: the license stored on the PC with the restaurant's data, plus the accepted agreement version and time.
- **Deactivation code**: proof, given by an install as it gives up its license, that the seller tool can match to the license.
- **Registry entry**: the seller's private record of a sale, with customer, contact, Machine Code history, re-activations, status and notes.
- **Revocation list**: the license numbers that a given Pebot release refuses.
- **License agreement**: versioned text in English and Filipino.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: An owner can go from finished install to working Pebot, excluding the wait for the seller's reply, in under 3 minutes.
- **SC-002**: The seller can issue a key for a new sale in under 1 minute.
- **SC-003**: 100% of attempts to use a key on the wrong PC, an altered key, or an edited license file are rejected in testing.
- **SC-004**: 0 business screens, API requests or realtime connections succeed on an unlicensed install, checked across every route in the app.
- **SC-005**: An activated install keeps working across at least 20 restarts, a Windows update and a Pebot update without asking for the key again.
- **SC-006**: Neither the installer nor the repository contains the private key or the seller tool's issuing capability.
- **SC-007**: No restaurant data is lost or altered by activation, deactivation, a failed activation, or revocation.

## Assumptions

- Licensing is fully offline and manual, as the owner decided on 2026-11-14. There is no license server, and online activation may be added in a later version.
- Windows is the only supported production OS for the main PC. Development machines on other OSes get a working Machine Code so the code can be built and tested there.
- Anyone with technical skill and the app files can bypass any offline protection. The goal is to make paying easier than cheating, not to be uncrackable. Keeping the private key secret is the essential control.
- The deactivation code proves the owner's honesty, not their identity, because the app holds no secret. The yearly re-activation limit is the real control against key-sharing.
- Revocation only takes effect on installs that update. This is accepted.
- The product name shown to customers is "Pebot". Renaming the remaining CaféOS branding throughout the app is part of the later restaurant generalization work, not this feature.
- The developer's own installs need a license like any customer's. The seller tool can issue them.
- Removing the subscription tiers' feature gating is not removing a feature: every feature becomes available. The old subscription settings page is replaced by Settings → License.
- This feature requires a constitution amendment: the scope widens from cafés to restaurants, and a licensing principle is added.
