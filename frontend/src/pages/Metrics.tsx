import type { ElementType, ReactNode } from "react"
import { useRef, useState } from "react"
import { useQuery } from "@tanstack/react-query"
import {
  BarChart3,
  Users,
  UserCheck,
  Boxes,
  Globe,
  Ban,
  Crown,
  Gauge,
  RefreshCw,
  Database,
  Coins,
  Clock,
  Trophy,
  Flag,
  AlertTriangle,
  X,
} from "lucide-react"
import { GetMetricsDBInfo } from "../../wailsjs/go/main/App"
import { useAppState, useMetrics } from "@/hooks/useAppData"
import { Button, Skeleton } from "@/components/ui/primitives"
import { PageHeader, NotConfigured, EmptyState } from "@/components/Page"
import { ChartCard, CategoryBars, GroupedBars, Histogram, SplitDonut, Trend } from "@/components/charts"
import { formatGold, formatPlaytime, formatCompact, formatRelative, errorMessage } from "@/lib/format"
import { cn } from "@/lib/utils"
import type { metrics } from "../../wailsjs/go/models"

/* -------------------------------- Filters --------------------------------- */
/* WotLK id spaces, mirrored from internal/metrics/lookup.go for the dropdowns. */

const RACES = [
  { id: 1, name: "Human" },
  { id: 3, name: "Dwarf" },
  { id: 4, name: "Night Elf" },
  { id: 7, name: "Gnome" },
  { id: 11, name: "Draenei" },
  { id: 2, name: "Orc" },
  { id: 5, name: "Undead" },
  { id: 6, name: "Tauren" },
  { id: 8, name: "Troll" },
  { id: 10, name: "Blood Elf" },
]
const CLASSES = [
  { id: 1, name: "Warrior" },
  { id: 2, name: "Paladin" },
  { id: 3, name: "Hunter" },
  { id: 4, name: "Rogue" },
  { id: 5, name: "Priest" },
  { id: 6, name: "Death Knight" },
  { id: 7, name: "Shaman" },
  { id: 8, name: "Mage" },
  { id: 9, name: "Warlock" },
  { id: 11, name: "Druid" },
]

const emptyFilter = (): metrics.Filter => ({
  faction: "",
  minLevel: 0,
  maxLevel: 0,
  activity: "",
  recentDays: 0,
  race: 0,
  class: 0,
})

const filterActive = (f: metrics.Filter): boolean =>
  Boolean(f.faction || f.minLevel || f.maxLevel || f.activity || f.race || f.class)

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex items-center gap-2">
      <span className="text-[10px] uppercase tracking-wider text-muted-foreground">{label}</span>
      {children}
    </div>
  )
}

function Segmented({
  value,
  onChange,
  options,
}: {
  value: string
  onChange: (v: string) => void
  options: { value: string; label: string }[]
}) {
  return (
    <div className="inline-flex rounded-md border border-border p-0.5">
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          onClick={() => onChange(o.value)}
          className={cn(
            "rounded px-2 py-0.5 text-xs transition-colors",
            value === o.value ? "bg-secondary text-foreground" : "text-muted-foreground hover:text-foreground",
          )}
        >
          {o.label}
        </button>
      ))}
    </div>
  )
}

/** Numeric box with no spinner arrows: hold-and-drag horizontally to scrub the
 *  value (4px per step), or click to type. Pointer capture keeps the drag alive
 *  outside the box; a tap that never crosses the threshold falls through to focus. */
