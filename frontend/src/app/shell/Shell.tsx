import { useEffect, useState } from "react"
import { NavLink, Outlet } from "react-router-dom"
import {
  Flame,
  LayoutDashboard,
  BarChart3,
  ScrollText,
  FileCog,
  FolderTree,
  Settings2,
  PanelLeftClose,
  PanelLeftOpen,
  Command,
  FolderGit2,
} from "lucide-react"
import { SetActiveCore } from "@wails/go/main/App"
import { useAppState, useStatus, runAction } from "@/shared/hooks/useAppData"
import { StatusDot, procTone, dbTone, type Tone } from "@/shared/ui/StatusPill"
import { CommandPalette } from "@/app/shell/CommandPalette"
import { cn } from "@/shared/lib/utils"
import type { main } from "@wails/go/models"

const nav = [
  { to: "/", label: "Dashboard", icon: LayoutDashboard, end: true },
  { to: "/metrics", label: "Metrics", icon: BarChart3, end: false },
  { to: "/logs", label: "Logs", icon: ScrollText, end: false },
  { to: "/config", label: "Config", icon: FileCog, end: false },
  { to: "/files", label: "Files", icon: FolderTree, end: false },
  { to: "/settings", label: "Settings", icon: Settings2, end: false },
]

function Sidebar({
  collapsed,
  onToggle,
  onOpenPalette,
}: {
  collapsed: boolean
  onToggle: () => void
  onOpenPalette: () => void
}) {
  return (
    <aside
      className={cn(
        "flex shrink-0 flex-col border-r border-border bg-sidebar transition-[width] duration-200",
        collapsed ? "w-14" : "w-56",
      )}
    >
      <div className={cn("flex h-12 items-center gap-2.5 px-3", collapsed && "justify-center px-0")}>
        <div className="flex size-7 shrink-0 items-center justify-center rounded-md bg-primary/15 text-primary ring-1 ring-primary/25">
          <Flame className="size-4" />
        </div>
        {!collapsed && (
          <span className="text-sm font-semibold tracking-tight">
            Core<span className="text-primary">Forge</span>
          </span>
        )}
      </div>

      <nav className="flex flex-1 flex-col gap-0.5 p-2">
        {nav.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            end={item.end}
            title={collapsed ? item.label : undefined}
            className={({ isActive }) =>
              cn(
                "group relative flex items-center gap-2.5 rounded-md py-2 text-sm font-medium transition-colors",
                collapsed ? "justify-center px-0" : "px-3",
                isActive ? "bg-secondary text-foreground" : "text-muted-foreground hover:bg-accent/60 hover:text-foreground",
              )
            }
          >
            {({ isActive }) => (
              <>
                <span
                  className={cn(
                    "absolute left-0 top-1/2 h-5 w-[3px] -translate-y-1/2 rounded-r-full bg-primary transition-opacity",
                    isActive ? "opacity-100" : "opacity-0",
                  )}
                />
                <item.icon className={cn("size-4 shrink-0", isActive && "text-primary")} />
                {!collapsed && <span className="truncate">{item.label}</span>}
              </>
            )}
          </NavLink>
        ))}
      </nav>

      <div className="flex flex-col gap-1 p-2">
        <button
          onClick={onOpenPalette}
          title="Command palette"
          className={cn(
            "flex items-center gap-2.5 rounded-md py-2 text-sm font-medium text-muted-foreground transition-colors hover:bg-accent/60 hover:text-foreground",
            collapsed ? "justify-center px-0" : "px-3",
          )}
        >
          <Command className="size-4 shrink-0" />
          {!collapsed && (
            <span className="flex flex-1 items-center justify-between">
              Commands
              <kbd className="rounded border border-border px-1 py-0.5 text-[10px] text-muted-foreground">⌘K</kbd>
            </span>
          )}
        </button>
        <button
          onClick={onToggle}
          title={collapsed ? "Expand sidebar" : "Collapse sidebar"}
          className={cn(
            "flex items-center gap-2.5 rounded-md py-2 text-sm font-medium text-muted-foreground transition-colors hover:bg-accent/60 hover:text-foreground",
            collapsed ? "justify-center px-0" : "px-3",
          )}
        >
          {collapsed ? <PanelLeftOpen className="size-4 shrink-0" /> : <PanelLeftClose className="size-4 shrink-0" />}
          {!collapsed && <span>Collapse</span>}
        </button>
      </div>
    </aside>
  )
}

