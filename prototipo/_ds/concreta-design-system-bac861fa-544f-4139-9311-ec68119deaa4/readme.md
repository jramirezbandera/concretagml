# Concreta — Design System

**"Mesa de trabajo del ingeniero"** — a precision technical instrument, not a
SaaS dashboard.

Concreta is a web app for **structural calculation** aimed at the daily
professional work of Spanish architects, building engineers and structural
engineers. It resolves recurring code checks quickly, visually, and in
conformance with Spanish/European norms (**CE, CTE DB-SE / DB-SE-A / DB-SE-C,
Eurocódigos**). It is deliberately *not* a CYPE or a SAP: it is a desk tool for
day-to-day calculations — fast, traceable, and defensible before visado and
site.

This design system is a recreation of Concreta's real product surfaces built
from its source repository so design agents can generate on-brand interfaces
and assets. **The SVG is the protagonist; everything else is chrome.**

## Sources

Built by reading the product's own source of truth. Explore these to go deeper
(you may need access):

- **GitHub — `jramirezbandera/concreta-v2`** (https://github.com/jramirezbandera/concreta-v2) — the app: React 19 + Vite + TypeScript + Tailwind v4. Ported here: `DESIGN.md` (the approved design system), `src/index.css` (the `@theme` token layer), `src/components/**` (layout, checks, ui, units, theme), `src/pages/landing/**` (the marketing site), `public/fonts` (Geist), `public/favicon.svg`, `public/icons.svg`.
- Related repos in the same org (context only): `concreta-FEM`, `concreta-instalaciones`, `concreta-mediciones`, `Mrd-Viga-Hormigon`.

Nothing here is decorative invention — tokens, component values, icon paths and
copy are lifted from the repo. Where a value differs from a framework default,
the repo wins.

---

## Content fundamentals

**Language: Spanish (Spain), professional-technical register.** Copy is written
for calculistas, not consumers.

- **Voice**: declarative, confident, compact. Marketing headline: *"El cálculo
  estructural que no te frena."* Uses **"tú"** implicitly ("que no te frena",
  "Suscribirse"), never corporate "usted".
- **Density over hand-holding**: labels are terse (`Ancho b`, `fck`, `Md/MRd`),
  units explicit, references cited. A UI string is as short as it can be while
  staying unambiguous.
- **Rigor is a value**: every check names its article (`CE §42`, `DB-SE-A §6.3`,
  `EC5 §6.1.6`). "Rigor sin opacidad."
- **Verdict vocabulary**: `CUMPLE` / `ADVERT.` (or `REVISAR`) / `INCUMPLE` / `—`.
  Advisory notes are prefixed `⚠` and use amber; everything else informational
  stays in `text-secondary`.
- **Numbers are typeset**: all numeric values, units and code refs are Geist
  Mono with tabular figures. Prose is Geist Sans.
- **No emoji** as UI. The only glyphs are stroke SVG icons and, rarely, `✓ ⚠ ✗`
  as textual status marks (e.g. PDF export). Accent characters and Spanish
  punctuation (`·`, `→`, `²`, `³`, `η`, `Ø`, `φ`, `γ`) are used freely.
- **Tone examples**: section headers are 10px UPPERCASE ("GEOMETRÍA",
  "VERIFICACIONES"); the "próximamente" state reads "pronto"; a copied share
  link toasts "Enlace copiado".

## Visual foundations

- **Two themes, both intentional.** **Light is the default** (OS-aware on first
  visit — engineers work in lit offices next to AutoCAD/CYPE). **Dark is the
  signature** (slate-900/800/700). What is non-negotiable is density and the
  legibility of the calculation — not the background color. Tokens flip under
  `html[data-theme="dark"]`.
- **Color.** Neutral slate surfaces; a single **sky accent** (`#0284c7` light /
  `#38bdf8` dark) with a **dual role** — interactive UI (focus, active nav) *and*
  live SVG annotations (neutral axis, dimension lines). Semantic states
  green/amber/red communicate utilization (η) and verdicts only — never
  decoration. **No violet, no blue-to-purple, no decorative background
  gradients.** The one functional gradient is the *ambient verdict* on the
  results panel.
- **Type.** Geist Sans (400/500/600) + Geist Mono (400/500). A pixel-literal UI
  scale (10–15px) — this is a dense instrument, not a marketing type ramp. The
  marketing hero uses a tight `clamp()` display size with `-0.035em` tracking.
- **Spacing.** 8px base. Fixed shell dimensions: topbar 48px, sidebar 204px,
  inputs column 240px, results column 280px, canvas 1fr (the widest area).