function NumBox({ value, placeholder, onChange }: { value: number; placeholder: string; onChange: (n: number) => void }) {
  const drag = useRef<{ startX: number; startVal: number; moved: boolean } | null>(null)

  const onPointerDown = (e: React.PointerEvent<HTMLInputElement>) => {
    if (e.button !== 0) return
    drag.current = { startX: e.clientX, startVal: value, moved: false }
  }
  const onPointerMove = (e: React.PointerEvent<HTMLInputElement>) => {
    const d = drag.current
    if (!d) return
    const dx = e.clientX - d.startX
    if (!d.moved && Math.abs(dx) < 3) return
    if (!d.moved) {
      d.moved = true
      e.currentTarget.setPointerCapture(e.pointerId)
    }
    e.preventDefault()
    onChange(Math.max(0, d.startVal + Math.round(dx / 4)))
  }
  const onPointerUp = (e: React.PointerEvent<HTMLInputElement>) => {
    const d = drag.current
    drag.current = null
    if (d?.moved) {
      e.currentTarget.releasePointerCapture(e.pointerId)
      e.currentTarget.blur()
    }
  }

  return (
    <input
      type="text"
      inputMode="numeric"
      aria-label={`${placeholder} level`}
      value={value || ""}
      placeholder={placeholder}
      onChange={(e) => onChange(Math.max(0, parseInt(e.target.value.replace(/\D/g, ""), 10) || 0))}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      className="h-7 w-12 cursor-ew-resize select-none rounded-md border border-border bg-transparent px-2 text-center text-xs tabular-nums placeholder:text-muted-foreground/70 focus-visible:cursor-text focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/60"
    />
  )
}

function MiniSelect({
  value,
  onChange,
  options,
  allLabel,
}: {
  value: number
  onChange: (n: number) => void
  options: { id: number; name: string }[]
  allLabel: string
}) {
  return (
    <select
      value={value}
      onChange={(e) => onChange(parseInt(e.target.value, 10) || 0)}
      className="h-7 rounded-md border border-border bg-card px-2 text-xs text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/60 [&>option]:bg-card"
    >
      <option value={0}>{allLabel}</option>
      {options.map((o) => (
        <option key={o.id} value={o.id}>
          {o.name}
        </option>
      ))}
    </select>
  )
}

function FilterBar({ value, onChange }: { value: metrics.Filter; onChange: (f: metrics.Filter) => void }) {
  const set = (patch: Partial<metrics.Filter>) => onChange({ ...value, ...patch })
  return (
    <div className="flex flex-wrap items-center gap-x-4 gap-y-2 rounded-lg border border-border bg-card px-3 py-2">
      <Field label="Faction">
        <Segmented
          value={value.faction}
          onChange={(v) => set({ faction: v })}
          options={[
            { value: "", label: "All" },
            { value: "Alliance", label: "Alliance" },
            { value: "Horde", label: "Horde" },
          ]}
        />
      </Field>
      <Field label="Activity">
        <Segmented
          value={value.activity}
          onChange={(v) => set({ activity: v })}
          options={[
            { value: "", label: "All" },
            { value: "online", label: "Online" },
            { value: "recent", label: "Active 14d" },
          ]}
        />
      </Field>
      <Field label="Level">
        <div className="flex items-center gap-1">
          <NumBox value={value.minLevel} placeholder="min" onChange={(n) => set({ minLevel: n })} />
          <span className="text-xs text-muted-foreground">–</span>
          <NumBox value={value.maxLevel} placeholder="max" onChange={(n) => set({ maxLevel: n })} />
        </div>
      </Field>
      <Field label="Class">
        <MiniSelect value={value.class} onChange={(n) => set({ class: n })} options={CLASSES} allLabel="All classes" />
      </Field>
      <Field label="Race">
        <MiniSelect value={value.race} onChange={(n) => set({ race: n })} options={RACES} allLabel="All races" />
      </Field>
      {filterActive(value) && (
        <button
          type="button"
          onClick={() => onChange(emptyFilter())}
          className="ml-auto inline-flex items-center gap-1 text-xs text-muted-foreground transition-colors hover:text-foreground"
        >
          <X className="size-3" /> Reset
        </button>
      )}
    </div>
  )
}

/* --------------------------------- KPIs ----------------------------------- */