function CoreSwitcher({ state }: { state?: main.AppState }) {
  if (!state) return null
  return (
    <div className="relative">
      <select
        value={state.activeCore}
        onChange={(e) => runAction(() => SetActiveCore(e.target.value), "Switch core").catch(() => {})}
        className="h-8 cursor-pointer appearance-none rounded-md border border-input bg-card pl-3 pr-8 text-sm font-medium focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      >
        <option value="" disabled>
          Select core…
        </option>
        {state.cores.map((c) => (
          <option key={c.type} value={c.type}>
            {c.displayName}
            {c.configured ? "" : " — not set up"}
          </option>
        ))}
      </select>
      <svg
        className="pointer-events-none absolute right-2.5 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground"
        viewBox="0 0 12 12"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.5"
      >
        <path d="m3 4.5 3 3 3-3" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    </div>
  )
}

function Stat({ label, tone, value }: { label: string; tone: Tone; value: string }) {
  return (
    <div className="flex items-center gap-2">
      <span className="text-[10px] uppercase tracking-wider text-muted-foreground">{label}</span>
      <StatusDot tone={tone} />
      <span className="text-xs font-medium tabular-nums">{value}</span>
    </div>
  )
}

function SystemStatus() {
  const { data: status } = useStatus()
  if (!status) return null
  const auth = procTone(status.auth.state, status.auth.external)
  const world = procTone(status.world.state, status.world.external)
  const db = dbTone(status.db)
  return (
    <div className="flex items-center gap-3 rounded-md border border-border bg-card px-3 py-1.5">
      <Stat label="DB" tone={db.tone} value={db.label} />
      <span className="h-3.5 w-px bg-border" />
      <Stat label="Auth" tone={auth.tone} value={auth.label} />
      <span className="h-3.5 w-px bg-border" />
      <Stat label="World" tone={world.tone} value={world.label} />
    </div>
  )
}

function Header({ state }: { state?: main.AppState }) {
  return (
    <header className="flex h-12 shrink-0 items-center justify-between gap-4 border-b border-border bg-background px-4">
      <div className="flex min-w-0 items-center gap-3">
        <CoreSwitcher state={state} />
        {state?.installDir ? (
          <span className="flex min-w-0 items-center gap-1.5 text-xs text-muted-foreground" title={state.installDir}>
            <FolderGit2 className="size-3.5 shrink-0" />
            <span className="truncate">{state.installDir}</span>
          </span>
        ) : (
          <span className="text-xs text-muted-foreground">No install directory set</span>
        )}
      </div>
      <SystemStatus />
    </header>
  )
}

export function Shell() {
  const { data: state } = useAppState()
  const [collapsed, setCollapsed] = useState(() => localStorage.getItem("cf:rail") === "1")
  const [paletteOpen, setPaletteOpen] = useState(false)

  const toggleRail = () =>
    setCollapsed((c) => {
      localStorage.setItem("cf:rail", c ? "0" : "1")
      return !c
    })

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault()
        setPaletteOpen((o) => !o)
      }
    }
    window.addEventListener("keydown", onKey)
    return () => window.removeEventListener("keydown", onKey)
  }, [])

  return (
    <div className="flex h-screen w-screen overflow-hidden">
      <Sidebar collapsed={collapsed} onToggle={toggleRail} onOpenPalette={() => setPaletteOpen(true)} />
      <div className="flex min-w-0 flex-1 flex-col">
        <Header state={state} />
        <main className="min-h-0 flex-1 overflow-auto">
          <Outlet />
        </main>
      </div>
      <CommandPalette open={paletteOpen} onClose={() => setPaletteOpen(false)} />
    </div>
  )
}
