import type { ElementType } from "react"
import { Users, UserCheck, Boxes, Globe, Ban, Crown, Gauge } from "lucide-react"
import { formatCompact } from "@/shared/lib/format"
import type { metrics } from "@wails/go/models"

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

export function KpiGrid({ o }: { o: metrics.Overview }) {
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
