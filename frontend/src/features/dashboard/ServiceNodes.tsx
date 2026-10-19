import { useEffect, useState } from "react"
import { Database, Play, Square, RotateCw, ChevronRight, Ban } from "lucide-react"
import { StartDB, StopDB, StartAuth, StopAuth, StartWorld, StopWorld, RestartServer } from "@wails/go/main/App"
import { Button } from "@/shared/ui/primitives"
import { ConfirmDialog } from "@/shared/ui/dialog"
import { StatusPill, procTone, dbTone, type Tone } from "@/shared/ui/StatusPill"
import { formatUptime } from "@/shared/lib/format"
import type { process as proc } from "@wails/go/models"
import type { useBusy, BusyKeys } from "./useBusy"

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
    <div className="flex min-w-0 flex-1 flex-col gap-3 rounded-md border border-border bg-card p-3">
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

export function ProcNode({
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
  busy: BusyKeys
  run: ReturnType<typeof useBusy>["run"]
}) {
  const tone = procTone(info.state, info.external)
  const live = info.state === "running" || info.state === "starting" || info.state === "stopping"
  const stopping = info.state === "stopping"
  // Force stays enabled throughout: it is the escape hatch for a stop that hangs.
  const locked = stopping || [...busy].some((k) => k.startsWith(`${target}-`) || k.startsWith("all-"))
  const uptime = useUptime(info.startedAt)
  const stopFn = target === "auth" ? StopAuth : StopWorld
  const startFn = target === "auth" ? StartAuth : StartWorld
  const [confirmForce, setConfirmForce] = useState(false)

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
      <div className="grid grid-cols-3 gap-2">
        {live ? (
          <>
            <Button
              size="sm"
              variant="secondary"
              loading={busy.has(`${target}-stop`) || stopping}
              disabled={locked}
              onClick={() => run(`${target}-stop`, () => stopFn(false), `Stop ${title}`)}
            >
              <Square className="size-3.5" /> Stop
            </Button>
            <Button
              size="sm"
              variant="outline"
              loading={busy.has(`${target}-restart`)}
              disabled={locked}
              title={info.external ? "Stop the external process and relaunch it under CoreForge" : undefined}
              onClick={() =>
                run(`${target}-restart`, () => RestartServer(target), `${info.external ? "Adopt" : "Restart"} ${title}`)
              }
            >
              <RotateCw className="size-3.5" /> {info.external ? "Adopt" : "Restart"}
            </Button>
            <Button
              size="sm"
              variant="destructive"
              loading={busy.has(`${target}-force`)}
              title="Force-kill the process immediately"
              onClick={() => setConfirmForce(true)}
            >
              <Ban className="size-3.5" /> Force
            </Button>
          </>
        ) : (
          <Button
            size="sm"
            className="col-span-3"
            loading={busy.has(`${target}-start`)}
            disabled={locked}
            onClick={() => run(`${target}-start`, () => startFn(), `Start ${title}`)}
          >
            <Play className="size-3.5" /> Start
          </Button>
        )}
      </div>
      <ConfirmDialog
        open={confirmForce}
        title={`Force stop ${title}?`}
        description={`This kills the ${target} server process${info.pid ? ` (PID ${info.pid})` : ""} immediately, with no clean shutdown — unsaved world state can be lost. Use it only when a normal stop is stuck.`}
        confirmLabel="Force stop"
        confirmVariant="destructive"
        onConfirm={() => {
          setConfirmForce(false)
          run(`${target}-force`, () => stopFn(true), `Force stop ${title}`)
        }}
        onClose={() => setConfirmForce(false)}
      />
    </NodeShell>
  )
}

export function DbNode({ state, busy, run }: { state: string; busy: BusyKeys; run: ReturnType<typeof useBusy>["run"] }) {
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
            loading={busy.has("db-stop")}
            onClick={() => run("db-stop", StopDB, "Stop DB")}
          >
            <Square className="size-3.5" /> Stop
          </Button>
        ) : (
          <Button size="sm" className="flex-1" loading={busy.has("db-start")} onClick={() => run("db-start", StartDB, "Start DB")}>
            <Play className="size-3.5" /> Start
          </Button>
        )}
      </div>
    </NodeShell>
  )
}

export function Connector() {
  return (
    <div className="flex shrink-0 items-center justify-center self-stretch py-1 lg:py-0">
      <ChevronRight className="size-4 rotate-90 text-muted-foreground/40 lg:rotate-0" />
    </div>
  )
}
