/*
 * Dot-matrix "quantum dot" loaders. Pure white (currentColor → --color-foreground)
 * on dark, matching the monochrome console theme. All animation is CSS (the
 * shared `dot-pulse` keyframe) so dozens can run across the app cheaply.
 *
 * Determinate variants take `progress` (0–100); omit it for an indeterminate
 * (animated) loader. Color follows the parent's text color — wrap in any text-*
 * class to tint, or leave white.
 *
 *   <DotSpinner />                inline "loading…" spinner
 *   <DotPulse />                  three-dot inline pulse
 *   <DotRing progress={78} label="SYNCING" />   circular progress
 *   <DotRing />                   indeterminate ring
 *   <DotBar progress={40} />      matrix progress bar
 *   <DotBar />                    indeterminate sweep
 *   <DotText text="PROCESSING…" animated />      dot-matrix text
 */
import * as React from "react"
import { cn } from "@/lib/utils"
import { FONT, DOT_GLYPH_W, DOT_GLYPH_H } from "./dotFont"

const PULSE = (delaySec: number, durSec: number): React.CSSProperties => ({
  animation: `dot-pulse ${durSec}s linear infinite`,
  animationDelay: `${delaySec}s`,
})

/* ------------------------------ DotSpinner -------------------------------- */

/** Small ring of dots that chase — the default inline "loading" indicator. */
export function DotSpinner({
  size = 22,
  count = 8,
  className,
}: {
  size?: number
  count?: number
  className?: string
}) {
  const c = size / 2
  const r = c - size * 0.13
  const dot = size * 0.11
  return (
    <svg
      width={size}
      height={size}
      viewBox={`0 0 ${size} ${size}`}
      className={cn("text-foreground", className)}
      role="status"
      aria-label="Loading"
    >
      {Array.from({ length: count }).map((_, i) => {
        const a = (i / count) * 2 * Math.PI - Math.PI / 2
        return (
          <circle
            key={i}
            cx={c + r * Math.cos(a)}
            cy={c + r * Math.sin(a)}
            r={dot}
            fill="currentColor"
            style={PULSE(-(i / count) * 1, 1)}
          />
        )
      })}
    </svg>
  )
}

/* ------------------------------- DotPulse --------------------------------- */

/** Three dots pulsing in sequence — tiny inline "working…" affordance. */
export function DotPulse({ className }: { className?: string }) {
  return (
    <span className={cn("inline-flex items-center gap-1 text-foreground", className)} role="status" aria-label="Loading">
      {[0, 1, 2].map((i) => (
        <span key={i} className="size-1.5 rounded-full bg-current" style={PULSE(-i * 0.18, 1)} />
      ))}
    </span>
  )
}

/* -------------------------------- DotRing --------------------------------- */

/** Circular dot ring. With `progress` it fills clockwise; without, it spins. */
export function DotRing({
  progress,
  size = 132,
  count = 60,
  label,
  sublabel,
  showPercent = true,
  className,
}: {
  progress?: number
  size?: number
  count?: number
  label?: React.ReactNode
  sublabel?: React.ReactNode
  showPercent?: boolean
  className?: string
}) {
  const glow = React.useId()
  const c = size / 2
  const r = c - size * 0.09
  const dot = size * 0.028
  const indeterminate = progress == null
  const frac = indeterminate ? 0 : Math.max(0, Math.min(100, progress)) / 100

  const dots = Array.from({ length: count }).map((_, i) => {
    const a = (i / count) * 2 * Math.PI - Math.PI / 2
    const on = indeterminate || i / count <= frac
    return {
      key: i,
      cx: c + r * Math.cos(a),
      cy: c + r * Math.sin(a),
      on,
      style: indeterminate ? PULSE(-(i / count) * 1.3, 1.3) : undefined,
    }
  })

  return (
    <div
      className={cn("relative inline-grid place-items-center text-foreground", className)}
      style={{ width: size, height: size }}
      role="status"
      aria-label={typeof label === "string" ? label : "Loading"}
    >
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="absolute inset-0">
        <defs>
          <filter id={glow}>
            <feGaussianBlur stdDeviation={size * 0.018} />
          </filter>
        </defs>
        <g filter={`url(#${glow})`} opacity={0.55}>
          {dots.map((d) => (
            <circle key={`g${d.key}`} cx={d.cx} cy={d.cy} r={dot} fill="currentColor" opacity={d.on ? 1 : 0} style={d.style} />
          ))}
        </g>
        {dots.map((d) => (
          <circle key={d.key} cx={d.cx} cy={d.cy} r={dot} fill="currentColor" opacity={d.on ? 1 : 0.16} style={d.style} />
        ))}
      </svg>
      {(label || sublabel || (showPercent && !indeterminate)) && (
        <div className="relative z-10 text-center leading-tight">
          {label && <div className="text-sm font-semibold uppercase tracking-[0.15em]">{label}</div>}
          {showPercent && !indeterminate && (
            <div className="text-xs tabular-nums text-muted-foreground">{Math.round(progress!)}%</div>
          )}
          {sublabel && <div className="mt-0.5 text-[11px] text-muted-foreground">{sublabel}</div>}
        </div>
      )}
    </div>
  )
}

