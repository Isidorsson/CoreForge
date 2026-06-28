import { useEffect, useState } from "react"
import { Database, Shield, Globe, Play, Square, RotateCw, Send, ChevronRight, Terminal } from "lucide-react"
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
import { Button } from "@/components/ui/primitives"
import { StatusPill, StatusDot, procTone, dbTone, type Tone } from "@/components/StatusPill"
import { ConsolePane } from "@/components/ConsolePane"
import { PageHeader, NotConfigured } from "@/components/Page"
import { formatUptime } from "@/lib/format"
import { cn } from "@/lib/utils"
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

/* ----------------------------- Service node -------------------------------- */

function MetaRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between text-xs">
      <span className="text-[10px] uppercase tracking-wider text-muted-foreground">{label}</span>
      <span className="font-medium tabular-nums">{value}</span>
    </div>
  )
}

function NodeShell({
  icon: Icon,
  title,
  subtitle,
  tone,
  label,
  children,
}: {
  icon: React.ElementType
  title: string
  subtitle: string
  tone: Tone
  label: string
  children: React.ReactNode
}) {
  return (
    <div className="flex flex-1 flex-col gap-3 rounded-md border border-border bg-card p-3">
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-2.5">
          <div className="flex size-8 items-center justify-center rounded-md bg-muted text-muted-foreground ring-1 ring-border">
            <Icon className="size-4" />
          </div>
          <div className="leading-tight">
            <p className="text-sm font-semibold">{title}</p>
            <p className="font-sans text-[11px] text-muted-foreground">{subtitle}</p>
          </div>
        </div>
        <StatusPill tone={tone} label={label} />
      </div>
      {children}
    </div>
  )
}

function ProcNode({
  title,
  icon,
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
    <NodeShell
      icon={icon}
      title={title}
      subtitle={info.external ? "external process" : "managed process"}
      tone={tone.tone}
      label={tone.label}
    >
      <div className="space-y-1.5 border-t border-border/60 pt-2">
        <MetaRow label="PID" value={info.pid ? String(info.pid) : "—"} />
        <MetaRow label="Uptime" value={info.state === "running" ? uptime : "—"} />
      </div>
      <div className="flex gap-2">
        {running ? (
          <>
            <Button
              size="sm"
              variant="secondary"
              className="flex-1"
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
            className="flex-1"
            loading={busy === `${target}-start`}
            onClick={() => run(`${target}-start`, () => startFn(), `Start ${title}`)}
          >
            <Play className="size-3.5" /> Start
          </Button>
        )}
      </div>
    </NodeShell>
  )
}

function DbNode({ state, busy, run }: { state: string; busy: string | null; run: ReturnType<typeof useBusy>["run"] }) {
  const tone = dbTone(state)
  const up = state === "ready" || state === "starting"
  return (
    <NodeShell icon={Database} title="Database" subtitle="MariaDB · Docker" tone={tone.tone} label={tone.label}>
      <div className="space-y-1.5 border-t border-border/60 pt-2">
        <MetaRow label="Engine" value="MariaDB" />
        <MetaRow label="Managed" value="compose" />
      </div>
      <div className="flex gap-2">
        {up ? (
          <Button
            size="sm"
            variant="secondary"
            className="flex-1"
            loading={busy === "db-stop"}
            onClick={() => run("db-stop", StopDB, "Stop DB")}
          >
            <Square className="size-3.5" /> Stop
          </Button>
        ) : (
          <Button size="sm" className="flex-1" loading={busy === "db-start"} onClick={() => run("db-start", StartDB, "Start DB")}>
            <Play className="size-3.5" /> Start
          </Button>
        )}
      </div>
    </NodeShell>
  )
}

function Connector() {
  return (
    <div className="flex shrink-0 items-center justify-center self-stretch py-1 lg:py-0">
      <ChevronRight className="size-4 rotate-90 text-muted-foreground/40 lg:rotate-0" />
    </div>
  )
}

/* ------------------------------- Console ----------------------------------- */

function ConsoleSection({ status }: { status?: proc.Status }) {
  const [tab, setTab] = useState<"auth" | "world">("world")
  const [cmd, setCmd] = useState("")
  const live = tab === "auth" ? status?.auth.state === "running" : status?.world.state === "running"

  function sendCmd() {
    const value = cmd.trim()
    if (!value) return
    runAction(() => SendConsole(tab, value), "Send command").catch(() => {})
    setCmd("")
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-lg border border-border bg-console">
      <div className="flex items-center justify-between border-b border-border px-2 py-1.5">
        <div className="flex items-center gap-1">
          {(["world", "auth"] as const).map((t) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={cn(
                "rounded-md px-3 py-1 text-xs font-medium capitalize transition-colors",
                tab === t ? "bg-accent text-foreground" : "text-muted-foreground hover:text-foreground",
              )}
            >
              {t}
            </button>
          ))}
        </div>
        <div className="flex items-center gap-1.5 pr-1 text-[11px] text-muted-foreground">
          <StatusDot tone={live ? "on" : "off"} />
          {live ? "tailing" : "idle"}
        </div>
      </div>

      <ConsolePane key={tab} target={tab} className="min-h-0 flex-1" />

      <div className="flex items-center gap-2 border-t border-border px-3 py-2">
        <span className="shrink-0 select-none text-xs font-medium text-primary">{tab}&nbsp;&gt;</span>
        <input
          value={cmd}
          onChange={(e) => setCmd(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && sendCmd()}
          placeholder={`send a ${tab} command…`}
          className="min-w-0 flex-1 bg-transparent font-mono text-xs outline-none placeholder:text-muted-foreground/60"
        />
        <Button size="sm" variant="ghost" onClick={sendCmd} disabled={!cmd.trim()}>
          <Send className="size-3.5" /> Send
        </Button>
      </div>
    </div>
  )
}

/* ------------------------------ Dashboard ---------------------------------- */

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
