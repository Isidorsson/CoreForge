import type { ElementType } from "react"
import { Flag } from "lucide-react"
import type { metrics } from "@wails/go/models"

export function CharBoard({
  title,
  icon,
  rows,
  render,
}: {
  title: string
  icon: ElementType
  rows: metrics.CharRow[]
  render: (r: metrics.CharRow) => string
}) {
  const Icon = icon
  return (
    <section className="flex flex-col rounded-lg border border-border bg-card">
      <div className="flex items-center gap-2 border-b border-border px-3 py-2">
        <Icon className="size-3.5 text-muted-foreground" />
        <h3 className="text-sm font-semibold tracking-tight">{title}</h3>
      </div>
      <ol className="divide-y divide-border/60">
        {rows.length === 0 && <li className="px-3 py-6 text-center text-xs text-muted-foreground">No data</li>}
        {rows.map((r, i) => (
          <li key={`${r.name}-${i}`} className="flex items-center gap-2.5 px-3 py-1.5 text-xs">
            <span className="w-4 shrink-0 text-right tabular-nums text-muted-foreground">{i + 1}</span>
            <div className="min-w-0 flex-1">
              <p className="truncate font-medium leading-tight">{r.name}</p>
              <p className="truncate text-[11px] leading-tight text-muted-foreground">
                {r.race} {r.class} · {r.level}
              </p>
            </div>
            <span className="shrink-0 whitespace-nowrap text-right font-medium tabular-nums">{render(r)}</span>
          </li>
        ))}
      </ol>
    </section>
  )
}

export function GuildBoard({ rows }: { rows: metrics.GuildRow[] }) {
  return (
    <section className="flex flex-col rounded-lg border border-border bg-card">
      <div className="flex items-center gap-2 border-b border-border px-3 py-2">
        <Flag className="size-3.5 text-muted-foreground" />
        <h3 className="text-sm font-semibold tracking-tight">Largest guilds</h3>
      </div>
      <ol className="divide-y divide-border/60">
        {rows.length === 0 && <li className="px-3 py-6 text-center text-xs text-muted-foreground">No guilds</li>}
        {rows.map((g, i) => (
          <li key={`${g.name}-${i}`} className="flex items-center gap-2.5 px-3 py-1.5 text-xs">
            <span className="w-4 shrink-0 text-right tabular-nums text-muted-foreground">{i + 1}</span>
            <div className="min-w-0 flex-1">
              <p className="truncate font-medium leading-tight">{g.name}</p>
              <p className="truncate text-[11px] leading-tight text-muted-foreground">
                {g.leader || "—"} · avg lvl {Math.round(g.avgLevel)} · {g.active.toLocaleString()} active
                {g.created && ` · est. ${g.created}`}
              </p>
            </div>
            <div className="shrink-0 text-right leading-tight">
              <p className="whitespace-nowrap font-medium tabular-nums">{g.members.toLocaleString()}</p>
              <p className="text-[11px] text-muted-foreground">members</p>
            </div>
          </li>
        ))}
      </ol>
    </section>
  )
}
