import { Shield, Globe, Play, Square, Terminal } from "lucide-react"
import { StartAll, StopAll } from "@wails/go/main/App"
import { useAppState, useStatus } from "@/shared/hooks/useAppData"
import { Button } from "@/shared/ui/primitives"
import { PageHeader, NotConfigured } from "@/shared/ui/Page"
import type { process as proc } from "@wails/go/models"
import { useBusy } from "./useBusy"
import { DbNode, ProcNode, Connector } from "./ServiceNodes"
import { ConsoleSection } from "./ConsoleSection"

export function DashboardPage() {
  const { data: state } = useAppState()
  const { data: status } = useStatus()
  const { busy, run } = useBusy()

  if (state && !state.configured) return <NotConfigured />

  const auth = status?.auth ?? ({ state: "stopped", pid: 0, startedAt: 0, target: "auth", external: false } as proc.ProcInfo)
  const world = status?.world ?? ({ state: "stopped", pid: 0, startedAt: 0, target: "world", external: false } as proc.ProcInfo)

  return (
    <div className="flex h-full flex-col gap-4 p-5">
      <PageHeader
        title="Dashboard"
        description="Operate and observe your server stack"
        actions={
          <>
            <Button size="sm" loading={busy === "all-start"} onClick={() => run("all-start", StartAll, "Start all")}>
              <Play className="size-3.5" /> Start all
            </Button>
            <Button
              size="sm"
              variant="secondary"
              loading={busy === "all-stop"}
              onClick={() => run("all-stop", () => StopAll(false), "Stop all")}
            >
              <Square className="size-3.5" /> Stop all
            </Button>
          </>
        }
      />

      <section className="rounded-lg border border-border bg-card/40 p-3">
        <div className="mb-2.5 flex items-center gap-2 px-1">
          <Terminal className="size-3.5 text-muted-foreground" />
          <span className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">Server stack</span>
        </div>
        <div className="flex flex-col gap-2 lg:flex-row lg:items-stretch">
          <DbNode state={status?.db ?? "unknown"} busy={busy} run={run} />
          <Connector />
          <ProcNode title="Auth Server" icon={Shield} target="auth" info={auth} busy={busy} run={run} />
          <Connector />
          <ProcNode title="World Server" icon={Globe} target="world" info={world} busy={busy} run={run} />
        </div>
      </section>

      <ConsoleSection status={status} />
    </div>
  )
}