- **Backgrounds.** Solid surfaces. The **dot-grid canvas**
  (`radial-gradient` dots at 22px) evokes engineer's graph paper — the single
  strongest brand motif, applied to every SVG work area (never in PDF). The
  marketing hero reuses a masked dot-grid at 32px.
- **Radius.** Exactly three levels: `0` (SVG canvas — the calc *is* the content),
  `4px` (inputs, tags, badges, buttons), `6px` (preview frames). Never
  `rounded-lg`/`xl`/`full`.
- **Borders & elevation.** Two border weights (`border-main`, softer
  `border-sub`). **The system does not use shadows** — elevation is surface +
  border (tooltips, popovers). The *only* shadow is the Toast and the marketing
  hero preview frame.
- **Motion.** CSS transitions only, `150ms ease-in-out` for hover/focus/state
  color. No animation library. Never animate layout shifts, SVG content, or page
  transitions. Landing adds a `cubic-bezier(0.22,1,0.36,1)` fade-up.
- **Hover / press.** Buttons hover to accent border+text (secondary) or a darker
  fill (primary); nav items brighten from `text-secondary` → `text-primary` or
  become accent on active with an accent-tint background + 2px left rail. No
  scale/shrink press effects.
- **Cards.** Only when the card *is* the interaction — never decorative. No
  colored circles behind icons, no left-border-accent cards.
- **Imagery.** Almost none; the product renders its own live SVG. Iconography is
  the visual language (see below).

## Iconography

- **App module icons** — bespoke **16×16, stroke-only, `currentColor`** SVGs,
  one per module, **differentiated by material**: rebar dots (RC), clean
  I-section paths (steel), curved grain (timber), running-bond coursing
  (masonry), L-cantilever (retaining wall), circular slip arc (slope). This is
  the `ModuleIcon` component — the single source shared by the app sidebar and
  the marketing module grid. Never hand-roll module glyphs elsewhere; use it.
- **UI icons** — the app uses **`lucide-react`** (thin technical stroke: Info,
  Moon/Sun, ArrowLeftRight, Menu, etc.). Recreations either pull Lucide from a
  CDN or inline small stroke SVGs matching Lucide's 1.5–2px weight. The ⓘ help
  glyph is **always stroke-only, never inside a colored circle**.
- **Logo** — an **I-beam mark** (`assets/favicon.svg`): sky bars on a slate
  rounded square. The app sidebar pairs it with the wordmark; the marketing site
  uses a simpler accent **dot + "Concreta"** lockup.
- **Social glyphs** — `assets/social-icons.svg` sprite (github, x, bluesky,
  discord, docs) for the marketing footer. Reference by `#id` via `<use>`.
- **No emoji, no unicode-as-icon** in UI (textual `✓ ⚠ ✗` status marks excepted).

---

## Index / manifest

**Root**
- `styles.css` — the consumer entry point (`@import` manifest only).
- `readme.md` — this file. `SKILL.md` — Agent-Skills-compatible entry.

**`tokens/`** (all reached from `styles.css`)
- `fonts.css` — Geist Sans/Mono `@font-face` (files in `assets/fonts/`).
- `colors.css` — full color system: light `:root` + dark `html[data-theme="dark"]`, chart/geo/FEM palettes, tints, shorthand aliases, marketing chrome.
- `typography.css` — font stacks + pixel type scale + weights + tracking.
- `spacing.css` — 8px scale, 3-level radius, shell + marketing layout dims.
- `motion.css` — transition/easing tokens + `.canvas-dot-grid`.

**`components/`** (React primitives — `window.ConcretaDesignSystem_bac861.*`)
- `core/` — `Button`, `StatusBadge`, `StatusTag`, `Panel`
- `data/` — `CheckRow`, `ValueRow`, `SectionHeader`
- `forms/` — `NumberField`, `SegmentedToggle`, `ThemeToggle`
- `feedback/` — `Toast`, `Tooltip`
- `nav/` — `Sidebar`, `Topbar`
- `icons/` — `ModuleIcon`

**`ui_kits/`**
- `app/` — full interactive calculator shell (switch modules in the sidebar).
- `marketing/` — the landing page (hero + module grid + philosophy + pricing).

**`guidelines/cards/`** — foundation specimen cards (Colors, Type, Spacing, Brand)
shown in the Design System tab.

**`assets/`** — `favicon.svg` (I-beam mark), `social-icons.svg`, app PWA icons,
`fonts/` (Geist woff2), `pdf-export.jpg`.

## Using it

Consumers link one file: `styles.css`. Read components off the global namespace
`window.ConcretaDesignSystem_bac861` after loading `_ds_bundle.js`. See any
`components/*/**.card.html` for the mount pattern, and the `.prompt.md` beside
each component for usage.
