# Product

## Register

product

## Users

Self-hosting WoW emulator operators — hobbyists and small private-server admins running
TrinityCore or AzerothCore on their own Windows machine. They are technical enough to edit
`.conf` files and run Docker, but they want a single desk to start/stop the stack, watch
console output, edit config safely, and clean up disk — without juggling terminals, Services,
and Explorer windows. Context of use: a local desktop app, often left open beside the running
game server, glanced at and acted on rather than read.

## Product Purpose

CoreForge is a Wails desktop control panel for a local TrinityCore/AzerothCore server stack:
database (MariaDB via Docker), auth server, and world server. It exists to make operating a
private server feel like driving a console, not babysitting processes. Success = an operator
can bring the whole stack up, send a world command, tail a crash log, and roll back a bad
config edit, all without leaving the window or touching a raw shell.

Secondary purpose: it is a portfolio showcase of full-stack craft (Go + Wails + React 19 +
Tailwind v4), so the interface should read as deliberately designed, not template-assembled.

## Brand Personality

Operator-grade. Precise, fast, unhurried. Three words: **terminal, exact, calm.** The tool
should feel like professional ops equipment — every number trustworthy, every action one
keystroke away, nothing decorative competing with the data. It speaks in monospace because it
is talking about processes, PIDs, paths, and log lines. Confidence comes from legibility and
responsiveness, not from flourish.

## Anti-references

- **Default shadcn dark dashboard** (slate-252 neutrals + one accent). The starting point was
  exactly this; the redesign exists to escape it.
- **Gamer-RGB / neon glassmorphism** server panels (Pterodactyl-style gradient cards, glowing
  bevels). Looks like a product, not a tool.
- **Generic SaaS admin** (rounded pastel cards, hero metric tiles, marketing-grade empty
  states). Wrong register entirely — this is an operator console, not a growth dashboard.
- **Skeuomorphic "fantasy WoW UI"** (parchment, gold filigree, gryphon frames). On-theme but
  illegible and slow.

## Design Principles

1. **The data is the design.** PIDs, uptimes, sizes, line counts, paths — render them in mono
   and let them carry the surface. Chrome stays out of the way.
2. **Every action is reachable two ways.** Pointer and keyboard. A command palette and direct
   controls; nothing hides behind a single affordance.
3. **State is always legible.** Running / starting / stopped / crashed must be distinguishable
   at a glance and color-blind-safe (shape + label + color, never color alone).
4. **Honest instrumentation.** Never invent metrics the backend doesn't emit. Show what is
   true; leave the rest blank with an em dash.
5. **Calm under load.** Motion conveys state changes and liveness (tailing, transitions) only —
   never decoration, never page-load choreography.

## Accessibility & Inclusion

- Target WCAG 2.1 AA: body/label text ≥ 4.5:1, large/UI text ≥ 3:1 against its own surface.
- Status is never encoded by color alone — always paired with a label and a dot/shape.
- Full keyboard operability: focus-visible rings on every interactive element, command palette
  (Ctrl/⌘K) for navigation and process actions, Esc to dismiss overlays.
- `prefers-reduced-motion` honored: liveness blinks and transitions degrade to static states.
