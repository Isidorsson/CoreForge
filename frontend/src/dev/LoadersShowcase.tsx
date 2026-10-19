import { useEffect, useState } from "react"
import { DotSpinner, DotPulse, DotRing, DotBar, DotText } from "@/shared/ui/loaders"
import { PageHeader } from "@/shared/ui/Page"

/** Dev gallery for the dot-matrix loader set. Reachable at #/loaders. */
function Cell({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col items-center justify-center gap-4 rounded-lg border border-border bg-card p-6">
      <div className="flex min-h-24 items-center justify-center">{children}</div>
      <span className="text-[11px] uppercase tracking-wider text-muted-foreground">{label}</span>
    </div>
  )
}

export function LoadersShowcase() {
  const [pct, setPct] = useState(8)
  useEffect(() => {
    const id = window.setInterval(() => setPct((p) => (p >= 100 ? 0 : p + 1)), 80)
    return () => window.clearInterval(id)
  }, [])

  return (
    <div className="flex h-full flex-col gap-4 overflow-auto p-5">
      <PageHeader title="Loaders" description="Reusable dot-matrix loaders — white quantum dots on dark" />

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        <Cell label="DotSpinner — inline loading">
          <div className="flex items-center gap-3">
            <DotSpinner />
            <span className="text-sm text-muted-foreground">Loading…</span>
          </div>
        </Cell>

        <Cell label="DotPulse — tiny inline">
          <div className="flex items-center gap-2">
            <span className="text-sm">Saving</span>
            <DotPulse />
          </div>
        </Cell>

        <Cell label="DotText — animated sign">
          <DotText text="PROCESSING…" animated />
        </Cell>

        <Cell label="DotRing — determinate">
          <DotRing progress={pct} label="SYNCING" />
        </Cell>

        <Cell label="DotRing — indeterminate">
          <DotRing size={110} />
        </Cell>

        <Cell label="DotRing — compact + sublabel">
          <DotRing progress={pct} size={104} showPercent={false} label="DB" sublabel="updating" bands={2} />
        </Cell>

        <Cell label="DotBar — determinate">
          <div className="flex flex-col items-center gap-2">
            <DotBar progress={pct} />
            <span className="text-xs tabular-nums text-muted-foreground">{pct}%</span>
          </div>
        </Cell>

        <Cell label="DotBar — indeterminate sweep">
          <DotBar />
        </Cell>

        <Cell label="DotBar — slim 2-row">
          <DotBar progress={pct} rows={2} cols={32} width={200} />
        </Cell>
      </div>
    </div>
  )
}
