/*
 * Dot-matrix "quantum dot" loaders. Pure white (currentColor → --color-foreground)
 * on dark, matching the monochrome console theme. All animation is CSS (the
 * shared `dot-pulse` keyframe) so dozens can run across the app cheaply.
 *
 * Bloom: SVG loaders stack two blur passes (tight + wide) under the sharp dots;
 * CSS-dot loaders use the .dot-glow / .dot-glow-sm halo classes (style.css).
 *
 * Determinate variants take `progress` (0–100); omit for an indeterminate loader.
 * Color follows the parent's text color — wrap in any text-* class to tint.
 *
 *   <DotSpinner />                inline "loading…" spinner
 *   <DotPulse />                  three-dot inline pulse
 *   <DotRing progress={78} label="SYNCING" />   circular progress (annulus)
 *   <DotRing />                   indeterminate ring
 *   <DotBar progress={40} />      matrix progress bar
 *   <DotText text="PROCESSING…" animated />      dot-matrix text
 */
import * as React from "react"
import { cn } from "@/shared/lib/utils"
import { FONT, DOT_GLYPH_W, DOT_GLYPH_H } from "./dotFont"

const clamp = (n: number) => Math.max(0, Math.min(100, n))

/** Seeded unit-noise (render-stable): a dot keeps its jitter across re-renders. */
const hashUnit = (n: number) => {
  const x = Math.sin(n * 127.1 + 311.7) * 43758.5453
  return x - Math.floor(x)
}

const smoothstep = (e0: number, e1: number, x: number) => {
  const t = Math.max(0, Math.min(1, (x - e0) / (e1 - e0)))
  return t * t * (3 - 2 * t)
}

const PULSE = (delaySec: number, durSec: number): React.CSSProperties => ({
  animation: `dot-pulse ${durSec}s linear infinite`,
  animationDelay: `${delaySec}s`,
})

/** Two-pass Gaussian bloom (tight core halo + wide soft halo) for SVG dots. */
function Bloom({ id, tight, wide }: { id: string; tight: number; wide: number }) {
  return (
    <filter id={id} x="-75%" y="-75%" width="250%" height="250%" colorInterpolationFilters="sRGB">
      <feGaussianBlur in="SourceGraphic" stdDeviation={tight} result="t" />
      <feGaussianBlur in="SourceGraphic" stdDeviation={wide} result="w" />
      <feMerge>
        <feMergeNode in="w" />
        <feMergeNode in="t" />
      </feMerge>
    </filter>
  )
}

/* ------------------------------ DotSpinner -------------------------------- */

/** Comet ring — a bright head trailing into dim, smaller dots; spins as one. */
export function DotSpinner({
  size = 24,
  count = 9,
  className,
}: {
  size?: number
  count?: number
  className?: string
}) {
  const glow = React.useId()
  const c = size / 2
  const r = c - size * 0.16
  const dot = size * 0.1
  const dots = Array.from({ length: count }).map((_, i) => {
    const a = (i / count) * 2 * Math.PI - Math.PI / 2
    const t = i / (count - 1) // 0 = tail, 1 = head
    return {
      key: i,
      cx: c + r * Math.cos(a),
      cy: c + r * Math.sin(a),
      r: dot * (0.5 + 0.6 * t),
      op: 0.16 + 0.84 * t,
    }
  })
  return (
    <svg
      width={size}
      height={size}
      viewBox={`0 0 ${size} ${size}`}
      className={cn("text-foreground", className)}
      role="status"
      aria-label="Loading"
    >
      <defs>
        <Bloom id={glow} tight={size * 0.014} wide={size * 0.04} />
      </defs>
      <g
        filter={`url(#${glow})`}
        style={{ transformBox: "fill-box", transformOrigin: "center", animation: "dot-spin 0.9s linear infinite" }}
      >
        {dots.map((d) => (
          <circle key={d.key} cx={d.cx} cy={d.cy} r={d.r} fill="currentColor" opacity={d.op} />
        ))}
      </g>
    </svg>
  )
}

/* ------------------------------- DotPulse --------------------------------- */

/** Three dots pulsing in sequence — tiny inline "working…" affordance. */
export function DotPulse({ className }: { className?: string }) {
  return (
    <span className={cn("inline-flex items-center gap-1.5 text-foreground", className)} role="status" aria-label="Loading">
      {[0, 1, 2].map((i) => (
        <span key={i} className="dot-glow size-1.5 rounded-full bg-current" style={PULSE(-i * 0.18, 1)} />
      ))}
    </span>
  )
}

/* -------------------------------- DotRing --------------------------------- */

/**
 * Circular "stardust" gauge. Dots scatter across several bands with seeded
 * radial/size/brightness jitter so the ring reads as a particle cloud, not a
 * clean annulus. With `progress` it fills clockwise behind a bright leading
 * head and an outer sweep arc; without, the whole cloud swirls and pulses.
 */
