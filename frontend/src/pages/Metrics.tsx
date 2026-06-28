import type { ElementType } from "react"
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
} from "lucide-react"
import { GetMetricsDBInfo } from "../../wailsjs/go/main/App"
import { useAppState, useMetrics } from "@/hooks/useAppData"
import { Button, Skeleton } from "@/components/ui/primitives"
import { PageHeader, NotConfigured, EmptyState } from "@/components/Page"
import { ChartCard, CategoryBars, Histogram, SplitDonut, Trend } from "@/components/charts"
import { formatGold, formatPlaytime, formatCompact, formatRelative, errorMessage } from "@/lib/format"
import type { metrics } from "../../wailsjs/go/models"

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
              <p className="truncate text-[11px] leading-tight text-muted-foreground">{g.leader || "—"}</p>
            </div>
            <span className="shrink-0 whitespace-nowrap text-right font-medium tabular-nums">{g.members.toLocaleString()}</span>
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
  const { data, error, isLoading, isFetching, refetch } = useMetrics()
  const { data: db } = useQuery({ queryKey: ["metricsDb"], queryFn: GetMetricsDBInfo, retry: false })

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
      <KpiGrid o={data.overview} />

      <div className="grid gap-3 lg:grid-cols-2">
        <ChartCard title="Class distribution" hint="living characters">
          <CategoryBars data={data.classes} />
        </ChartCard>
        <ChartCard title="Race distribution" hint="living characters">
          <CategoryBars data={data.races} />
        </ChartCard>
      </div>

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
        <ChartCard title="New accounts" hint="last 30 days">
          {data.signups.length ? <Trend data={data.signups} /> : <EmptyState icon={BarChart3} title="No recent signups" />}
        </ChartCard>
        <ChartCard title="Gold economy" hint="across living characters">
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
        <Database className="size-3" /> read-only · {data.overview.characters.toLocaleString()} characters scanned
      </div>
    </div>
  )
}
