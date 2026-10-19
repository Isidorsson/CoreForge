# Design

Visual system for CoreForge. Register: **product** (operator console). Theme name:
**Monochrome ops** (xAI / Grok-style). Dark-only (ships with `class="dark"` on `<html>`); light
tokens exist for completeness but are not a shipping target.

## Theme

A stark, pure-neutral charcoal environment with crisp white ink — black-and-white operator
equipment. Every neutral is true grayscale (chroma 0); **white is the primary action color**
(white fill, near-black text). Color appears only on small, heavily-desaturated semantic status
signals — and even then it stays muted enough that the overall impression is monochrome. No
hue in the chrome, no decorative accent. Legible, dense, responsive, unshowy.

## Color (OKLCH)

All neutrals are pure grayscale (**chroma 0**). Layers, dark → light, build depth so panels
read without borders doing all the work.

| Token | Dark value | Role |
|---|---|---|
| `--console` | `oklch(0.11 0 0)` | deepest void — terminal panes, log/console surfaces |
| `--background` | `oklch(0.15 0 0)` | app shell background |
| `--sidebar` | `oklch(0.13 0 0)` | recessed nav rail |
| `--card` / `--popover` | `oklch(0.19 0 0)` | raised panels, cards, dialogs |
| `--secondary` / `--muted` | `oklch(0.24 0 0)` | secondary fills, inert chips |
| `--accent` | `oklch(0.27 0 0)` | hover surfaces, selected rows |
| `--border` | `oklch(1 0 0 / 8%)` | hairline separators |
| `--border-strong` | `oklch(1 0 0 / 16%)` | emphasized edges, focus frames |
| `--input` | `oklch(1 0 0 / 12%)` | control borders |
| `--foreground` | `oklch(0.97 0 0)` | primary ink (18:1 on background) |
| `--muted-foreground` | `oklch(0.72 0 0)` | secondary ink (7.4:1 on card) |

**Primary (white) + signal colors** (state and primary action only, never decoration). Signals
are kept at chroma ≤ 0.11 so they read as muted accents on a black-and-white canvas:

| Token | Dark value | Meaning |
|---|---|---|
| `--primary` | `oklch(0.98 0 0)` | white — primary CTA / active / selection |
| `--primary-foreground` | `oklch(0.18 0 0)` | near-black ink on white fills (17.8:1) |
| `--ring` | `oklch(0.93 0 0)` | bright neutral focus ring |
| `--success` | `oklch(0.80 0.075 165)` | desaturated sage — running / ok / tailing |
| `--warning` | `oklch(0.83 0.10 85)` | muted amber — starting / stopping / unsaved |
| `--danger` / `--destructive` | `oklch(0.66 0.11 28)` | muted red — crashed / destructive (5.7:1 on card) |
| `--info` | `oklch(0.78 0.075 235)` | muted blue — informational |

**Color strategy:** Restrained → effectively monochrome. White carries action + active state;
the four semantics are state-only and desaturated. Contrast independently verified (WCAG): all
body/label pairs ≥ 4.5:1, all status-on-card ≥ 3:1 (danger ≥ 4.5:1).

## Typography

**One family: JetBrains Mono** (self-hosted via `@fontsource/jetbrains-mono`, weights
400/500/600/700). It is the default body family and carries nav, labels, buttons, data,
status, headings, and console output — the "mono everything" stance. A system **sans** stack
is the only secondary, reachable via `font-sans`, used sparingly for multi-line descriptive
prose where mono density would tire the eye.

Fixed rem scale (product register — no fluid clamp):

| Use | Size / weight |
|---|---|
| Page title (`h1`) | `text-xl` / 600, `tracking-tight` |
| Section / card title | `text-sm` / 600 |
| Body / control text | `text-sm` / 400–500 |
| Data, paths, metrics | `text-xs`–`text-sm` mono, often `tabular-nums` |
| Labels / column heads | `text-[11px]` uppercase, `tracking-wider`, muted — terminal idiom, used purposefully (column headers, group dividers), not as per-section eyebrows |

Numerals use `tabular-nums` wherever they tick or align (uptime, sizes, PIDs, line counts).

## Components

Shared vocabulary, every interactive element carrying default / hover / focus-visible /
active / disabled (+ loading where async):

- **Radius:** crisp. `--radius: 0.375rem` (6px) base; cards/inputs 6–8px; status pills + tags
  full-round. No 1px-border-plus-soft-shadow "ghost cards" — panels use a single hairline
  border on a raised surface, no decorative drop shadow.
- **Button:** `default` = white fill / near-black text, `secondary` = graphite fill, `outline`,
  `ghost`, `destructive` = muted red, `success`. Mono, medium weight. Focus = bright neutral ring.
- **StatusPill:** dot + label, color-blind-safe (shape+text+color). Tones: on (sage, steady
  dot), transition (amber, blinking dot), off (dim), error (red).
- **Card / panel:** raised `--card` surface, hairline border, mono titles, sans descriptions.
- **Inputs / textarea:** transparent fill on `--input` border, mono, neutral focus ring.
- **Command palette:** portal overlay (Ctrl/⌘K), fuzzy nav + process actions.
- **Skeletons** for content load; spinner only for inline button-scoped waits.
- **Empty states** teach the surface (what it is, how to begin), never just "nothing here."

## Layout

- App shell: collapsible icon/labeled nav rail (`--sidebar`), a slim terminal **system bar**
  header (core switcher · install path · DB/Auth/World status cluster), scrollable main.
- Responsive behavior is structural (the rail collapses to icons), not fluid type.
- Dashboard is a **cockpit**: a DB → Auth → World service-pipeline strip over a prominent
  console. Logs/Config are master-detail (list rail + terminal/editor pane). Spacing varies for
  rhythm: tight inside panels (`gap-2`/`gap-3`), looser between regions (`gap-4`/`p-5`).
- Semantic z-index: dropdown/menu `z-30` → sticky `z-40` → modal `z-50` → toast `z-60`.

## Motion

- 120–200 ms, ease-out. Transitions convey state only (open, select, status change).
- Liveness: blinking dot for transitional states and active log tail (CRT-cursor idiom).
- No page-load choreography; the app loads straight into the task.
- `@media (prefers-reduced-motion: reduce)`: blinks and transitions resolve to static states.
