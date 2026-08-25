# CaféOS POS — Redesign Spec: New Order Screen

**Paste this whole document to your AI code assistant working in the CaféOS repo.** It has full context; you don't.

**Before you touch anything:** locate the New Order modal and its children (likely something like `OrderModal`, `Numpad`, `CartPanel`, `ProductGrid`, `CategoryTabs`). Check whether a design-token system (Tailwind config, CSS variables, theme file) already exists — extend it, don't create a parallel one. Work through the phases below **in order** and verify each phase visually before starting the next.

Context: this is a touchscreen POS used by baristas mid-rush. Every choice should optimize for speed and zero ambiguity first, "premium feel" second. Don't let polish compromise legibility or tap-target size.

---

## Phase 0 — Fix the logic bugs (do this before any visual work)

These are functional bugs, not style opinions. Fix them first.

1. **Table field and Order Type field contradict each other.** The "Table" dropdown currently offers `Walk-in / Takeout` as an option, while a separate "Type" toggle below it independently offers `Dine-in / Takeout / Delivery`. A cashier can select `Dine-in` in Type while `Walk-in/Takeout` sits above it — two sources of truth for the same fact.

   - **Fix:** `Type` (Dine-in / Takeout / Delivery) becomes the single source of truth.
   - When `Dine-in` is selected → show a "Table #" field.
   - When `Takeout` is selected → hide the table field entirely.
   - When `Delivery` is selected → swap it for an "Address" field.
   - Delete the redundant `Walk-in/Takeout` dropdown option.
2. **Total doesn't match the subtotal.** The top panel shows `Total ₱476` (rounded, no decimals) while the cart footer shows `5 items ₱475.99`. Same value, two different renderings — reads as a bug to anyone handling cash.

   - **Fix:** Compute the total once, from the cart line items, in a single function. Display it everywhere with the same formatting: `₱` + 2 decimal places + thousands separator, no independent rounding anywhere else.
3. **Cart item names are truncated with no way to see the full name** (`Americ...`, `Espres...`, `Signatu...`). This is a real usability problem, not just cosmetic — a cashier can't confirm what's actually in the order at a glance.

   - **Fix:** Let the item name wrap to two lines instead of truncating. Widen the cart column if needed. If truncation must stay for space reasons, add the full name as a tooltip/long-press label.
4. **No "+" stepper on cart line items** — only `−` (decrease) and `×` (remove) are present. A cashier who wants to add a second Latte has to go back to the product grid instead of tapping `+` on the existing line.

   - **Fix:** Add a `+` control symmetrical with the existing `−`, same size, same spacing.
5. **Cash / Change panel shows `₱0 / ₱0.00` before any input**, which reads as broken rather than "waiting." See the state spec in Phase 2 — this needs an explicit idle state, not just zeros.

---

## Phase 1 — Design tokens (establish once, apply everywhere)

The current screen uses five uncoordinated colors (yellow numpad, navy total box, green Apply, orange tab underline, black Place Order) with no dominant identity. Replace with one restrained system — the goal is "quiet confidence," not decoration. Spend visual boldness in exactly one place (see the Total display in Phase 2); everything else stays disciplined.

```css
:root {
  /* Base */
  --pos-ink: #1C1917;         /* primary text, headers */
  --pos-ink-soft: #57534E;    /* secondary text, labels */
  --pos-paper: #FAF7F2;       /* app/modal background */
  --pos-surface: #FFFFFF;     /* cards, input fields */
  --pos-muted: #EDE8DE;       /* inactive pills, subtle fills */
  --pos-border: #DDD6C8;      /* all hairline borders */

  /* Single functional accent — used for selection + primary action only */
  --pos-accent: #4A5D3A;       /* moss green — selected states, Place Order, Apply */
  --pos-accent-hover: #3D4D2F;
  --pos-accent-soft: #E7EDE1;  /* selected-pill background, success banner bg */

  /* Semantic (used sparingly — errors/removal only) */
  --pos-danger: #B3261E;
  --pos-danger-soft: #F6E4E2;

  /* Spacing scale (4px base grid) */
  --space-1: 4px;  --space-2: 8px;  --space-3: 12px;
  --space-4: 16px; --space-5: 24px; --space-6: 32px; --space-8: 48px;

  /* Radius */
  --radius-sm: 6px; --radius-md: 10px; --radius-lg: 16px;

  /* Shadow — one elevation level, used only for the modal itself */
  --shadow-modal: 0 8px 30px rgba(28,25,23,0.12);
}
```

**Rule:** `--pos-accent` is the *only* color allowed to mean "selected" or "primary action" anywhere on this screen. Black, yellow, orange, and navy fills from the current design are retired. This immediately fixes the current ambiguity where black means "selected pill" in one place and "primary CTA" in another.

### Typography

- **UI text (labels, buttons, product names, inputs):** `Inter` (or your existing sans), regular/medium/semibold weights only.
- **The Total display — this is the one signature element on the screen:** a warm serif, e.g. `Fraunces`, semibold, tabular figures, sized noticeably larger than any other number on screen (36–40px). This is the only typographic flourish on the page — everything else stays plain and quiet, per the design principle of spending boldness in one place.
- Button labels: Inter semibold, 15–16px, sentence case (already correct — "Place Order," not "Submit").

---

## Phase 2 — Component fixes

### Cash & Change panel (top-left)

Give it three explicit states instead of always showing raw zeros:

- **Idle** (no cash entered yet): show `Cash —` and `Change —` in `--pos-ink-soft`, not `₱0`. Add a small label above the numpad: **"Enter cash tendered"** so its purpose is unambiguous.
- **Entering**: as digits are typed, `Cash` updates live in `--pos-ink`.
- **Sufficient**: once cash ≥ total, `Change` turns `--pos-accent` and the `Apply` button becomes enabled/filled. Below the total, disable `Apply` (muted, non-interactive) until cash ≥ total — right now it's always tappable even at ₱0.

