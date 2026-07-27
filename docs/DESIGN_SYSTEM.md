# DESIGN_SYSTEM.md

## Direction

Brief: dark, bold, high-contrast. That axis was fixed by the client, so it's
followed exactly. What was left open — palette, type, layout, signature — is
where the deliberate choices below live.

**Avoided on purpose:** the near-black-plus-single-acid-accent look and the
warm-cream-plus-serif-plus-terracotta look are the two patterns AI-generated
sites cluster around right now. Neither fits "bold, high-contrast" as
distinctively as a two-accent system, so this uses a cool/warm accent pair
instead of one accent color.

## Design plan (brainstorm → decision)

- **Color:** ink background family + a cool electric-indigo accent for
  primary actions/links, paired with a warm amber accent used sparingly for
  emphasis (status dot, "featured" mark, one hover glow). Two accents that
  don't blend into each other read as more considered than one "AI blue" or
  one "AI green."
- **Type:** no external font files (keeps the zero-dependency, zero-network-request
  performance budget intact and sidesteps licensing). Instead, the *system* UI
  font stack is pushed hard at one end only: very heavy (800/900)
  tight-tracking display weight for headlines, paired with the same sans
  face at normal weight for everything else — nav, labels, breadcrumbs, meta
  text, body copy. A monospace face was used in an earlier pass for
  labels/breadcrumbs as a nod to "engineer's tools," but that read as
  *software* engineer specifically (terminals/editors), which is the wrong
  discipline for this site's subject — it was removed sitewide in favor of
  one consistent sans stack.
- **Layout:** generous single-column rhythm on mobile, calm 12-column grid on
  desktop, sticky compact nav. Project and experience data drive repeating
  card/row components rather than bespoke one-off layouts, since content is
  meant to be edited via JSON.
- **Signature:** a plain-text breadcrumb nav (Home / About / Projects / CV /
  Contact) with the active segment lit in the indigo accent, plus a small
  pulsing "available for work" status pill in the hero using the amber
  accent. The nav previously used a shell-path style (`~/home`) and the
  wordmark previously used a Unix-prompt format (`~/pedro-sousa`) with a
  blinking terminal-cursor accent — both were removed for the same reason as
  the monospace type: they signal "software developer" specifically, not
  "engineer" generally. The status pill remains the one "loud" element;
  everything else stays quiet and disciplined.
- **Rejected:** numbered section markers (01 / 02 / 03) — the content here
  (skills, projects) isn't an ordered sequence, so numbering would encode
  false information about the content rather than true information.

## Color palette

Defined once in `assets/css/tokens.css`, never duplicated.

| Token | Hex | Role |
|---|---|---|
| `--color-ink-950` | `#0B0D12` | Page background |
| `--color-ink-900` | `#14171F` | Section/alt background |
| `--color-ink-800` | `#1B1F2A` | Card / elevated surface |
| `--color-ink-700` | `#232838` | Hover surface, subtle fill |
| `--color-line` | `#262B38` | Borders, dividers |
| `--color-text-100` | `#F2F4F8` | Primary text (high contrast on ink-950) |
| `--color-text-400` | `#8B93A7` | Secondary/muted text |
| `--color-text-600` | `#5B6376` | Tertiary text, disabled |
| `--color-accent-indigo` | `#6C7CFF` | Primary interactive accent (links, primary buttons, active states) |
| `--color-accent-indigo-dim` | `#4B57B8` | Indigo pressed/border state |
| `--color-accent-amber` | `#FFB347` | Secondary accent, used sparingly (status dot, featured badge, one glow) |
| `--color-success` | `#4ADE80` | Form/inline success state |
| `--color-danger` | `#FF6B6B` | Error state |

Contrast check: `--color-text-100` on `--color-ink-950` is ~17.9:1. Muted
`--color-text-400` on `--color-ink-950` is ~7.4:1 — both comfortably clear
WCAG AA (4.5:1) for body text, including the muted tier.

## Typography

- **Display stack** (`--font-display`): `-apple-system, "Segoe UI", system-ui, sans-serif`,
  weight 800–900, `letter-spacing: -0.02em` at large sizes, used only for H1/H2.
- **Body stack** (`--font-body`): same system-ui family, weight 400/500,
  line-height 1.6, used for paragraphs and UI text.
