import { useState } from "react"
import { useQuery } from "@tanstack/react-query"
import { BarChart3, RefreshCw, Database, Coins, Clock, Trophy } from "lucide-react"
import { GetMetricsDBInfo } from "@wails/go/main/App"
import { useAppState, useMetrics } from "@/shared/hooks/useAppData"
import { Button } from "@/shared/ui/primitives"
import { PageHeader, NotConfigured, EmptyState } from "@/shared/ui/Page"
import { formatGold, formatPlaytime, formatRelative, errorMessage } from "@/shared/lib/format"
import type { metrics } from "@wails/go/models"
import { ChartCard, CategoryBars, GroupedBars, Histogram, SplitDonut, Trend } from "./charts"
import { FilterBar, emptyFilter, filterActive } from "./FilterBar"
import { KpiGrid } from "./KpiGrid"
import { CharBoard, GuildBoard } from "./Leaderboards"
import { LoadingState, ConnectionError } from "./MetricsStates"

export function MetricsPage() {
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
