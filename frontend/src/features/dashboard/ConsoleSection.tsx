import { useState } from "react"
import { Copy, Send, Trash2 } from "lucide-react"
import { SendConsole } from "@wails/go/main/App"
import { ClipboardSetText } from "@wails/runtime/runtime"
import { runAction } from "@/shared/hooks/useAppData"
import { Button } from "@/shared/ui/primitives"
import { StatusDot } from "@/shared/ui/StatusPill"
import { toast } from "@/shared/ui/toast"
import { cn } from "@/shared/lib/utils"
import type { process as proc } from "@wails/go/models"
import { ConsolePane } from "./ConsolePane"
import { consoleBadge, consoleInput, type ConsoleInput, type ConsoleTarget } from "./consoleStatus"
import { pushHistory, stepHistory, type HistoryCursor } from "./commandHistory"
import { lineText, useConsoleLines } from "./useConsoleLines"

const TARGETS: ConsoleTarget[] = ["world", "auth"]

export function ConsoleSection({ status }: { status?: proc.Status }) {
  const [tab, setTab] = useState<ConsoleTarget>("world")
  // Lives here so it survives switching tabs.
  const [history, setHistory] = useState<string[]>([])

  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-lg border border-border bg-console">
      <ConsoleView
        key={tab}
        target={tab}
        info={status?.[tab]}
        history={history}
        onSent={(cmd) => setHistory((h) => pushHistory(h, cmd))}
        tabs={
          <div className="flex items-center gap-1">
            {TARGETS.map((t) => (
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
        }
      />
    </div>
  )
}

function ConsoleView({
  target,
  info,
  history,
  onSent,
  tabs,
}: {
  target: ConsoleTarget
  info: proc.ProcInfo | undefined
  history: string[]
  onSent: (cmd: string) => void
  tabs: React.ReactNode
}) {
  const { lines, clear } = useConsoleLines(target)
  const badge = consoleBadge(info)

  const copy = () => {
    const text = lines.map((l) => lineText(l.text)).join("\n")
    runAction(() => ClipboardSetText(text), "Copy console")
      .then(() => toast({ title: `Copied ${lines.length} lines` }))
      .catch(() => {})
  }

  return (
    <>
      <div className="flex items-center justify-between border-b border-border px-2 py-1.5">
        {tabs}
        <div className="flex items-center gap-1">
          <Button size="sm" variant="ghost" title="Copy console output" disabled={!lines.length} onClick={copy}>
            <Copy className="size-3.5" />
          </Button>
          <Button size="sm" variant="ghost" title="Clear console" disabled={!lines.length} onClick={clear}>
            <Trash2 className="size-3.5" />
          </Button>
          <span className="flex items-center gap-1.5 pl-1 pr-1 text-[11px] text-muted-foreground">
            <StatusDot tone={badge.tone} />
            {badge.label}
          </span>
        </div>
      </div>

      <ConsolePane lines={lines} emptyHint={emptyHint(info)} className="flex-1" />

      <CommandInput target={target} input={consoleInput(target, info)} history={history} onSent={onSent} />
    </>
  )
}

function emptyHint(info: proc.ProcInfo | undefined): string {
  if (info?.external) return "This server was started outside CoreForge, so its console is not connected. Adopt it to attach."
  return "No output yet. Start the server to stream its console here."
}

function CommandInput({
  target,
  input,
  history,
  onSent,
}: {
  target: ConsoleTarget
  input: ConsoleInput
  history: string[]
  onSent: (cmd: string) => void
}) {
  const [cmd, setCmd] = useState("")
  const [cursor, setCursor] = useState<HistoryCursor>(null)

  const send = () => {
    const value = cmd.trim()
    if (!value || !input.enabled) return
    onSent(value)
    setCursor(null)
    runAction(() => SendConsole(target, value), "Send command")
      .then(() => setCmd(""))
      .catch(() => {}) // keep the text so it can be fixed and resent
  }

  const recall = (dir: "older" | "newer") => {
    const step = stepHistory(history, cursor, dir)
    if (!step) return
    setCursor(step.cursor)
    setCmd(step.value)
  }

  const onKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") send()
    else if (e.key === "ArrowUp") {
      e.preventDefault()
      recall("older")
    } else if (e.key === "ArrowDown") {
      e.preventDefault()
      recall("newer")
    }
  }

  return (
    <div className="flex items-center gap-2 border-t border-border px-3 py-2">
      <span className={cn("shrink-0 select-none text-xs font-medium", input.enabled ? "text-primary" : "text-muted-foreground")}>
        {target}&nbsp;&gt;
      </span>
      <input
        value={cmd}
        disabled={!input.enabled}
        onChange={(e) => {
          setCmd(e.target.value)
          setCursor(null)
        }}
        onKeyDown={onKeyDown}
        placeholder={input.enabled ? "type a command, ↑ ↓ for history" : input.reason}
        aria-label={`${target} command`}
        className="min-w-0 flex-1 bg-transparent font-mono text-xs outline-none placeholder:text-muted-foreground/60 disabled:cursor-not-allowed"
      />
      <Button size="sm" variant="ghost" onClick={send} disabled={!input.enabled || !cmd.trim()}>
        <Send className="size-3.5" /> Send
      </Button>
    </div>
  )
}
