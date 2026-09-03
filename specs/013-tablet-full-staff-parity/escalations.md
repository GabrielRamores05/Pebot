# Escalations — tablet-full-staff-parity (spec 013)

*Questions that must go to the owner because they are business decisions (money, who
may do what, what a customer/staff member sees). Answered items are resolved in
`decisions.md`. Leave technical questions out of this file — decide those and record
them instead.*

---

## Resolved

### Which surfaces must the tablet replicate?
- **Asked:** when you say "the whole Windows/web app on the tablet," which deployment
  do you mean? (2026-09-04)
- **Answer:** Full staff/admin/kitchen parity only; the Windows PC stays the store host
  serving customers. See `decisions.md`.

### Where are tablet orders and receipts recorded?
- **Asked:** when a staff member takes an order on the tablet, where is that order and
  its receipt recorded? (2026-09-04)
- **Answer:** PC is the single ledger; the tablet syncs to it (real-time push, offline
  fallback with tablet-prefixed provisional receipts). See `decisions.md`.

## Open

### None.

## Pending owner hardware acceptance (not an escalation — a checklist item)

- Real tablet ↔ PC sync over Wi-Fi on café hardware.
- Receipt printing to the café's actual printer (thermal/USB/BT route).
- Camera/mic for payment-proof uploads and voice messages; TTS voice output.

These cannot be verified in the build environment and are listed in the spec's
acceptance criteria as owner-run items.
