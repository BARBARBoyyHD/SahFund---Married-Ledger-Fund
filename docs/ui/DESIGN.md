---
version: alpha
name: SahFund
description: Modern financial clarity with a subtle romantic identity.
colors:
  primary: "#1D4ED8"
  primary-hover: "#1E40AF"
  primary-on-dark: "#93C5FD"
  secondary: "#F43F5E"
  secondary-soft: "#FB7185"
  tertiary: "#0B0F14"
  neutral: "#F8FAFC"
  surface: "#FFFFFF"
  border: "#E2E8F0"
  muted: "#475569"
  muted-soft: "#64748B"
  on-primary: "#FFFFFF"
  on-secondary: "#0B0F14"
  danger: "#B91C1C"
typography:
  display:
    fontFamily: Plus Jakarta Sans
    fontSize: 56px
    fontWeight: 800
    lineHeight: 1.05
    letterSpacing: "-0.03em"
  h1:
    fontFamily: Plus Jakarta Sans
    fontSize: 40px
    fontWeight: 800
    lineHeight: 1.1
    letterSpacing: "-0.03em"
  h2:
    fontFamily: Plus Jakarta Sans
    fontSize: 28px
    fontWeight: 700
    lineHeight: 1.2
    letterSpacing: "-0.02em"
  h3:
    fontFamily: Plus Jakarta Sans
    fontSize: 20px
    fontWeight: 700
    lineHeight: 1.3
    letterSpacing: "-0.015em"
  body-lg:
    fontFamily: Plus Jakarta Sans
    fontSize: 18px
    fontWeight: 400
    lineHeight: 1.6
    letterSpacing: "0em"
  body-md:
    fontFamily: Plus Jakarta Sans
    fontSize: 16px
    fontWeight: 400
    lineHeight: 1.6
    letterSpacing: "0em"
  body-sm:
    fontFamily: Plus Jakarta Sans
    fontSize: 14px
    fontWeight: 400
    lineHeight: 1.5
    letterSpacing: "0em"
  label:
    fontFamily: Plus Jakarta Sans
    fontSize: 12px
    fontWeight: 700
    lineHeight: 1.2
    letterSpacing: "0.08em"
  numeric:
    fontFamily: Plus Jakarta Sans
    fontSize: 16px
    fontWeight: 700
    lineHeight: 1.4
    letterSpacing: "-0.01em"
    fontFeature: "tnum"
  numeric-lg:
    fontFamily: Plus Jakarta Sans
    fontSize: 32px
    fontWeight: 800
    lineHeight: 1.1
    letterSpacing: "-0.02em"
    fontFeature: "tnum"
rounded:
  xs: 6px
  sm: 8px
  md: 12px
  lg: 16px
  xl: 24px
  full: 999px
spacing:
  xs: 4px
  sm: 8px
  md: 16px
  lg: 24px
  xl: 32px
  2xl: 48px
  3xl: 64px
  4xl: 96px
