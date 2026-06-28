import { useEffect, useState } from "react"
import { Database, Shield, Globe, Play, Square, RotateCw, Send } from "lucide-react"
import {
  StartDB,
  StopDB,
  StartAuth,
  StopAuth,
  StartWorld,
  StopWorld,
  StartAll,
  StopAll,
  RestartServer,
  SendConsole,
} from "../../wailsjs/go/main/App"
import { useAppState, useStatus, runAction } from "@/hooks/useAppData"
import { Button, Card, CardContent, CardDescription, CardHeader, CardTitle, Input } from "@/components/ui/primitives"
import { StatusPill, procTone, dbTone } from "@/components/StatusPill"
import { ConsolePane } from "@/components/ConsolePane"
import { PageHeader, NotConfigured } from "@/components/Page"
import { formatUptime } from "@/lib/format"
import type { process as proc } from "../../wailsjs/go/models"

function useBusy() {
  const [busy, setBusy] = useState<string | null>(null)
  const run = (key: string, fn: () => Promise<unknown>, errTitle: string) => {
    setBusy(key)
    runAction(fn, errTitle)
      .catch(() => {})
      .finally(() => setBusy(null))
  }
  return { busy, run }
}

/** Re-render every second so uptime stays live without backend chatter. */
function useUptime(startedAt: number) {
  const [, tick] = useState(0)
  useEffect(() => {
    if (!startedAt) return
    const id = window.setInterval(() => tick((x) => x + 1), 1000)
    return () => window.clearInterval(id)
  }, [startedAt])
  return formatUptime(startedAt)
}

function ProcCard({
  title,
  icon: Icon,
  target,
  info,
  busy,
  run,
}: {
  title: string
  icon: React.ElementType
  target: "auth" | "world"
  info: proc.ProcInfo
  busy: string | null
  run: ReturnType<typeof useBusy>["run"]
}) {
  const tone = procTone(info.state, info.external)
  const running = info.state === "running" || info.state === "starting"
  const uptime = useUptime(info.startedAt)
  const stopFn = target === "auth" ? StopAuth : StopWorld
  const startFn = target === "auth" ? StartAuth : StartWorld

  return (
    <Card>
      <CardHeader className="flex-row items-start justify-between">
        <div className="flex items-center gap-2">
          <Icon className="size-4 text-muted-foreground" />
          <div>
            <CardTitle>{title}</CardTitle>
            <CardDescription>{info.pid ? `PID ${info.pid}` : "not running"}</CardDescription>
          </div>
        </div>
        <StatusPill tone={tone.tone} label={tone.label} />
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="text-xs text-muted-foreground">Uptime · {info.state === "running" ? uptime : "—"}</div>
        <div className="flex gap-2">
          {running ? (
            <>
              <Button
                size="sm"
                variant="secondary"
                loading={busy === `${target}-stop`}
                onClick={() => run(`${target}-stop`, () => stopFn(false), `Stop ${title}`)}
              >
                <Square className="size-3.5" /> Stop
              </Button>
              {!info.external && (
                <Button
                  size="sm"
                  variant="outline"
                  loading={busy === `${target}-restart`}
                  onClick={() => run(`${target}-restart`, () => RestartServer(target), `Restart ${title}`)}
                >
                  <RotateCw className="size-3.5" /> Restart
                </Button>
              )}
            </>
          ) : (
            <Button
              size="sm"
              loading={busy === `${target}-start`}
              onClick={() => run(`${target}-start`, () => startFn(), `Start ${title}`)}
            >
              <Play className="size-3.5" /> Start
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  )
}

function DbCard({ state, busy, run }: { state: string; busy: string | null; run: ReturnType<typeof useBusy>["run"] }) {
  const tone = dbTone(state)
  const up = state === "ready" || state === "starting"
  return (
    <Card>
      <CardHeader className="flex-row items-start justify-between">
        <div className="flex items-center gap-2">
          <Database className="size-4 text-muted-foreground" />
          <div>
            <CardTitle>Database</CardTitle>
            <CardDescription>MariaDB (Docker)</CardDescription>
          </div>
        </div>
        <StatusPill tone={tone.tone} label={tone.label} />
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="text-xs text-muted-foreground">Container managed via docker compose</div>
        <div className="flex gap-2">
          {up ? (
            <Button size="sm" variant="secondary" loading={busy === "db-stop"} onClick={() => run("db-stop", StopDB, "Stop DB")}>
              <Square className="size-3.5" /> Stop
            </Button>
          ) : (
            <Button size="sm" loading={busy === "db-start"} onClick={() => run("db-start", StartDB, "Start DB")}>
              <Play className="size-3.5" /> Start
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  )
}

function ConsoleSection() {
  const [tab, setTab] = useState<"auth" | "world">("world")
  const [cmd, setCmd] = useState("")

  function sendCmd() {
    const value = cmd.trim()
    if (!value) return
    runAction(() => SendConsole(tab, value), "Send command").catch(() => {})
    setCmd("")
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-2">
      <div className="flex items-center gap-1">
        {(["world", "auth"] as const).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={
              tab === t
                ? "rounded-md bg-accent px-3 py-1 text-xs font-medium capitalize"
                : "rounded-md px-3 py-1 text-xs font-medium capitalize text-muted-foreground hover:text-foreground"
            }
          >
            {t} console
          </button>
        ))}
      </div>
      <ConsolePane key={tab} target={tab} className="min-h-0 flex-1" />
      <div className="flex gap-2">
        <Input
          value={cmd}
          onChange={(e) => setCmd(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && sendCmd()}
          placeholder={`Type a ${tab} server command and press Enter…`}
          className="font-mono"
        />
        <Button variant="secondary" onClick={sendCmd}>
          <Send className="size-3.5" /> Send
        </Button>
      </div>
    </div>
  )
}

export function Dashboard() {
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
        description="Start, stop and watch your server stack"
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
      <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
        <DbCard state={status?.db ?? "unknown"} busy={busy} run={run} />
        <ProcCard title="Auth Server" icon={Shield} target="auth" info={auth} busy={busy} run={run} />
        <ProcCard title="World Server" icon={Globe} target="world" info={world} busy={busy} run={run} />
      </div>
      <ConsoleSection />
    </div>
  )
}
