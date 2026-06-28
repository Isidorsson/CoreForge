import * as React from "react"
import { createPortal } from "react-dom"
import { useNavigate } from "react-router-dom"
import {
  LayoutDashboard,
  BarChart3,
  ScrollText,
  FileCog,
  FolderTree,
  Settings2,
  Play,
  Square,
  RotateCw,
  Database,
  Shield,
  Globe,
  Repeat,
  Search,
  CornerDownLeft,
  type LucideIcon,
} from "lucide-react"
import {
  StartAll,
  StopAll,
  StartAuth,
  StopAuth,
  StartWorld,
  StopWorld,
  StartDB,
  StopDB,
  RestartServer,
  SetActiveCore,
} from "../../wailsjs/go/main/App"
import { useAppState, useStatus, runAction } from "@/hooks/useAppData"
import { cn } from "@/lib/utils"

type Command = {
  id: string
  label: string
  hint?: string
  group: string
  icon: LucideIcon
  run: () => void
}

const isRunning = (s?: string) => s === "running" || s === "starting"

/** Operator command palette — fuzzy nav + process actions. Open with Ctrl/⌘K. */
export function CommandPalette({ open, onClose }: { open: boolean; onClose: () => void }) {
  const navigate = useNavigate()
  const { data: state } = useAppState()
  const { data: status } = useStatus()
  const [query, setQuery] = React.useState("")
  const [active, setActive] = React.useState(0)
  const inputRef = React.useRef<HTMLInputElement>(null)
  const listRef = React.useRef<HTMLDivElement>(null)

  const act = React.useCallback(
    (fn: () => Promise<unknown>, title: string) => () => {
      runAction(fn, title).catch(() => {})
      onClose()
    },
    [onClose],
  )

  const go = React.useCallback(
    (path: string) => () => {
      navigate(path)
      onClose()
    },
    [navigate, onClose],
  )

  const commands = React.useMemo<Command[]>(() => {
    const nav: Command[] = [
      { id: "nav-dash", label: "Dashboard", group: "Go to", icon: LayoutDashboard, run: go("/") },
      { id: "nav-metrics", label: "Metrics", group: "Go to", icon: BarChart3, run: go("/metrics") },
      { id: "nav-logs", label: "Logs", group: "Go to", icon: ScrollText, run: go("/logs") },
      { id: "nav-config", label: "Config", group: "Go to", icon: FileCog, run: go("/config") },
      { id: "nav-files", label: "Files", group: "Go to", icon: FolderTree, run: go("/files") },
      { id: "nav-settings", label: "Settings", group: "Go to", icon: Settings2, run: go("/settings") },
    ]

    const stack: Command[] = [
      { id: "all-start", label: "Start all", hint: "DB · Auth · World", group: "Stack", icon: Play, run: act(StartAll, "Start all") },
      { id: "all-stop", label: "Stop all", hint: "DB · Auth · World", group: "Stack", icon: Square, run: act(() => StopAll(false), "Stop all") },
    ]

    const proc: Command[] = []
    if (status) {
      proc.push(
        isRunning(status.db)
          ? { id: "db-stop", label: "Stop database", group: "Services", icon: Database, run: act(StopDB, "Stop DB") }
          : { id: "db-start", label: "Start database", group: "Services", icon: Database, run: act(StartDB, "Start DB") },
      )
      proc.push(
        isRunning(status.auth.state)
          ? { id: "auth-stop", label: "Stop auth server", group: "Services", icon: Shield, run: act(() => StopAuth(false), "Stop auth") }
          : { id: "auth-start", label: "Start auth server", group: "Services", icon: Shield, run: act(StartAuth, "Start auth") },
      )
      if (isRunning(status.auth.state) && !status.auth.external)
        proc.push({ id: "auth-restart", label: "Restart auth server", group: "Services", icon: RotateCw, run: act(() => RestartServer("auth"), "Restart auth") })
      proc.push(
        isRunning(status.world.state)
          ? { id: "world-stop", label: "Stop world server", group: "Services", icon: Globe, run: act(() => StopWorld(false), "Stop world") }
          : { id: "world-start", label: "Start world server", group: "Services", icon: Globe, run: act(StartWorld, "Start world") },
      )
      if (isRunning(status.world.state) && !status.world.external)
        proc.push({ id: "world-restart", label: "Restart world server", group: "Services", icon: RotateCw, run: act(() => RestartServer("world"), "Restart world") })
    }

    const cores: Command[] = (state?.cores ?? [])
      .filter((c) => c.type !== state?.activeCore)
      .map((c) => ({
        id: `core-${c.type}`,
        label: `Switch to ${c.displayName}`,
        hint: c.configured ? undefined : "not set up",
        group: "Core",
        icon: Repeat,
        run: act(() => SetActiveCore(c.type), "Switch core"),
      }))

    return [...nav, ...stack, ...proc, ...cores]
  }, [state, status, act, go])

  const filtered = React.useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return commands
    return commands.filter((c) => `${c.label} ${c.hint ?? ""} ${c.group}`.toLowerCase().includes(q))
  }, [commands, query])

  React.useEffect(() => {
    if (open) {
      setQuery("")
      setActive(0)
      requestAnimationFrame(() => inputRef.current?.focus())
    }
  }, [open])

  React.useEffect(() => setActive(0), [query])

  React.useEffect(() => {
    const el = listRef.current?.querySelector<HTMLElement>(`[data-idx="${active}"]`)
    el?.scrollIntoView({ block: "nearest" })
  }, [active])

  if (!open) return null

  function onKey(e: React.KeyboardEvent) {
    if (e.key === "Escape") return onClose()
    if (e.key === "ArrowDown") {
      e.preventDefault()
      setActive((i) => Math.min(i + 1, filtered.length - 1))
    } else if (e.key === "ArrowUp") {
      e.preventDefault()
      setActive((i) => Math.max(i - 1, 0))
    } else if (e.key === "Enter") {
      e.preventDefault()
      filtered[active]?.run()
    }
  }

  // Group while preserving flat index for keyboard nav.
  let idx = -1
  const groups = filtered.reduce<Record<string, Command[]>>((acc, c) => {
    ;(acc[c.group] ??= []).push(c)
    return acc
  }, {})

  return createPortal(
    <div className="fixed inset-0 z-50 flex items-start justify-center p-4 pt-[12vh]" onKeyDown={onKey}>
      <div className="animate-overlay-in absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Command palette"
        className="animate-dialog-in relative z-10 flex max-h-[70vh] w-full max-w-xl flex-col overflow-hidden rounded-lg border border-border-strong bg-popover shadow-[0_24px_60px_-20px_rgba(0,0,0,0.85)]"
      >
        <div className="flex items-center gap-2 border-b border-border px-3">
          <Search className="size-4 shrink-0 text-muted-foreground" />
          <input
            ref={inputRef}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Run a command or jump to…"
            className="h-11 w-full bg-transparent text-sm outline-none placeholder:text-muted-foreground/70"
          />
          <kbd className="hidden shrink-0 rounded border border-border px-1.5 py-0.5 text-[10px] text-muted-foreground sm:block">
            ESC
          </kbd>
        </div>

        <div ref={listRef} className="min-h-0 flex-1 overflow-auto p-1.5">
          {filtered.length === 0 ? (
            <p className="px-3 py-6 text-center text-xs text-muted-foreground">No matching commands</p>
          ) : (
            Object.entries(groups).map(([group, items]) => (
              <div key={group} className="mb-1">
                <div className="px-2 py-1 text-[10px] font-medium uppercase tracking-wider text-muted-foreground/70">
                  {group}
                </div>
                {items.map((c) => {
                  idx++
                  const i = idx
                  const Icon = c.icon
                  return (
                    <button
                      key={c.id}
                      data-idx={i}
                      onMouseMove={() => setActive(i)}
                      onClick={() => c.run()}
                      className={cn(
                        "flex w-full items-center gap-2.5 rounded-md px-2.5 py-2 text-left text-sm transition-colors",
                        i === active ? "bg-accent text-foreground" : "text-muted-foreground",
                      )}
                    >
                      <Icon className="size-4 shrink-0" />
                      <span className="flex-1 truncate text-foreground">{c.label}</span>
                      {c.hint && <span className="shrink-0 text-[11px] text-muted-foreground">{c.hint}</span>}
                      {i === active && <CornerDownLeft className="size-3.5 shrink-0 text-muted-foreground" />}
                    </button>
                  )
                })}
              </div>
            ))
          )}
        </div>
      </div>
    </div>,
    document.body,
  )
}