components:
  button-primary:
    backgroundColor: "{colors.primary}"
    textColor: "{colors.on-primary}"
    rounded: "{rounded.sm}"
    padding: 12px
  button-primary-hover:
    backgroundColor: "{colors.primary-hover}"
    textColor: "{colors.on-primary}"
    rounded: "{rounded.sm}"
    padding: 12px
  button-secondary:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.tertiary}"
    rounded: "{rounded.sm}"
    padding: 12px
  button-ghost:
    backgroundColor: "{colors.neutral}"
    textColor: "{colors.muted}"
    rounded: "{rounded.sm}"
    padding: 12px
  input:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.tertiary}"
    rounded: "{rounded.sm}"
    padding: 12px
    height: 44px
  card:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.tertiary}"
    rounded: "{rounded.lg}"
    padding: 24px
  card-dark:
    backgroundColor: "{colors.tertiary}"
    textColor: "{colors.neutral}"
    rounded: "{rounded.lg}"
    padding: 24px
  badge-cobalt:
    backgroundColor: "{colors.primary}"
    textColor: "{colors.on-primary}"
    rounded: "{rounded.full}"
    padding: 6px
  badge-rose:
    backgroundColor: "{colors.secondary}"
    textColor: "{colors.on-secondary}"
    rounded: "{rounded.full}"
    padding: 6px
  chip-member-rose:
    backgroundColor: "{colors.secondary-soft}"
    textColor: "{colors.tertiary}"
    rounded: "{rounded.full}"
    padding: 6px
  chip-member-cobalt:
    backgroundColor: "{colors.primary}"
    textColor: "{colors.on-primary}"
    rounded: "{rounded.full}"
    padding: 6px
  progress-track:
    backgroundColor: "{colors.border}"
    rounded: "{rounded.full}"
    height: 8px
  progress-fill:
    backgroundColor: "{colors.primary}"
    rounded: "{rounded.full}"
    height: 8px
  nav-item-active:
    backgroundColor: "{colors.neutral}"
    textColor: "{colors.primary}"
    rounded: "{rounded.sm}"
    padding: 8px
  table-header:
    backgroundColor: "{colors.neutral}"
    textColor: "{colors.muted}"
    height: 40px
  caption:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.muted-soft}"
    typography: "{typography.body-sm}"
  alert-danger:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.danger}"
    rounded: "{rounded.sm}"
    padding: 12px
  link-on-dark:
    backgroundColor: "{colors.tertiary}"
    textColor: "{colors.primary-on-dark}"
    padding: 0px
---

## Overview

SahFund is a shared wedding-fund ledger: two people, one pot of money, one date that does not move. The design has to do two jobs at once — prove the numbers (trust) and feel like a wedding (warmth) — without becoming either a bank dashboard or a pink invitation site.

**Philosophy: modern financial clarity with a subtle romantic identity.**

Three rules hold the whole system together:

1. **Blue carries the money. Rose carries the moment.** Cobalt is the language of value, progress, and action. Rose is the language of the two people and the day itself. A screen where rose does financial work is a bug.
2. **Obsidian keeps it mature.** Obsidian `#0B0F14` in type, structure, and dark bands is the difference between "fintech product with a wedding skin" and an actual product. It is the brand's backbone, not a background.
3. **Blue dominates; rose is remembered.** Target ratio per screen: **60–70% neutral/white, 20–25% cobalt, 5–10% rose.** Rose earns its impact by scarcity. If a page looks pink, it is wrong.

The failure mode to design against is explicit: **blue fintech plus pink wedding website**. Rose is not a theme — it is a signal that something personal happened.

## Colors

| Token | Hex | Role |
|---|---|---|
| `primary` | `#1D4ED8` | Cobalt. Primary actions, active nav, progress, financial states, member B |
| `primary-hover` | `#1E40AF` | Pressed/hover fill for cobalt actions |
| `primary-on-dark` | `#93C5FD` | Cobalt-family text and icons on obsidian (raw cobalt fails there) |
| `secondary` | `#F43F5E` | Rose. Couple attribution, milestones, celebration, selected wedding moments |
| `secondary-soft` | `#FB7185` | Rose fill for chips and illustration; never text on white |
| `tertiary` | `#0B0F14` | Obsidian. Type, structure, dark bands, the mark |
| `neutral` | `#F8FAFC` | Cool white page surface |
| `surface` | `#FFFFFF` | Cards, panels, inputs |
| `border` | `#E2E8F0` | 1px hairlines, dividers, progress track |
| `muted` | `#475569` | Secondary body copy |
| `muted-soft` | `#64748B` | Captions, meta, icons; 14px and up only |
| `on-primary` | `#FFFFFF` | Text/icon on cobalt |
| `on-secondary` | `#0B0F14` | Text on rose — never white |
| `danger` | `#B91C1C` | Functional only: over-budget, destructive, errors |

### The couple-attribution convention

This is the product's one proprietary visual idea, and it is the reason rose exists at all:

**Dana Ayu → Rose. Dana Budi → Cobalt.**

