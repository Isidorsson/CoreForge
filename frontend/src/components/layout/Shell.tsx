import { NavLink, Outlet } from "react-router-dom"
import { Flame, LayoutDashboard, ScrollText, FileCog, FolderTree, Settings2 } from "lucide-react"
import { SetActiveCore } from "../../../wailsjs/go/main/App"
import { useAppState, useStatus, runAction } from "@/hooks/useAppData"
import { StatusPill, procTone, dbTone } from "@/components/StatusPill"
import { cn } from "@/lib/utils"
import type { main } from "../../../wailsjs/go/models"

const nav = [
  { to: "/", label: "Dashboard", icon: LayoutDashboard, end: true },
  { to: "/logs", label: "Logs", icon: ScrollText, end: false },
  { to: "/config", label: "Config", icon: FileCog, end: false },
  { to: "/files", label: "Files", icon: FolderTree, end: false },
  { to: "/settings", label: "Settings", icon: Settings2, end: false },
]

function Sidebar() {
  return (
    <aside className="flex w-56 shrink-0 flex-col border-r border-border bg-card/40">
      <div className="flex items-center gap-2 px-4 py-4">
        <div className="flex size-8 items-center justify-center rounded-lg bg-primary/15 text-primary">
          <Flame className="size-4" />
        </div>
        <div className="leading-tight">
          <p className="text-sm font-semibold">CoreForge</p>
          <p className="text-[10px] uppercase tracking-wider text-muted-foreground">Server Manager</p>
        </div>
      </div>
      <nav className="flex flex-1 flex-col gap-0.5 p-2">
        {nav.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            end={item.end}
            className={({ isActive }) =>
              cn(
                "flex items-center gap-2.5 rounded-md px-3 py-2 text-sm font-medium transition-colors",
                isActive
                  ? "bg-primary/15 text-primary"
                  : "text-muted-foreground hover:bg-accent hover:text-foreground",
              )
            }
          >
            <item.icon className="size-4" />
            {item.label}
          </NavLink>
        ))}
      </nav>
      <div className="p-3 text-[10px] text-muted-foreground">TrinityCore · AzerothCore</div>
    </aside>
  )
}

function CoreSwitcher({ state }: { state?: main.AppState }) {
  if (!state) return null
  return (
    <select
      value={state.activeCore}
      onChange={(e) => runAction(() => SetActiveCore(e.target.value), "Switch core").catch(() => {})}
      className="h-8 rounded-md border border-input bg-card px-2 text-sm font-medium focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
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
  )
}

function HeaderStatus() {
  const { data: status } = useStatus()
  if (!status) return null
  const auth = procTone(status.auth.state, status.auth.external)
  const world = procTone(status.world.state, status.world.external)
  const db = dbTone(status.db)
  return (
    <div className="flex items-center gap-2">
      <span className="text-xs text-muted-foreground">DB</span>
      <StatusPill tone={db.tone} label={db.label} />
      <span className="ml-1 text-xs text-muted-foreground">Auth</span>
      <StatusPill tone={auth.tone} label={auth.label} />
      <span className="ml-1 text-xs text-muted-foreground">World</span>
      <StatusPill tone={world.tone} label={world.label} />
    </div>
  )
}

function Header({ state }: { state?: main.AppState }) {
  return (
    <header className="flex h-14 shrink-0 items-center justify-between gap-4 border-b border-border px-5">
      <div className="flex min-w-0 items-center gap-3">
        <CoreSwitcher state={state} />
        {state?.installDir ? (
          <span className="truncate font-mono text-xs text-muted-foreground" title={state.installDir}>
            {state.installDir}
          </span>
        ) : (
          <span className="text-xs text-muted-foreground">No install directory set</span>
        )}
      </div>
      <HeaderStatus />
    </header>
  )
}

export function Shell() {
  const { data: state } = useAppState()
  return (
    <div className="flex h-screen w-screen overflow-hidden">
      <Sidebar />
      <div className="flex min-w-0 flex-1 flex-col">
        <Header state={state} />
        <main className="min-h-0 flex-1 overflow-auto">
          <Outlet />
        </main>
      </div>
    </div>
  )
}
