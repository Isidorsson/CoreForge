import { useState } from "react"
import { Send } from "lucide-react"
import { SendConsole } from "@wails/go/main/App"
import { runAction } from "@/shared/hooks/useAppData"
import { Button } from "@/shared/ui/primitives"
import { StatusDot } from "@/shared/ui/StatusPill"
import { cn } from "@/shared/lib/utils"
import type { process as proc } from "@wails/go/models"
import { ConsolePane } from "./ConsolePane"

export function ConsoleSection({ status }: { status?: proc.Status }) {
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