export function DotRing({
  progress,
  size = 140,
  bands = 3,
  label,
  sublabel,
  showPercent = true,
  arc = true,
  className,
}: {
  progress?: number
  size?: number
  bands?: number
  label?: React.ReactNode
  sublabel?: React.ReactNode
  showPercent?: boolean
  arc?: boolean
  className?: string
}) {
  const glow = React.useId()
  const headBloom = React.useId()
  const c = size / 2
  const rOuter = c - size * 0.085
  const dotR = size * 0.017
  const bandGap = dotR * 2.4
  const indeterminate = progress == null
  const frac = indeterminate ? 0 : clamp(progress) / 100
  const rMid = rOuter - ((bands - 1) / 2) * bandGap

  type Dot = { key: string; cx: number; cy: number; r: number; op: number; style?: React.CSSProperties }
  const dots: Dot[] = []
  for (let b = 0; b < bands; b++) {
    const rb = rOuter - b * bandGap
    const countb = Math.max(10, Math.round((2 * Math.PI * rb) / (dotR * 2.1)))
    for (let i = 0; i < countb; i++) {
      const seed = b * 1009 + i * 13
      const j1 = hashUnit(seed) // radial offset
      const j2 = hashUnit(seed + 4.7) // angular offset
      const j3 = hashUnit(seed + 9.1) // size + brightness
      const af = (i + (j2 - 0.5) * 0.3) / countb
      const ang = af * 2 * Math.PI - Math.PI / 2
      const rr = rb + (j1 - 0.5) * bandGap * 0.4
      const lit = indeterminate || af <= frac + 1e-3
      const headBoost = lit && !indeterminate ? smoothstep(0.12, 0, frac - af) : 0
      dots.push({
        key: `${b}-${i}`,
        cx: c + rr * Math.cos(ang),
        cy: c + rr * Math.sin(ang),
        r: dotR * (0.5 + j3 * 0.85) + headBoost * dotR * 0.8,
        op: lit ? Math.min(1, 0.58 + j3 * 0.32 + headBoost * 0.42) : 0.06 + j3 * 0.06,
        style: indeterminate ? PULSE(-af * 1.4, 1.7) : undefined,
      })
    }
  }

  const headAng = frac * 2 * Math.PI - Math.PI / 2
  const headX = c + rMid * Math.cos(headAng)
  const headY = c + rMid * Math.sin(headAng)
  const arcR = rOuter + dotR * 2.2
  const spin = (durSec: number): React.CSSProperties => ({
    transformBox: "fill-box",
    transformOrigin: "center",
    animation: `dot-spin ${durSec}s linear infinite`,
  })
  const gaugeArc = (r: number, sw: number, op: number) => (
    <circle
      cx={c}
      cy={c}
      r={r}
      fill="none"
      stroke="currentColor"
      strokeWidth={sw}
      strokeLinecap="round"
      pathLength={100}
      strokeDasharray={indeterminate ? "20 100" : `${frac * 100} 100`}
      transform={indeterminate ? undefined : `rotate(-90 ${c} ${c})`}
      filter={`url(#${glow})`}
      opacity={op}
      style={indeterminate ? spin(2.6) : undefined}
    />
  )

  return (
    <div
      className={cn("relative inline-grid place-items-center text-foreground", className)}
      style={{ width: size, height: size }}
      role="status"
      aria-label={typeof label === "string" ? label : "Loading"}
    >
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="absolute inset-0">
        <defs>
          <Bloom id={glow} tight={size * 0.008} wide={size * 0.02} />
          <Bloom id={headBloom} tight={size * 0.014} wide={size * 0.038} />
        </defs>

        {arc && (
          <>
            <circle cx={c} cy={c} r={arcR + size * 0.032} fill="none" stroke="currentColor" strokeWidth={size * 0.005} opacity={0.06} />
            {gaugeArc(arcR, size * 0.011, 0.9)}
            {gaugeArc(arcR + size * 0.032, size * 0.007, 0.5)}
          </>
        )}

        <g style={indeterminate ? spin(14) : undefined}>
          <g filter={`url(#${glow})`} opacity={0.55}>
            {dots.map((d) => (
              <circle key={`g${d.key}`} cx={d.cx} cy={d.cy} r={d.r * 1.1} fill="currentColor" opacity={d.op} style={d.style} />
            ))}
          </g>
          {dots.map((d) => (
            <circle key={d.key} cx={d.cx} cy={d.cy} r={d.r} fill="currentColor" opacity={d.op} style={d.style} />
          ))}
        </g>

        {!indeterminate && frac > 0.01 && (
          <circle cx={headX} cy={headY} r={dotR * 1.9} fill="currentColor" filter={`url(#${headBloom})`} />
        )}
      </svg>
      {(label || sublabel || (showPercent && !indeterminate)) && (
        <div className="relative z-10 text-center leading-tight [text-shadow:0_0_12px_color-mix(in_oklch,currentColor_45%,transparent)]">
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
  const litCols = indeterminate ? 0 : Math.round((clamp(progress) / 100) * cols)
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
            className="dot-glow aspect-square rounded-full bg-current"
            style={indeterminate ? PULSE(-(col / cols) * 1.4, 1.4) : { opacity: on ? 1 : 0.1 }}
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
                    className={cn("rounded-full bg-current", lit && "dot-glow-sm")}
                    style={{
                      width: dot,
                      height: dot,
                      opacity: lit ? 1 : 0.06,
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