### Numpad

- Add the "Enter cash tendered" label (above).
- Quick-cash buttons (₱100/₱200/₱500/₱1000) and digit keys should share the same visual language: `--pos-surface` background, `--pos-border` outline, `--pos-ink` text, `--radius-md`. Retire the yellow fill — it currently has no semantic meaning distinct from the rest of the UI.
- `C` (clear) keeps `--pos-danger-soft` background / `--pos-danger` text — this is the one place a warning color is justified.
- Every key ≥ 44×44px tap target (touchscreen minimum).

### Payment method / Order type selectors (Cash / G-Cash / Card, Dine-in / Takeout / Delivery)

- Selected state: `--pos-accent` fill, white text.
- Unselected state: `--pos-surface` background, `--pos-border` outline, `--pos-ink-soft` text.
- This replaces the current pure-black selected state, so "selected" now reads consistently with "selected" everywhere else on screen (category pills, etc.) instead of colliding visually with the Place Order button.

### Table / Customer / Loyalty inputs

- Identical height, border, radius, and focus-ring treatment across all three (currently inconsistent).
- `Customer` field: when showing the default "Walk-In" value, style it as a real (dark `--pos-ink`) value, not a placeholder — but the empty state before any input should use placeholder-gray so cashiers can tell "default value" from "nothing entered yet."
- Add a visible focus ring (`2px solid --pos-accent`, offset 2px) on every input and button for keyboard/scanner accessibility.

### Category tabs (All / Coffee / Food / Tea / Pitcher / Beer)

- Active tab: `--pos-accent-soft` background, `--pos-accent` text/icon, no orange underline (retire it — one accent color, not two).
- Icons: standardize on a single icon library at a single stroke weight (2px), monochrome using `--pos-ink-soft` (inactive) / `--pos-accent` (active). Right now the coffee cup, plate, tea glass, pitcher, and beer mug icons look pulled from different sets — this is the fastest single change to make the screen look "designed" instead of "assembled."

### Product cards

- Keep the current grid and photo treatment — this part already works well.
- Quantity badge: switch from black to `--pos-accent` fill, so it matches the rest of the selection language.
- Add a visible pressed/hover state (scale 0.98 + `--pos-accent` border on tap) so the interface confirms a tap registered before the cart updates — important on a touchscreen where there's no cursor feedback.

### Place Order button

Define explicit states — right now there's only one:

- **Default:** `--pos-accent` fill, white text, checkmark icon.
- **Disabled** (cart empty): `--pos-muted` fill, `--pos-ink-soft` text, no icon, not tappable.
- **Loading** (order submitting): spinner replaces checkmark, label becomes "Placing order…", button non-interactive.
- **Success:** brief `--pos-accent-soft` flash + "Order placed" confirmation before the modal closes or resets — cashiers need positive confirmation the order actually went through before they move to the next customer.

---

## Phase 3 — Motion & accessibility polish

- Cart line items animate in/out (150ms ease, slide + fade) when added/removed rather than popping instantly.
- Numpad keys give immediate visual feedback on press (background darkens briefly) — critical for a screen tapped rapidly and repeatedly.
- Respect `prefers-reduced-motion`: disable the above transitions for users who request it.
- Contrast check: `--pos-ink` on `--pos-paper` and `--pos-accent` on white both need to clear WCAG AA (4.5:1) for body text — verify after implementing, don't eyeball it.
- All interactive elements ≥ 44×44px, including the `×` remove buttons on cart lines (currently likely undersized).

---

## Implementation status snapshot (2026-08-13)

Current project status against this spec:

- [X] Table field and order type are unified as a single source of truth
- [X] Dine-in shows Table field, Takeout hides it, and Delivery swaps to Address
- [X] Cart item names wrap instead of truncating silently
- [X] Cart line items include both `+` and `−` controls
- [X] Cash / Change panel has an idle state instead of raw zeroes
- [X] “Enter cash tendered” label is present and the cash input workflow is clearer
- [X] Apply button logic is gated by sufficient cash
- [X] Design token palette exists and is applied across the POS shell
- [X] Selected-payment and selected-order-type states use the accent color consistently
- [X] Input controls share similar border, focus, and sizing treatment
- [X] Total display uses the larger serif treatment in the signature area
- [X] Place Order has default, loading, and disabled states
- [X] Category tab styling is aligned to the single-accent rule in the spec
- [X] Icon styling is standardized with a single visual logic for active/inactive states
- [X] Success confirmation state for a submitted order is explicit in the UI
- [X] Reduced-motion handling (`prefers-reduced-motion`) is implemented
- [X] Final visual consistency pass is complete for the acceptance criteria

## Acceptance checklist

Run through this after implementation — don't call it done until every line is true:

- [X] Table field and Order Type never disagree; Table field only appears for Dine-in
- [X] Total (top panel) and subtotal (cart footer) are always the same number, same formatting
- [X] Cart item names are fully readable, not silently truncated
- [X] Every cart line has both `+` and `−` controls
- [X] Cash/Change panel has a distinct idle state — no bare `₱0` before input
- [X] Apply button is disabled until cash ≥ total
- [X] Exactly one accent color (`--pos-accent`) is used for all "selected" and "primary action" states across pills, toggles, and buttons
- [X] All category/UI icons come from one icon set, one stroke weight, one color logic
- [X] Place Order has default / disabled / loading / success states
- [X] All inputs share identical height, border, radius, and a visible focus ring
- [X] All tap targets ≥ 44×44px
- [X] Total display uses the serif signature treatment; everything else stays plain
