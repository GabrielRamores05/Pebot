# CafeOS Design System

## Design Tokens

The POS terminal uses a restrained color system — "quiet confidence, not
decoration." Spend visual boldness in exactly one place (the Total display);
everything else stays disciplined.

```css
:root {
  /* Base */
  --pos-ink: #1C1917;           /* primary text, headers */
  --pos-ink-soft: #57534E;      /* secondary text, labels */
  --pos-paper: #FAF7F2;         /* app/modal background */
  --pos-surface: #FFFFFF;       /* cards, input fields */
  --pos-muted: #EDE8DE;         /* inactive pills, subtle fills */
  --pos-border: #DDD6C8;        /* decorative hairlines only — dividers, card edges */
  --pos-border-strong: #998A69; /* interactive outlines — buttons, keys, inputs (3.2:1 on paper, meets WCAG 1.4.11) */

  /* Single functional accent — selection + primary action only */
  --pos-accent: #4A5D3A;         /* moss green — selected states, Place Order, Apply */
  --pos-accent-hover: #3D4D2F;
  --pos-accent-active: #33402A;  /* pressed/touch-down — this is a touchscreen terminal, :hover won't reliably fire */
  --pos-accent-soft: #E7EDE1;    /* selected-pill background, success banner bg */

  /* Semantic — true destructive actions only, not routine corrections */
  --pos-danger: #B3261E;
  --pos-danger-soft: #F6E4E2;

  /* Processing — covers payment/network latency, distinct from success/danger */
  --pos-processing: #8A8578;     /* neutral, not accent — see Place Order rule below */

  /* Spacing scale (4px base grid) */
  --space-1: 4px;  --space-2: 8px;  --space-3: 12px;
  --space-4: 16px; --space-5: 24px; --space-6: 32px; --space-8: 48px;

  /* Radius */
  --radius-sm: 6px; --radius-md: 10px; --radius-lg: 16px;

  /* Shadow — one elevation level, modal only */
  --shadow-modal: 0 8px 30px rgba(28,25,23,0.12);
}
```

**Rule:** `--pos-accent` is the *only* color allowed to mean "selected" or
"primary action" anywhere on the POS screen. Black, yellow, orange, and navy
fills are retired.

## Typography

- **UI text (labels, buttons, product names, inputs):** Inter (or existing
  sans), regular/medium/semibold weights only.
- **Total display — the one signature element:** warm serif (e.g. Fraunces),
  semibold, tabular figures, 36-40px. Only typographic flourish on the page.
- **Button labels:** Inter semibold, 15-16px, sentence case ("Place Order").

## Component Rules

- Quick-cash buttons and digit keys: `--pos-surface` background, `--pos-border`
  outline, `--pos-ink` text, `--radius-md`.
- Clear button (C): `--pos-danger-soft` background, `--pos-danger` text.
- Tab active state: `--pos-accent-soft` background, `--pos-accent` text/icon.
- Quantity badge: `--pos-accent` fill, white text.
- Place Order button: `--pos-accent` fill, white text, checkmark icon.
- Disabled state: `--pos-muted` fill, `--pos-ink-soft` text, not tappable.
- Focus ring: `2px solid --pos-accent`, offset 2px, on all inputs and buttons.
- Contrast: `--pos-ink` on `--pos-paper` and `--pos-accent` on white must clear
  WCAG AA (4.5:1).

## Source

Extracted from `docs/archive/cafeos-pos-10-10-spec.md` (Phase 1, completed
2026-08-16). That spec is archived as a completed work order; this document
is the live reference for design tokens.