- **Mono stack** (`--font-mono`): `ui-monospace, "SF Mono", "Cascadia Code", Menlo, Consolas, monospace`,
  token/utility class still defined but unused sitewide — the nav breadcrumb,
  eyebrows, tags, status pill, CV/project meta labels, and the 404 code all
  moved to the body sans stack (see "Type" above for why).

### Type scale (defined as tokens, applied via utility classes in `layout.css`)

| Token | Size | Line-height | Usage |
|---|---|---|---|
| `--text-xs` | 0.75rem / 12px | 1.4 | Meta, tags, footnotes |
| `--text-sm` | 0.875rem / 14px | 1.5 | Secondary UI text |
| `--text-base` | 1rem / 16px | 1.6 | Body copy |
| `--text-lg` | 1.125rem / 18px | 1.6 | Lead paragraphs |
| `--text-xl` | 1.5rem / 24px | 1.3 | Card titles, H3 |
| `--text-2xl` | 2rem / 32px | 1.2 | H2 |
| `--text-3xl` | 2.75rem / 44px | 1.1 | H1 (mobile) |
| `--text-4xl` | 4rem / 64px | 1.05 | H1 (desktop, `clamp()`-driven) |

## Spacing scale

4px base unit, exposed as tokens `--space-1` through `--space-24`
(`--space-1: 0.25rem` … stepping to `--space-24: 6rem`). Every margin/padding
in the project references one of these — no bare pixel values in component or
layout CSS.

## Elevation

Dark UIs elevate with lighter surfaces + soft glow rather than dark drop
shadows (which barely read on an already-dark background):

| Token | Effect |
|---|---|
| `--elevation-0` | none (flat, base background) |
| `--elevation-1` | 1px `--color-line` border, background steps to `--color-ink-800` |
| `--elevation-2` | `--elevation-1` + `0 8px 24px -12px rgba(0,0,0,0.6)` |
| `--elevation-glow` | 1px indigo-tinted border + `0 0 0 1px` inset + soft indigo glow, reserved for focus/hover on interactive cards |

## Radius, duration, breakpoints

- Radius: `--radius-sm: 6px`, `--radius-md: 10px`, `--radius-lg: 16px`, `--radius-full: 999px`.
- Motion durations: `--duration-fast: 120ms`, `--duration-base: 200ms`, `--duration-slow: 400ms`,
  all paired with `--ease-standard: cubic-bezier(0.4, 0, 0.2, 1)`. Every
  transition in the project uses these four tokens — nothing hand-tuned.
- Breakpoints (mobile-first, min-width): `--bp-sm: 480px`, `--bp-md: 768px`,
  `--bp-lg: 1024px`, `--bp-xl: 1280px`. Since custom properties can't be used
  inside `@media` conditions, these are documented here and mirrored as plain
  numbers in `layout.css` with a comment pointing back to this table, and in
  `assets/js/config.js` for any JS that needs to match a breakpoint.

## Components (see `components.css` for implementation)

- **Buttons:** `primary` (solid indigo, ink-950 text), `secondary` (1px line
  border, transparent), `ghost` (no border, text-only, used in nav). All three
  share the same height, radius, and focus ring — only fill/border differ.
- **Cards:** one base `.card` (elevation-1, radius-lg, padding-6) with a
  `.card--interactive` modifier that adds hover elevation-glow and a
  translateY lift, used for project cards.
- **Forms:** not used on Contact (mailto-only per brief), but the base
  `input`/`label`/`textarea` styles still exist in `components.css` since
  they cost nothing extra to maintain and keep the system complete if a form
  is added later.
- **Navigation:** sticky, compact, mono breadcrumb signature described above,
  collapses to a full-screen overlay menu under `--bp-md` with a visible focus
  ring on every link and `aria-expanded` wired to the toggle button.
- **Icon sizing:** `--icon-sm: 16px`, `--icon-md: 20px`, `--icon-lg: 24px`,
  applied via a shared `.icon` class so every inline SVG inherits `currentColor`.

## Motion

One orchestrated entrance on the hero (staggered fade/rise of eyebrow → H1 →
subhead → CTA, `--duration-slow`), then only small, purposeful
micro-interactions elsewhere (card hover lift, button press, nav underline).
`prefers-reduced-motion: reduce` disables all transform/opacity entrance
animation and reduces transitions to near-instant, site-wide, in one media
query in `base.css` — not repeated per component.