function Kpi({ icon: Icon, label, value, sub }: { icon: ElementType; label: string; value: string; sub?: string }) {
  return (
    <div className="flex items-center gap-3 rounded-lg border border-border bg-card p-3">
      <div className="flex size-9 shrink-0 items-center justify-center rounded-md bg-muted text-muted-foreground ring-1 ring-border">
        <Icon className="size-4" />
      </div>
      <div className="min-w-0 leading-tight">
        <p className="truncate text-[10px] uppercase tracking-wider text-muted-foreground">{label}</p>
        <p className="text-lg font-semibold tabular-nums">{value}</p>
        {sub && <p className="text-[11px] text-muted-foreground">{sub}</p>}
      </div>
    </div>
  )
}

function KpiGrid({ o }: { o: metrics.Overview }) {
  return (
    <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3 xl:grid-cols-4">
      <Kpi icon={Users} label="Accounts" value={formatCompact(o.accounts)} sub={`${formatCompact(o.activeAccounts)} active (30d)`} />
      <Kpi icon={Boxes} label="Characters" value={formatCompact(o.characters)} />
      <Kpi icon={Globe} label="Online now" value={o.onlineNow.toLocaleString()} />
      <Kpi icon={UserCheck} label="Guilds" value={formatCompact(o.guilds)} />
      <Kpi icon={Gauge} label="Avg level" value={o.avgLevel.toFixed(1)} />
      <Kpi icon={Crown} label="At level cap" value={formatCompact(o.maxLevelChars)} />
      <Kpi icon={Ban} label="Active bans" value={o.bannedAccounts.toLocaleString()} />
    </div>
  )
}

/* ------------------------------ Leaderboards ------------------------------ */