/* --------------------------------- DotBar --------------------------------- */

/** Matrix progress bar. `progress` fills columns left→right; omit for a sweep. */
export function DotBar({
  progress,
  rows = 4,
  cols = 28,
  width = 220,
  className,
}: {
  progress?: number
  rows?: number
  cols?: number
  width?: number
  className?: string
}) {
  const indeterminate = progress == null
  const litCols = indeterminate ? 0 : Math.round((Math.max(0, Math.min(100, progress)) / 100) * cols)
  const gap = Math.max(2, Math.round((width / cols) * 0.32))

  return (
    <div
      className={cn("grid text-foreground", className)}
      style={{ width, gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))`, gap }}
      role="progressbar"
      aria-valuenow={indeterminate ? undefined : Math.round(progress!)}
      aria-valuemin={0}
      aria-valuemax={100}
    >
      {Array.from({ length: rows * cols }).map((_, idx) => {
        const col = idx % cols
        const on = !indeterminate && col < litCols
        return (
          <span
            key={idx}
            className={cn("aspect-square rounded-full bg-current", on && "shadow-[0_0_5px_currentColor]")}
            style={
              indeterminate
                ? PULSE(-(col / cols) * 1.4, 1.4)
                : { opacity: on ? 1 : 0.14 }
            }
          />
        )
      })}
    </div>
  )
}

/* -------------------------------- DotText --------------------------------- */

/** Renders short text as a dot-matrix sign. `animated` adds a left→right shimmer. */
export function DotText({
  text,
  dot = 3,
  gap = 1,
  letterSpacing = 2,
  animated = false,
  className,
}: {
  text: string
  dot?: number
  gap?: number
  letterSpacing?: number
  animated?: boolean
  className?: string
}) {
  const chars = text.toUpperCase().split("")
  let colCursor = 0
  const totalCols = chars.length * (DOT_GLYPH_W + 1)

  return (
    <div
      className={cn("inline-flex items-center text-foreground", className)}
      style={{ gap: letterSpacing }}
      role="img"
      aria-label={text}
    >
      {chars.map((ch, ci) => {
        const glyph = FONT[ch] ?? FONT[" "]
        const base = colCursor
        colCursor += DOT_GLYPH_W + 1
        return (
          <div
            key={ci}
            className="grid"
            style={{ gridTemplateColumns: `repeat(${DOT_GLYPH_W}, ${dot}px)`, gridAutoRows: `${dot}px`, gap }}
          >
            {Array.from({ length: DOT_GLYPH_H }).flatMap((_, ri) =>
              glyph[ri].split("").map((cell, xi) => {
                const lit = cell === "#"
                const wave = animated ? PULSE(-((base + xi) / totalCols) * 1.6, 1.6) : undefined
                return (
                  <span
                    key={`${ri}-${xi}`}
                    className="rounded-full bg-current"
                    style={{
                      width: dot,
                      height: dot,
                      opacity: lit ? 1 : 0.07,
                      ...(lit ? wave : undefined),
                    }}
                  />
                )
              }),
            )}
          </div>
        )
      })}
    </div>
  )
}
