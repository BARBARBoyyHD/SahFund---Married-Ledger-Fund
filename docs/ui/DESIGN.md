---
version: approved-2026-11
name: SahFund
description: Graded deep emerald and champagne gold on crisp pearl — a wedding fund that looks worth trusting.
colors:
  emerald: "#0D3B2E"
  emerald-deep: "#082A20"
  emerald-lift: "#11483A"
  emerald-glow: "#1C6A50"
  emerald-soft: "#E3EDE7"
  emerald-mist: "#E8F1EB"
  emerald-shade: "#C7D9CF"
  gold: "#DFBA73"
  gold-hover: "#E8C98A"
  gold-line: "#8E856D"
  pearl: "#F7F9F6"
  pearl-muted: "#C6D5CD"
  ink: "#12211B"
  ink-muted: "#4C5C54"
  surface: "#FFFFFF"
  danger: "#B91C1C"
typography:
  display:
    fontFamily: Plus Jakarta Sans
    fontSize: clamp(2.5rem, 5.2vw, 4.75rem)
    fontWeight: 800
    lineHeight: 1.02
    letterSpacing: "-0.03em"
  h2:
    fontFamily: Plus Jakarta Sans
    fontSize: clamp(1.75rem, 3.2vw, 2.5rem)
    fontWeight: 700
    lineHeight: 1.12
    letterSpacing: "-0.02em"
  h3:
    fontFamily: Plus Jakarta Sans
    fontSize: 20px
    fontWeight: 700
    lineHeight: 1.3
    letterSpacing: "-0.015em"
  body:
    fontFamily: Plus Jakarta Sans
    fontSize: 17px
    fontWeight: 400
    lineHeight: 1.6
  body-sm:
    fontFamily: Plus Jakarta Sans
    fontSize: 14px
    fontWeight: 400
    lineHeight: 1.5
  eyebrow:
    fontFamily: Plus Jakarta Sans
    fontSize: 12px
    fontWeight: 700
    letterSpacing: "0.08em"
    textTransform: uppercase
  figure:
    fontFamily: Plus Jakarta Sans
    fontSize: clamp(3.5rem, 14vw, 12rem)
    fontWeight: 800
    lineHeight: 0.9
    letterSpacing: "-0.04em"
rounded:
  xs: 6px
  sm: 8px
  md: 12px
  lg: 16px
  xl: 24px
  full: 9999px
shadows:
  card: "0 36px 70px -40px rgb(4 20 15 / 0.70)"
  lift: "0 16px 30px -18px rgb(4 20 15 / 0.50)"
  nav: "0 14px 34px -30px rgb(4 20 15 / 0.55)"
components:
  button-primary:
    backgroundColor: "#0D3B2E"
    textColor: "#F7F9F6"
    rounded: "{rounded.sm}"
    height: 48px
  button-on-emerald:
    backgroundColor: "#DFBA73"
    textColor: "#0D3B2E"
    rounded: "{rounded.sm}"
    height: 48px
  button-secondary:
    backgroundColor: transparent
    textColor: "#0D3B2E"
    borderColor: "#0D3B2E"
    rounded: "{rounded.sm}"
    height: 48px
  panel:
    backgroundImage: "panel-surface (mint → sage grade + gold corner)"
    borderColor: "rgb(223 186 115 / 0.35)"
    rounded: "{rounded.md}"
    padding: 24-32px
  card:
    backgroundColor: "#FFFFFF"
    backgroundImage: "card-sheen (white → #F4F7F2)"
    textColor: "#12211B"
    rounded: "{rounded.sm}"
  member-chip-ayu:
    backgroundColor: "#0D3B2E"
    textColor: "#F7F9F6"
    rounded: "{rounded.full}"
  member-chip-budi:
    backgroundColor: "#DFBA73"
    textColor: "#0D3B2E"
    rounded: "{rounded.full}"
  input:
    backgroundColor: "#FFFFFF"
    textColor: "#12211B"
    borderColor: "#8E856D"
    rounded: "{rounded.sm}"
    height: 44px
  nav-link:
    textColor: "#4C5C54"
    hoverColor: "#0D3B2E"
    underlineColor: "#DFBA73"
---

# SahFund — Design System