- A member is assigned a colour when they join a workspace, and it never changes for that workspace.
- Money in, money out, contribution bars, avatars, and chips carry that member's colour.
- The two member colours are reserved. In a view where a member colour is present, rose and cobalt cannot also mean "danger", "warning", or "category".
- Totals are never member-coloured. A total is obsidian.

### Contrast, measured

| Pair | Ratio | Verdict |
|---|---|---|
| Obsidian on cool white | 18.37:1 | AA text |
| Obsidian on white | 19.22:1 | AA text |
| Muted `#475569` on white | 7.58:1 | AA text |
| Muted-soft `#64748B` on white | 4.76:1 | AA text — 14px+ only |
| White on cobalt | 6.7:1 | AA text |
| Cobalt on white | 6.7:1 | AA text |
| Obsidian on rose | 5.23:1 | AA text |
| White on rose | 3.67:1 | Large text / UI only — **do not use for labels** |
| Rose on white | 3.67:1 | Large text / UI only — not body copy |
| Obsidian on rose-soft | 7.14:1 | AA text |
| White on rose-soft | 2.69:1 | **Fails — never** |
| Cobalt on obsidian | 2.87:1 | **Fails — use `primary-on-dark`** |
| `primary-on-dark` on obsidian | 10.66:1 | AA text |
| Danger on white | 6.47:1 | AA text |

Three rules follow directly from the numbers:

1. **Rose never carries white text.** Obsidian on rose (5.23:1) is the only acceptable pairing.
2. **Cobalt text does not sit on obsidian** (2.87:1). On dark, use `primary-on-dark`.
3. **`secondary-soft` is a fill, not a text colour.** On white it is 2.69:1.

## Typography

One family: **Plus Jakarta Sans**. No serif, no third family, no display face.

| Token | Size / weight / tracking | Use |
|---|---|---|
| `display` | 56 / 800 / −0.03em | Landing hero only |
| `h1` | 40 / 800 / −0.03em | Page title |
| `h2` | 28 / 700 / −0.02em | Section |
| `h3` | 20 / 700 / −0.015em | Card title |
| `body-lg` | 18 / 400 | Lead paragraph |
| `body-md` | 16 / 400 | Default body |
| `body-sm` | 14 / 400 | Table cells, meta |
| `label` | 12 / 700 / +0.08em, uppercase | Field labels, eyebrows |
| `numeric` | 16 / 700 / tnum | Money in tables |
| `numeric-lg` | 32 / 800 / tnum | Balances, forecast headline |

- **Every number that represents money uses `tnum`.** Proportional digits make columns of rupiah unreadable and destroy the scan.
- Money is right-aligned in tables and left-aligned in headlines. Never centre a figure.
- Tracking is negative from `h3` upward and positive only on uppercase labels. Sentence case everywhere else.
- Body copy maxes at ~68 characters per line.

## Layout

- **8px base.** Spacing scale: 4 · 8 · 16 · 24 · 32 · 48 · 64 · 96. Invent nothing between the steps.
- Page max width **1120px**; 12-column grid; 24px mobile gutters, 48px desktop.
- Card padding 24px; card gap 16px. Dense financial tables may drop to 12px cell padding.
- Section rhythm 64px mobile / 96px desktop.
- The dashboard is a **reading surface first**: one primary number (funded or shortfall), then categories, then the ledger. Do not open with a wall of charts.
- Every summary block must state its reconciliation status. A number without provenance is a design defect, not a data problem.

## Elevation & Depth

- **Flat by default.** No shadows, glows, or blurs on any brand element, mark, or card.
- Depth comes from three things only: white surface on cool white, a 1px `border` hairline, and the obsidian band.
- One exception: **overlays** (dialog, dropdown, command menu) may use a single soft shadow, because they must float above the page. Nothing else may.
- Dark bands are bookends, not decoration: hero, and the closing CTA/celebration band.

## Shapes

