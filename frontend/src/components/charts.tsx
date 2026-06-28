/*
 * Monochrome recharts wrappers. The console theme is pure-neutral with white ink
 * as the only "accent", so charts read black-and-white: a single ink fill for
 * series, graded greys only where two slices must be told apart. All colors come
 * from the CSS theme variables so light/dark and future re-skins just work.
 */
import * as React from "react"
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Cell,
  Tooltip,
  PieChart,
  Pie,
  AreaChart,
  Area,
  LabelList,
} from "recharts"
import type { metrics } from "../../wailsjs/go/models"
import { cn } from "@/lib/utils"

const INK = "var(--color-foreground)"
const SUB = "var(--color-muted-foreground)"
const GRID = "var(--color-border)"

const axisTick = { fontSize: 11, fill: SUB }
const tooltipStyle = {
  background: "var(--color-popover)",
  border: "1px solid var(--color-border-strong)",
  borderRadius: 8,
  fontSize: 12,
  padding: "6px 10px",
  color: "var(--color-popover-foreground)",
} as const
const tooltipCursor = { fill: "var(--color-accent)", opacity: 0.35 }

/** Titled chart panel — standard surface for every visualization. */
export function ChartCard({
  title,
  hint,
  className,
  children,
}: {
  title: string
  hint?: string
  className?: string
  children: React.ReactNode
}) {
  return (
    <section className={cn("flex flex-col rounded-lg border border-border bg-card p-3", className)}>
      <div className="mb-2 flex items-baseline justify-between gap-2">
        <h3 className="text-sm font-semibold tracking-tight">{title}</h3>
        {hint && <span className="text-[11px] text-muted-foreground">{hint}</span>}
      </div>
      <div className="min-h-0 flex-1">{children}</div>
    </section>
  )
}

/** Horizontal bars for many labelled categories (race, class). */
export function CategoryBars({ data, height = 240 }: { data: metrics.Slice[]; height?: number }) {
  return (
    <ResponsiveContainer width="100%" height={height}>
      <BarChart data={data} layout="vertical" margin={{ top: 2, right: 28, bottom: 2, left: 4 }}>
        <XAxis type="number" hide />
        <YAxis
          type="category"
          dataKey="label"
          width={92}
          tick={axisTick}
          tickLine={false}
          axisLine={false}
        />
        <Tooltip contentStyle={tooltipStyle} cursor={tooltipCursor} formatter={(v: number) => [v.toLocaleString(), "Characters"]} />
        <Bar dataKey="count" fill={INK} radius={[0, 3, 3, 0]} maxBarSize={18}>
          <LabelList dataKey="count" position="right" className="fill-muted-foreground" fontSize={10} formatter={(v: number) => v.toLocaleString()} />
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  )
}

/** Vertical histogram for ordered bins (level distribution). */
export function Histogram({ data, height = 240 }: { data: metrics.Bucket[]; height?: number }) {
  return (
    <ResponsiveContainer width="100%" height={height}>
      <BarChart data={data} margin={{ top: 8, right: 8, bottom: 2, left: 0 }}>
        <XAxis dataKey="label" tick={axisTick} tickLine={false} axisLine={{ stroke: GRID }} interval={0} angle={-35} textAnchor="end" height={48} />
        <YAxis tick={axisTick} tickLine={false} axisLine={false} width={36} />
        <Tooltip contentStyle={tooltipStyle} cursor={tooltipCursor} formatter={(v: number) => [v.toLocaleString(), "Characters"]} />
        <Bar dataKey="count" fill={INK} radius={[3, 3, 0, 0]} maxBarSize={40} />
      </BarChart>
    </ResponsiveContainer>
  )
}

/** Two-slice donut for binary splits (faction, gender). */
export function SplitDonut({ data, height = 200 }: { data: metrics.Slice[]; height?: number }) {
  const shades = [INK, "color-mix(in oklch, var(--color-muted-foreground) 85%, transparent)"]
  const total = data.reduce((s, d) => s + d.count, 0)
  return (
    <div className="flex items-center gap-3">
      <div className="relative" style={{ width: "55%" }}>
        <ResponsiveContainer width="100%" height={height}>
          <PieChart>
            <Pie data={data} dataKey="count" nameKey="label" innerRadius="58%" outerRadius="86%" paddingAngle={2} stroke="var(--color-card)" strokeWidth={2}>
              {data.map((_, i) => (
                <Cell key={i} fill={shades[i % shades.length]} />
              ))}
            </Pie>
          </PieChart>
        </ResponsiveContainer>
        <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center leading-none">
          <span className="text-lg font-semibold tabular-nums">{total.toLocaleString()}</span>
          <span className="mt-0.5 text-[10px] uppercase tracking-wider text-muted-foreground">total</span>
        </div>
      </div>
      <ul className="flex-1 space-y-1.5">
        {data.map((d, i) => {
          const pct = total ? Math.round((d.count / total) * 100) : 0
          return (
            <li key={d.key} className="flex items-center gap-2 text-xs">
              <span className="size-2.5 shrink-0 rounded-sm" style={{ background: shades[i % shades.length] }} />
              <span className="flex-1 truncate">{d.label}</span>
              <span className="font-medium tabular-nums">{pct}%</span>
              <span className="w-12 text-right tabular-nums text-muted-foreground">{d.count.toLocaleString()}</span>
            </li>
          )
        })}
      </ul>
    </div>
  )
}

/** Filled area trend over time (daily account signups). */
export function Trend({ data, height = 200 }: { data: metrics.TimePoint[]; height?: number }) {
  return (
    <ResponsiveContainer width="100%" height={height}>
      <AreaChart data={data} margin={{ top: 8, right: 8, bottom: 2, left: 0 }}>
        <defs>
          <linearGradient id="trendFill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={INK} stopOpacity={0.28} />
            <stop offset="100%" stopColor={INK} stopOpacity={0} />
          </linearGradient>
        </defs>
        <XAxis dataKey="date" tick={axisTick} tickLine={false} axisLine={{ stroke: GRID }} minTickGap={28} tickFormatter={(d: string) => d.slice(5)} />
        <YAxis tick={axisTick} tickLine={false} axisLine={false} width={32} allowDecimals={false} />
        <Tooltip contentStyle={tooltipStyle} cursor={{ stroke: SUB, strokeDasharray: "3 3" }} formatter={(v: number) => [v.toLocaleString(), "New accounts"]} />
        <Area type="monotone" dataKey="count" stroke={INK} strokeWidth={1.5} fill="url(#trendFill)" />
      </AreaChart>
    </ResponsiveContainer>
  )
}