function CharBoard({
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

function GuildBoard({ rows }: { rows: metrics.GuildRow[] }) {
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

/* ------------------------------- States ----------------------------------- */

function LoadingState() {
  return (
    <div className="flex flex-col gap-4 p-5">
      <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3 xl:grid-cols-4">
        {Array.from({ length: 7 }).map((_, i) => (
          <Skeleton key={i} className="h-16" />
        ))}
      </div>
      <div className="grid gap-3 lg:grid-cols-2">
        {Array.from({ length: 4 }).map((_, i) => (
          <Skeleton key={i} className="h-64" />
        ))}
      </div>
    </div>
  )
}

function ConnectionError({ message, onRetry }: { message: string; onRetry: () => void }) {
  return (
    <div className="flex h-full flex-col items-center justify-center gap-4 p-8 text-center">
      <div className="flex size-12 items-center justify-center rounded-lg bg-danger/12 text-danger ring-1 ring-danger/25">
        <AlertTriangle className="size-6" />
      </div>
      <div>
        <p className="text-sm font-medium">Can't reach the database</p>
        <p className="mx-auto mt-1 max-w-md font-sans text-sm leading-relaxed text-muted-foreground">{message}</p>
        <p className="mx-auto mt-2 max-w-md font-sans text-xs leading-relaxed text-muted-foreground">
          Start the database from the Dashboard, or set manual credentials in Settings if the DB is on another host.
        </p>
      </div>
      <Button size="sm" onClick={onRetry}>
        <RefreshCw className="size-3.5" /> Retry
      </Button>
    </div>
  )
}

/* -------------------------------- Page ------------------------------------ */

export function Metrics() {
  const { data: state } = useAppState()
  const [filter, setFilter] = useState<metrics.Filter>(emptyFilter)
  const { data, error, isLoading, isFetching, refetch } = useMetrics(filter)
  const { data: db } = useQuery({ queryKey: ["metricsDb"], queryFn: GetMetricsDBInfo, retry: false })
  const active = filterActive(filter)
  const scope = active ? "match filter" : "scanned"

  if (state && !state.configured) return <NotConfigured />

  const header = (
    <PageHeader
      title="Metrics"
      description={
        db ? `${db.host}:${db.port} · ${db.charDb} (${db.source})` : "Player & realm statistics from the live database"
      }
      actions={
        <>
          {data && <span className="hidden text-[11px] text-muted-foreground sm:block">as of {formatRelative(data.generatedAt)}</span>}
          <Button size="sm" variant="secondary" loading={isFetching} onClick={() => refetch()}>
            <RefreshCw className="size-3.5" /> Refresh
          </Button>
        </>
      }
    />
  )

  if (isLoading) {
    return (
      <div className="flex h-full flex-col gap-4 p-5">
        {header}
        <LoadingState />
      </div>
    )
  }

  if (error || !data) {
    return (
      <div className="flex h-full flex-col gap-4 p-5">
        {header}
        <ConnectionError message={error ? errorMessage(error) : "No metrics returned."} onRetry={() => refetch()} />
      </div>
    )
  }

  return (
    <div className="flex h-full flex-col gap-4 overflow-auto p-5">
      {header}
      <FilterBar value={filter} onChange={setFilter} />
      <KpiGrid o={data.overview} />

      <div className="grid gap-3 lg:grid-cols-2">
        <ChartCard title="Class distribution" hint={active ? "filtered" : "living characters"}>
          <CategoryBars data={data.classes} />
        </ChartCard>
        <ChartCard title="Race distribution" hint={active ? "filtered" : "living characters"}>
          <CategoryBars data={data.races} />
        </ChartCard>
      </div>

      <ChartCard title="Class popularity by faction" hint="Alliance vs Horde">
        <GroupedBars data={data.classFaction} height={280} />
      </ChartCard>

      <div className="grid gap-3 lg:grid-cols-3">
        <ChartCard title="Level distribution" hint="by bracket" className="lg:col-span-2">
          <Histogram data={data.levels} />
        </ChartCard>
        <div className="grid gap-3">
          <ChartCard title="Faction">
            <SplitDonut data={data.factions} height={150} />
          </ChartCard>
          <ChartCard title="Gender">
            <SplitDonut data={data.genders} height={150} />
          </ChartCard>
        </div>
      </div>

      <div className="grid gap-3 lg:grid-cols-2">
        <ChartCard title="Wealth distribution" hint="characters per gold band">
          <Histogram data={data.wealth} />
        </ChartCard>
        <ChartCard title="Playtime distribution" hint="characters per /played band">
          <Histogram data={data.playtimeDist} />
        </ChartCard>
      </div>

      <div className="grid gap-3 lg:grid-cols-2">
        <ChartCard title="New accounts" hint="last 30 days">
          {data.signups.length ? <Trend data={data.signups} /> : <EmptyState icon={BarChart3} title="No recent signups" />}
        </ChartCard>
        <ChartCard title="Gold economy" hint={active ? "filtered set" : "across living characters"}>
          <div className="flex h-full flex-col justify-center gap-3 px-1">
            <div className="flex items-end justify-between border-b border-border/60 pb-3">
              <span className="flex items-center gap-2 text-xs uppercase tracking-wider text-muted-foreground">
                <Coins className="size-3.5" /> Total gold
              </span>
              <span className="text-2xl font-semibold tabular-nums">{formatGold(data.economy.totalCopper)}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-xs uppercase tracking-wider text-muted-foreground">Average per character</span>
              <span className="text-lg font-semibold tabular-nums">{Math.round(data.economy.avgGold).toLocaleString()}g</span>
            </div>
          </div>
        </ChartCard>
      </div>

      <div className="grid gap-3 lg:grid-cols-2 xl:grid-cols-4">
        <CharBoard title="Richest" icon={Coins} rows={data.economy.richest} render={(r) => formatGold(r.value)} />
        <CharBoard title="Most played" icon={Clock} rows={data.topPlaytime} render={(r) => formatPlaytime(r.value)} />
        <CharBoard title="Highest level" icon={Trophy} rows={data.topLevel} render={(r) => `lvl ${r.level}`} />
        <GuildBoard rows={data.topGuilds} />
      </div>

      <div className="flex items-center justify-center gap-1.5 pb-1 text-[11px] text-muted-foreground">
        <Database className="size-3" /> read-only · {data.overview.characters.toLocaleString()} characters {scope}
      </div>
    </div>
  )
}