Radius scale: `xs 6 · sm 8 · md 12 · lg 16 · xl 24 · full 999`.

- Cards and inputs: `sm` to `lg`. Badges and chips: `full`. Buttons: `sm` — not pills.
- The mark's tile uses **12 on a 48 grid (25%)**, deliberately rounder than UI corners, so the icon reads as an app rather than a card.

### The mark

Constructed, not a font glyph: one stroked path with round caps on a 48×48 box.

```svg
<svg viewBox="0 0 48 48">
  <rect width="48" height="48" rx="12" fill="#1D4ED8"/>
  <path d="M36 14 H20 A7 7 0 0 0 20 28 H28 A7 7 0 0 1 28 42 H12"
        fill="none" stroke="#FFFFFF" stroke-width="6.5"
        stroke-linecap="round" stroke-linejoin="round"/>
  <rect x="37" y="37" width="6" height="6" rx="1.5" fill="#F43F5E"/>
</svg>
```

- **Primary:** cobalt tile, white S, rose seal. **Inverse:** cool-white tile, obsidian S, rose seal — for dark surfaces; never place the cobalt tile on obsidian.
- **Monogram:** no tile, cobalt S with rose seal, for large formats and watermarks.
- The seal is the only place rose touches the mark. It means *stamped, valid, settled* — the "sah" in SahFund.
- Clear space: half the cap height on all sides. Minimum sizes: icon 16px, lockup 96px wide.
- Live preview and PNG/SVG export: `image/jobs/2026-11-sahfund-logo/design.html` (seal set to `secondary #F43F5E`).

## Components

| Component | Rule |
|---|---|
| `button-primary` | One per view. Cobalt fill, white text, 8px radius, no shadow. |
| `button-secondary` | White fill, obsidian text, 1px border. The default for anything non-destructive. |
| `button-ghost` | Text-only, muted; toolbars and row actions. |
| `input` | 44px tall, white, 1px border; focus ring is cobalt 2px offset 2px. |
| `card` / `card-dark` | White on cool white / obsidian on dark. 1px border, no shadow. |
| `badge-cobalt` | Category and status tags: "On track", "Committed". |
| `badge-rose` | Milestones only: "Target tercapai ✨", "Hari H −30". Obsidian text. |
| `chip-member-*` | The couple-attribution chips. Stable colour per member. |
| `progress-*` | 8px rounded track, cobalt fill. Rose is never the fill — progress is money, not emotion. |
| `nav-item-active` | Cool-white fill, cobalt label. |
| `table-header` | Cool-white band, 40px, muted 12px uppercase label. |
| `alert-danger` | Over-budget and errors only. Red text, white surface, 1px border. |
| `link-on-dark` | `primary-on-dark` text on obsidian. |

**Rose is not an action colour.** It never fills a button, never marks a link, never indicates "next". If rose is clickable, the design has drifted.

## Do's and Don'ts

**Do**

- Spend the colour budget: 60–70% neutral, 20–25% cobalt, 5–10% rose.
- Use rose for exactly four things: member attribution, milestones, celebration states, and small wedding-specific detail.
- Put the reconciliation status next to the number, always.
- Use `tnum` for every rupiah figure.
- Keep the obsidian band for the moments that must feel premium or final (hero, "Target tercapai", close).
- Prefer one strong number over three weak charts.

**Don't**

- Don't let a screen read as pink. Rose is an accent with a job, not a theme.
- Don't use rose for errors, warnings, or over-budget. `danger` exists for that; rose means joy.
- Don't put white text on rose (3.67:1) or white on `secondary-soft` (2.69:1).
- Don't put cobalt text on obsidian (2.87:1) — use `primary-on-dark`.
- Don't add gradients, glows, glassmorphism, drop shadows on cards, or 3D.
- Don't invent a hue outside this palette; if a state needs a new colour, it needs a decision, not a hex value.
- Don't use stock wedding photography, emoji as iconography, or script/handwritten typefaces.
- Don't animate numbers for delight. Money counts up only when it communicates a change.