> [!success] Approved 2026-11
> This replaces the cobalt/rose language. It is **live on the landing page**
> (`/`), and on login and 404 through the shared landing primitives. The
> dashboard still runs the legacy tokens — see
> [Pending: dashboard migration](#pending-dashboard-migration).

## Overview

SahFund is a shared wedding-fund ledger: two people, one pot of money, one date
that does not move. The design has two jobs — prove the numbers, and feel like a
wedding — without becoming a bank dashboard or a pink invitation site.

**Direction: premium graded green.** Deep emerald fields that graduate instead of
sitting flat, warm champagne hairlines, crisp pearl paper, white cards that float
on the field. The approved reference is a graded green app UI: luminous emerald
depth, soft light, layered shapes — not solid blocks.

Three rules hold it together:

1. **Emerald carries the money.** Deep emerald `#0D3B2E` is the field, the action,
   the bookend. Graded — never one flat fill.
2. **Gold is the jeweller's mark.** Thin and warm: hairlines, the seal, one accent
   line, the corner of a panel. It is never body text on pearl (1.74:1).
3. **Pearl is the page.** `#F7F9F6` is the reading surface; the dark emerald bands
   bookend the story (hero, close).

The failure mode to design against: **a flat sage slab with a white rectangle on
it.** Every surface needs one of — a grade, a warm corner, a hairline, a lift.

## Scope: where this style is live

| Surface | Palette | Notes |
|---|---|---|
| Landing `/` | **This document** | Hero, sections, close |
| `/login`, `/not-found` | **This document** | Through `Container`, `BUTTON_PRIMARY`, `BUTTON_SECONDARY`, `Wordmark` |
| Dashboard / app shell | Legacy cobalt/rose tokens | `--color-primary`, `--color-secondary`, `--color-tertiary`, `--color-neutral`, `--color-line`, `--color-muted`, `--color-muted-soft` in `globals.css` |

Do not mix the two palettes on one screen. Do not migrate the dashboard piecemeal
— that is a planned, separate pass.

## Colors

All tokens live in `apps/frontend/src/app/globals.css` (`@theme`). Hexes below are
the shipped values. Names are written without the `--color-` prefix — in markup
they are used as `bg-emerald`, `text-pearl`, `border-gold`, and so on.

| Token | Hex | Role |
|---|---|---|
| `emerald` | `#0D3B2E` | The brand field. Hero and close backgrounds, primary button, active step, pricing figure, progress fill, link hover, Ayu |
| `emerald-deep` | `#082A20` | Deepest stop of the hero grade; primary button hover |
| `emerald-lift` | `#11483A` | First (lightest) stop of the hero grade — top-left |
| `emerald-glow` | `#1C6A50` | Green radial light in `.hero-aurora` only (never a fill) |
| `emerald-soft` | `#E3EDE7` | Base of the section panel grade |
| `emerald-mist` | `#E8F1EB` | Light stop of the panel grade |
| `emerald-shade` | `#C7D9CF` | Deep stop of the panel grade |
| `gold` | `#DFBA73` | Action on emerald, Budi chip, hairlines, the mark's seal, headline accent line |
| `gold-hover` | `#E8C98A` | Gold button hover |
| `gold-line` | `#8E856D` | Warm UI border for inputs (3.67:1 on white) |
| `pearl` | `#F7F9F6` | Page background of the light sections; text on emerald |
| `pearl-muted` | `#C6D5CD` | Secondary copy on emerald (8.20:1) |
| `ink` | `#12211B` | Primary type on pearl and cards |
| `ink-muted` | `#4C5C54` | Secondary type on pearl and cards |
| `surface` | `#FFFFFF` | Cards, inputs |
| `danger` | `#B91C1C` | Functional only: reconciliation mismatch, errors |

Notes:

- `emerald-mist` and `emerald-shade` exist **only** as gradient stops. Do not use
  them as flat fills or text colours.
- `emerald-glow` exists **only** inside the `.hero-aurora` radial.
- `gold-line` is a border/underline colour, not text.

### The couple-attribution convention

**Dana Ayu → Emerald. Dana Budi → Gold.**

- A member's colour is assigned when they join and never changes for that workspace.
- Money in, money out, contribution bars and chips carry the member's colour.
- Ayu chip: emerald fill, pearl text (11.79:1). Budi chip: gold fill, emerald text
  (6.78:1). Implemented once, in `components/landing/member-chip.tsx`.
- Totals are **never** member-coloured. A total is `ink` on light, `pearl` on emerald.

## Gradients

Depth is built from graded surfaces, not from a stack of nested blocks. One
background per surface — no plate inside a plate.

### `.hero-field` — the hero and close band

```css
background-color: var(--color-emerald);
background-image: linear-gradient(
  162deg,
  var(--color-emerald-lift) 0%,   /* #11483A */
  var(--color-emerald) 48%,       /* #0D3B2E */
  var(--color-emerald-deep) 100%  /* #082A20 */
);
```

### `.hero-aurora` — the only luminous layer

Sits absolutely over `.hero-field`, `pointer-events-none`:

```css
background-image:
  radial-gradient(42rem 30rem at 84% 8%,
    color-mix(in srgb, var(--color-gold) 22%, transparent) 0%, transparent 68%),
  radial-gradient(38rem 28rem at 4% -6%,
    color-mix(in srgb, var(--color-emerald-glow) 60%, transparent) 0%, transparent 66%);
```

One warm gold corner (top-right, behind the product), one green lift (top-left,
behind the headline). Nothing else glows.

### `.ledger-rules` — faint ledger paper

```css
background-image: linear-gradient(to right, var(--color-gold) 1px, transparent 1px);
background-size: 96px 100%;
```

Always drawn as a low-opacity layer (`opacity: 0.07` on the hero). It is texture,
not a grid you can see.

### `.panel-surface` — the section panels

```css
background-color: var(--color-emerald-soft);
background-image:
  radial-gradient(70% 62% at 86% -8%,
    color-mix(in srgb, var(--color-gold) 22%, transparent) 0%, transparent 60%),
  linear-gradient(158deg,
    var(--color-emerald-mist) 0%,   /* #E8F1EB */
    var(--color-emerald-soft) 40%,  /* #E3EDE7 */
    var(--color-emerald-shade) 100% /* #C7D9CF */);
border: 1px solid color-mix(in srgb, var(--color-gold) 35%, transparent);
box-shadow:
  inset 0 1px 0 rgb(255 255 255 / 0.55),
  0 32px 64px -44px rgb(6 28 22 / 0.55);
```

Used by every graded panel: the "Cara kerja" stage and all four "Yang dicatat"
panels. Panels stay **light** — text on them is `ink` / `ink-muted`.

### `.card-sheen` — the white data cards

```css
background-color: var(--color-surface);
background-image: linear-gradient(180deg,
  var(--color-surface) 0%, #FAFBF7 58%, #F4F7F2 100%);
box-shadow:
  inset 0 1px 0 rgb(255 255 255 / 0.9),
  0 16px 32px -26px rgb(6 28 22 / 0.6);
```

Paired with a 1px `gold` border. The card should look seated on the panel, not
pasted on it.

## Elevation & Depth

The old "flat by default, no gradients or shadows" rule is **overturned by an
explicit decision recorded with the landing approval**. What is true now:

**Depth vocabulary — use these, in this order:**

1. **Tonal grade** — `.hero-field`, `.panel-surface`: the surface itself changes
   tone across its area.
2. **Warm corner light** — one gold radial, low alpha, in a corner away from body text.
3. **1px gold hairline** — panel borders, section rules, the nav seam, the pricing
   divider. `--color-gold` at 35–60% over the surface.
4. **Soft green-tinted shadow** — `--shadow-card`, `--shadow-lift`, `--shadow-nav`.
   Shadows are dark green, wide, and negative-spread (`-18px` to `-44px`): a lift,
   never a drop.
5. **Translucent sheets** — `bg-white/4`–`/6` rounded rectangles, rotated a few
   degrees, clipped by the section. Used twice in the hero and once behind the demo
   card. They are *sheets*, not a second background.
6. **Floating white cards** — the product surface. White + gold hairline + sheen +
   shadow.

**Still banned (cheap effects):**

- Glassmorphism: no `backdrop-blur`, no frosted navigation, no see-through cards.
- No 3D, bevels, inner bevels, or perspective transforms.
- No glow **behind text** and no gradient stop that passes through a text block —
  text always sits on a stable end of a grade or on an opaque card.
- No stock photography, no emoji as icons, no script/handwritten typefaces.
- No second background inside a background. One field per surface.
- Shadows: no pure black, no blur above ~70px, no shadow on a text element.

## Motion

Motion is part of the identity: the page assembles, the product settles, the
background breathes. It is all CSS keyframes plus one small IntersectionObserver
(`components/landing/reveal.tsx`). **No animation library.**

> [!warning] Hard rule
> Every animation and every hidden start state lives inside
> `@media (prefers-reduced-motion: no-preference)`. With reduced motion the page
> renders finished, with no invisible content and no moving layers.

| Name | Where | Timing |
|---|---|---|
| `line-rise` (`.line-mask > span`) | Hero headline lines | 780ms `--ease-expo`, delay `--line × 90ms` (0/90/180) |
| `enter-up` (`.enter`) | Hero rule, lead, CTA row | 760ms `--ease-expo`, `--d` = 0 / 300 / 380ms |
| `enter-settle` (`.enter-card`) | Hero demo card | 900ms `--ease-expo`, `--d: 460ms`; translateY 34px + scale .96 → 1 |
| `row-in` (`.demo-row`) | Ledger rows inside the card | 480ms, delay `720ms + row × 90ms` |
| `[data-reveal]` + `Reveal` | Section blocks | From opacity 0 / translateY 26px / scale .985; 700ms opacity, 780ms transform; `--stagger × 80ms` |
| `state-in` | Steps stage when the active step changes | 320ms |
| `aurora-drift` (`.hero-aurora`) | Ambient | 26s ease-in-out, infinite alternate; translate −3% / 2%, scale 1.08 |

**Micro-interactions**

- Buttons: `hover:-translate-y-0.5` + `shadow-lift` over 200ms; `active` returns to
  the baseline.
- Cards (`.lift`): `translateY(-4px)` + `shadow-card` over 280ms, inside
  `@media (hover: hover)` so touch cannot get stuck lifted.
- Nav links: a 1px gold underline scales in from the left (`after:` pseudo,
  `scaleX 0 → 1`, 200ms), also on `:focus-visible`.
- Ledger demo: the status line flips between emerald ("Cocok dengan saldo bank")
  and `danger` ("Belum cocok") as you type; the rows do not re-animate.

**Rules**

- Animate `transform` and `opacity` only. Never animate layout properties.
- One ambient animation on the page (the aurora). Do not add a second drifting or
  pulsing element.
- Entrance choreography is bounded: the hero is fully assembled by ~1.4s.

## Typography

One family: **Plus Jakarta Sans**. No serif, no second family, no display face.

| Token / class | Size / weight / tracking | Use |
|---|---|---|
| `text-display` | `clamp(2.5rem, 5.2vw, 4.75rem)` / 800 / −0.03em, lh 1.02 | Hero headline (three authored lines), close headline |
| `text-h2` | `clamp(1.75rem, 3.2vw, 2.5rem)` / 700 / −0.02em, lh 1.12 | Section headlines |
| `text-h3` | 20px / 700 / −0.015em | Card titles, FAQ questions, wordmark |
| `text-body` | 17px / 400 / lh 1.6 | Lead and body copy |
| `text-small` | 14px / 400 / lh 1.5 | Table cells, meta, nav, footnotes |
| `Eyebrow` | 12px / 700 / +0.08em, uppercase | Section labels ("Proses", "Catatan", "Harga", "Tanya jawab") |
| `text-figure` | `clamp(3.5rem, 14vw, 12rem)` / 800 / −0.04em, lh 0.9 | The price |

- **Every rupiah figure uses `tabular-nums` (`tnum`)** and is formatted through
  `src/core/money.ts`. Never `toLocaleString` in a component, never `$`, never
  `en-US` grouping.
- Money is right-aligned in tables, left-aligned in headlines. Never centred.
- Negative tracking from `h3` up; positive tracking only on the uppercase eyebrow.
- Sentence case everywhere except the eyebrow.
- Body copy keeps a measure: `max-w-[38ch]` (hero lead), `42ch` (panel body),
  `34ch` (pricing lead), `40ch` (close), `58ch` (FAQ answers).

## Layout

- **8px base scale**: 4 · 8 · 16 · 24 · 32 · 48 · 64 · 96. Invent nothing between
  the steps.
- **Page max width 1120px**, gutters 24px mobile / 48px desktop
  (`Container` in `components/landing/ui.tsx`).
- **Section rhythm**: `py-16` mobile / `py-24` desktop (64 / 96), via `Section`.
- **Hero**: two equal columns (`lg:grid-cols-2`, 64px gap), vertically centred
  against the card; stacks on mobile in the order headline → lead → CTA → card.
- **Panels**: 16px gap grid, 12 columns on desktop (`col-span-7/5`, then `5/7`).
- **Card padding**: 24px (32px on large panels); data cards 16px.
- Every summary block states its reconciliation status. A number without
  provenance is a design defect, not a data problem.

## Shapes

Radius scale: `xs 6 · sm 8 · md 12 · lg 16 · xl 24 · full 9999`.

- Buttons and inputs: `sm` (8px) — not pills.
- Panels and the hero demo card: `md` (12px).
- Data cards (`.card-sheen`) and FAQ rows: `sm` (8px).
- Chips and progress bars: `full`.
- The mark's tile uses **12 on a 48 grid (25%)**, deliberately rounder than UI
  corners, so the icon reads as an app rather than a card.

### The mark

Constructed, not a font glyph: one stroked path on a 48×48 box, weight 7, mitred 45° bends,
cut by a 4-unit diagonal gap. Source of truth: `components/mark.tsx`.

```svg
<svg viewBox="0 0 48 48">
  <defs>
    <mask id="gap">
      <rect width="48" height="48" fill="#fff"/>
      <rect x="12" y="22" width="24" height="4" transform="rotate(45 24 24)" fill="#000"/>
    </mask>
  </defs>
  <rect width="48" height="48" rx="12" fill="#0D3B2E"/>
  <path d="M35 9H18L10.5 16.5L18 24H30L37.5 31.5L30 39H12"
        fill="none" stroke="#F7F9F6" stroke-width="7"
        stroke-linecap="butt" stroke-linejoin="miter" mask="url(#gap)"/>
  <rect x="38" y="38" width="5" height="5" rx="1.25" fill="#DFBA73"/>
</svg>
```

- **Primary:** emerald tile, pearl S, gold seal.
- **Inverse** (for emerald fields): pearl tile, emerald S, gold seal.
- The S is two chevron halves: horizontal bars joined by 45° bends, sliced by a diagonal gap that
  runs top-left to bottom-right. The cut is construction, not decoration — it keeps the S legible
  at 16px while giving the mark an edge.
- The seal is the only place gold touches the mark. It means *stamped, valid, settled* — the "sah"
  in SahFund. Never recolour it, never add a second gold element to the mark.
- The tile radius is 12 on 48 (25%) — rounder than UI `md`, so the icon reads as an app.
- Clear space: half the cap height on all sides. Minimum sizes: icon 16px, lockup 96px wide.
- Wordmark: mark + "SahFund" at `text-h3`, −0.02em; `ink` on pearl, `pearl` on emerald.
- Assets and a scale test: `apps/frontend/public/brand/` (`preview.html`).

## Landing anatomy

The approved page, top to bottom. Structure lives in `src/app/page.tsx` and
`components/landing/*`.

1. **Navbar** (`site-header.tsx`) — sticky, `z-40`, solid pearl, 1px `gold/60`
   bottom seam, `shadow-nav`. 64px tall (72px desktop). Ink wordmark left, three
   anchor links in the middle (14px medium, `ink-muted` → emerald on hover, gold
   underline), "Masuk" as a 36px emerald outline button right. No blur, no
   transparency.
2. **Hero** (`hero.tsx`) — one graded emerald field: `.hero-field` + `.hero-aurora`
   + `.ledger-rules` at 7% + two rotated translucent sheets. Left column: 56px gold
   rule, three-line `text-display` headline ("Dana nikah," / "tercatat" / "berdua."
   in gold), `pearl-muted` lead, one gold primary action + one pearl text link.
   Right column: the reconcile demo as a floating white card (`shadow-card`, gold
   hairline) with a translucent offset sheet behind it.
3. **Sections** (`steps`, `capabilities`, `pricing`, `faq`) — pearl background,
   `Eyebrow` + `h2`. "Cara kerja" and "Yang dicatat" use `.panel-surface` panels
   holding `.card-sheen` data cards; pricing is type-only (a `text-figure` price
   with a gold divider); FAQ rows are `.card-sheen` cards that turn solid emerald
   when open.
4. **Close** (`close.tsx`) — the same `.hero-field` as the hero: `text-display`
   headline, `pearl-muted` paragraph, gold action, footer on a `gold/40` hairline.

Rules: one primary action per viewport; dark bands are bookends, not decoration;
the hero is assembled by ~1.4s; every screen keeps loading / empty / error /
success states.

## Components

Shipped primitives — these names exist in the codebase. (The old doc's
`badge-cobalt`, `badge-rose` and `chip-member-*` CSS classes never existed; use the
components below.)

| Component | Where | Rule |
|---|---|---|
| `Container` | `landing/ui.tsx` | 1120px page, 24/48px gutters |
| `Section` | `landing/ui.tsx` | `scroll-mt` + 64/96px rhythm |
| `Eyebrow` | `landing/ui.tsx` | 12px uppercase + 24px gold tick; `ink-muted` |
| `BUTTON_PRIMARY` | `landing/ui.tsx` | Emerald fill, pearl text, 48px, `sm` radius. One per view. Light surfaces only |
| `BUTTON_ON_EMERALD` | `landing/ui.tsx` | Gold fill, emerald text, pearl focus ring. On the emerald fields |
| `BUTTON_SECONDARY` | `landing/ui.tsx` | Transparent, 1px emerald border, emerald text; hover `emerald-soft` |
| `TEXT_LINK_ON_EMERALD` | `landing/ui.tsx` | Pearl text, gold underline → pearl on hover |
| `MemberChip` | `landing/member-chip.tsx` | Ayu emerald / Budi gold; `name={false}` renders the unlabeled pill used as a member dot |
| `ReconcileDemo` | `landing/reconcile-demo.tsx` | The product gate. White card, gold border, `shadow-card`; labels the sample "Contoh" |
| `.panel-surface` | `globals.css` | The graded section panel (see Gradients) |
| `.card-sheen` | `globals.css` | The white data card (see Gradients) |
| `.lift` | `globals.css` | Hover raise, pointer-only |
| `.hero-field` / `.hero-aurora` | `globals.css` | Hero and close field (`.hero-aurora` is hero-only) |
| `.ledger-rules` | `globals.css` | 96px gold ruling texture |
| `.line-mask` / `.enter` / `.enter-card` / `.demo-row` / `.state-in` | `globals.css` | Motion primitives (see Motion) |

**Focus rings** — `:focus-visible` is a 2px outline, 3px offset, colour from
`--focus-ring`: emerald on pearl (`main` sets it), gold on the emerald fields,
pearl on the gold button (`focus-visible:outline-pearl`). Never remove it.

**Buttons** always lift on hover (`-2px` + `shadow-lift`) and settle on `active`.

## Contrast, measured

Ratios below are the shipped pairings. **Pixel-measured** = sampled from the
rendered gradient behind the text (worst point in the text's box); **computed** =
WCAG formula on the two hex values.

| Pair | Ratio | Verdict | How |
|---|---|---|---|
| `ink` on `pearl` | 15.75:1 | AA | computed |
| `ink-muted` on `pearl` | 6.69:1 | AA | computed |
| `ink-muted` on card sheen bottom (`#F4F7F2`) | 6.55:1 | AA | computed |
| `emerald` on `pearl` | 11.79:1 | AA | computed |
| `emerald` on `emerald-soft` | 10.42:1 | AA | computed |
| `pearl` on `emerald` | 11.79:1 | AA | computed |
| `pearl` on `emerald-lift` (hero top-left) | 9.86:1 | AA | computed |
| `pearl` on `emerald-deep` | 14.56:1 | AA | computed |
| `pearl-muted` on `emerald` | 8.20:1 | AA | computed |
| `pearl-muted` on `emerald-lift` | 6.86:1 | AA | computed |
| `gold` on `emerald` | 6.78:1 | AA | computed |
| `gold` on `emerald-lift` | 5.67:1 | AA | computed |
| `emerald` on `gold` (gold button, Budi chip) | 6.78:1 | AA | computed |
| `emerald` on `gold-hover` | 7.82:1 | AA | computed |
| **Hero headline** — `pearl` / `gold` / `pearl-muted` | 9.20 / 5.68 / 6.32 | AA | pixel-measured over the grade |
| **Hero lead** — `pearl-muted` | 6.16 | AA | pixel-measured |
| **Panel title** — `ink` | 12.44 | AA | pixel-measured |
| **Panel body** — `ink-muted` | 5.33 | AA | pixel-measured |
| **Steps caption** — `ink-muted` (low on the panel) | 4.82 | AA | pixel-measured |
| `ink-muted` on panel deep stop `#C7D9CF` | 4.81 | AA | computed |
| `danger` on white / pearl | 6.47 / 6.11 | AA | computed |
| `gold-line` on white (input border) | 3.67:1 | UI 3:1 | computed |
| `gold` on `pearl` (text or hairline) | 1.74:1 | **never text**; hairlines only | computed |
| `pearl` on `gold` | 1.74:1 | **fails — never use** | computed |

Two numbers to remember: **gold is never text on pearl**, and **the lightest
gradient point behind text must still clear 4.5:1**. When adding a gradient stop,
re-measure with pixels, not by eye.

## Do's and Don'ts

**Do**

- Grade every large surface: `.hero-field` for dark bands, `.panel-surface` for
  light panels, `.card-sheen` for white cards.
- Keep panels light and put body copy on the light end of the grade.
- Put one warm gold corner in a panel, away from text.
- Use a 1px gold hairline to separate surfaces; use shadows only to lift.
- Use `Eyebrow` for section markers, with the 24px gold tick.
- Keep the couple colours stable: Ayu emerald, Budi gold.
- Put the reconciliation status next to the number, always.
- Use `tnum` for every rupiah figure, formatted via `core/money.ts`.
- Gate every animation behind `prefers-reduced-motion: no-preference`.

**Don't**

- Don't nest a background in a background (no plate inside a field).
- Don't wash text out with a gradient — no gradient stop crossing a text block.
- Don't put gold text on pearl or white.
- Don't use white text on gold: emerald on gold is the only pair.
- Don't put `emerald` text on `emerald` fields — use `pearl` / `pearl-muted`.
- Don't add `backdrop-blur`, frosted bars, 3D, or glows behind text.
- Don't add a second ambient animation.
- Don't invent a hue; if a state needs a new colour, it needs a decision, not a hex.
- Don't mix legacy cobalt/rose tokens into a landing screen.

## Pending: dashboard migration

The app shell and dashboard were **not** migrated with the landing page. They
still use the legacy tokens in `globals.css`:

`primary #1D4ED8` · `primary-hover #1E40AF` · `primary-on-dark #93C5FD` ·
`secondary #F43F5E` · `secondary-soft #FB7185` · `tertiary #0B0F14` ·
`neutral #F8FAFC` · `line #E2E8F0` · `muted #475569` · `muted-soft #64748B`

Plan: migrate the whole app once the landing is settled. Until then, a dashboard
screen that follows this document will look wrong, and a landing screen that
follows the legacy table will look wrong. Pick the surface, then the palette.

## References

- Tokens, gradients, motion: `apps/frontend/src/app/globals.css`
- Layout primitives and buttons: `apps/frontend/src/components/landing/ui.tsx`
- Hero: `apps/frontend/src/components/landing/hero.tsx`
- Navbar: `apps/frontend/src/components/landing/site-header.tsx`
- Mark and wordmark: `apps/frontend/src/components/mark.tsx`
- Sample data for demos: `apps/frontend/src/lib/landing-demo.ts`
- Architecture and ADRs: [ITA](../projects/ITA.md) · scope: [BRD](../projects/BRD.md)
- `ui/html/design.html` is a **legacy cobalt preview** — not the approved style.
