import { useEffect, useRef, useState } from "react"
import { ScrollText, Archive, Eraser, FileText } from "lucide-react"
import {
  ListLogs,
  ReadLog,
  StartLogTail,
  StopLogTail,
  ClearLog,
  ArchiveLogs,
} from "@wails/go/main/App"
import { useQuery, useQueryClient } from "@tanstack/react-query"
import { useAppState, runAction, qk } from "@/shared/hooks/useAppData"
import { useWailsEvent } from "@/shared/hooks/useWailsEvent"
import { Button, Badge, Spinner } from "@/shared/ui/primitives"
import { ConfirmDialog } from "@/shared/ui/dialog"
import { PageHeader, NotConfigured, EmptyState } from "@/shared/ui/Page"
import { toast } from "@/shared/ui/toast"
import { formatBytes, formatRelative, errorMessage } from "@/shared/lib/format"
import { highlightLine } from "@/shared/lib/consoleHighlight"
import { cn } from "@/shared/lib/utils"
import type { logs } from "@wails/go/models"

const MAX_LINES = 3000

export function LogsPage() {
  const { data: state } = useAppState()
  const queryClient = useQueryClient()
  const { data: entries, isLoading } = useQuery({ queryKey: qk.logs, queryFn: ListLogs })

  const [selectedKind, setSelectedKind] = useState<string | null>(null)
  const [lines, setLines] = useState<string[]>([])
  const [confirmClear, setConfirmClear] = useState(false)
  const [clearing, setClearing] = useState(false)
  const [archiving, setArchiving] = useState(false)

  const boxRef = useRef<HTMLDivElement>(null)
  const stick = useRef(true)

  // Load + tail the selected log; stop tailing the previous one on change/unmount.
  useEffect(() => {
    if (!selectedKind) return
    const kind = selectedKind
    let alive = true
    stick.current = true
    setLines([])
    ReadLog(kind).then((l) => alive && l && setLines(l)).catch(() => {})
    StartLogTail(kind).catch(() => {})
    return () => {
      alive = false
      StopLogTail(kind).catch(() => {})
    }
  }, [selectedKind])

  useWailsEvent<{ kind: string; lines?: string[]; reset?: boolean }>("log:line", (p) => {
    if (p.kind !== selectedKind) return
    if (p.reset) {
      setLines([])
      return
    }
    if (!p.lines) return
    setLines((prev) => {
      const next = prev.concat(p.lines!)
      return next.length > MAX_LINES ? next.slice(next.length - MAX_LINES) : next
    })
  })

  useEffect(() => {
    const el = boxRef.current
    if (el && stick.current) el.scrollTop = el.scrollHeight
  }, [lines])

  function onScroll() {
    const el = boxRef.current
    if (!el) return
    stick.current = el.scrollHeight - el.scrollTop - el.clientHeight < 40
  }

  if (state && !state.configured) return <NotConfigured />

  const list = entries ?? []
  const selected = list.find((e) => e.kind === selectedKind) ?? null

  async function archiveAll() {
    setArchiving(true)
    try {
      const path = await ArchiveLogs([])
      toast({ variant: "success", title: "Logs archived", description: path })
      queryClient.invalidateQueries({ queryKey: qk.logs })
    } catch (err) {
      toast({ variant: "error", title: "Archive logs", description: errorMessage(err) })
    } finally {
      setArchiving(false)
    }
  }

  function archiveOne(kind: string) {
    runAction(async () => {
      const path = await ArchiveLogs([kind])
      toast({ variant: "success", title: "Log archived", description: path })
      queryClient.invalidateQueries({ queryKey: qk.logs })
    }, "Archive log").catch(() => {})
  }

  function clearSelected() {
    if (!selected) return
    setClearing(true)
    runAction(() => ClearLog(selected.kind), "Clear log")
      .then(() => {
        setLines([])
        toast({ variant: "success", title: `Cleared ${selected.displayName}` })
        queryClient.invalidateQueries({ queryKey: qk.logs })
      })
      .catch(() => {})
      .finally(() => {
        setClearing(false)
        setConfirmClear(false)
      })
  }

  return (
    <div className="flex h-full flex-col gap-4 p-5">
      <PageHeader
        title="Logs"
        description="View, tail, clear and archive server logs"
        actions={
          <Button size="sm" variant="secondary" loading={archiving} onClick={archiveAll}>
            <Archive className="size-3.5" /> Archive all
          </Button>
        }
      />

      {isLoading ? (
        <div className="flex flex-1 items-center justify-center">
          <Spinner />
        </div>
      ) : list.length === 0 ? (
        <EmptyState icon={ScrollText} title="No logs found" hint="The active core has no known log files yet." />
      ) : (
        <div className="flex min-h-0 flex-1 gap-4">
          <div className="flex w-64 shrink-0 flex-col overflow-hidden rounded-lg border border-border bg-card/40">
            <div className="flex items-center justify-between border-b border-border px-3 py-2">
              <span className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">Log files</span>
              <span className="text-[11px] tabular-nums text-muted-foreground">{list.length}</span>
            </div>
            <ul className="min-h-0 flex-1 space-y-0.5 overflow-auto p-1.5">
              {list.map((entry) => (
                <LogRow
                  key={entry.kind}
                  entry={entry}
                  active={entry.kind === selectedKind}
                  onSelect={() => setSelectedKind(entry.kind)}
                />
              ))}
            </ul>
          </div>

          {!selected ? (
            <div className="flex min-h-0 flex-1 items-center justify-center rounded-lg border border-border bg-console">
              <EmptyState icon={FileText} title="Select a log" hint="Pick a log on the left to view and tail it." />
            </div>
          ) : (
            <div className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-lg border border-border bg-console">
              <header className="flex items-center justify-between gap-2 border-b border-border px-3 py-2">
                <div className="flex min-w-0 items-center gap-2 text-sm font-medium">
                  <FileText className="size-4 shrink-0 text-muted-foreground" />
                  <span className="truncate">{selected.displayName}</span>
                  <span className="shrink-0 text-xs font-normal tabular-nums text-muted-foreground">
                    {formatBytes(selected.size)}
                  </span>
                  <span className="flex shrink-0 items-center gap-1.5 text-[11px] text-muted-foreground">
                    <span className="size-1.5 rounded-full bg-success animate-blink" />
                    tailing
                  </span>
                </div>
                <div className="flex shrink-0 items-center gap-2">
                  <Button size="sm" variant="outline" disabled={!selected.archivable} onClick={() => archiveOne(selected.kind)}>
                    <Archive className="size-3.5" /> Archive
                  </Button>
                  <Button size="sm" variant="outline" disabled={!selected.clearable} onClick={() => setConfirmClear(true)}>
                    <Eraser className="size-3.5" /> Clear
                  </Button>
                </div>
              </header>
              <div
                ref={boxRef}
                onScroll={onScroll}
                className="min-h-0 flex-1 overflow-auto bg-console p-3 font-mono text-xs leading-relaxed text-foreground/90"
              >
                {lines.length === 0 ? (
                  <p className="font-sans text-muted-foreground">No output yet — this log is empty or hasn't been written to.</p>
                ) : (
                  lines.map((l, i) => (
                    <div key={i} className="whitespace-pre-wrap break-all">
                      {highlightLine(l)}
                    </div>
                  ))
                )}
              </div>
            </div>
          )}
        </div>
      )}

      <ConfirmDialog
        open={confirmClear}
        title={selected ? `Clear ${selected.displayName}?` : "Clear log?"}
        description="This truncates the log file in place — existing lines are discarded. It is safe to do while the server is running."
        confirmLabel="Clear log"
        confirmVariant="destructive"
        loading={clearing}
        onConfirm={clearSelected}
        onClose={() => setConfirmClear(false)}
      />
    </div>
  )
}

function LogRow({
  entry,
  active,
  onSelect,
}: {
  entry: logs.LogEntry
  active: boolean
  onSelect: () => void
}) {
  return (
    <li>
      <button
        onClick={onSelect}
        className={cn(
          "group relative flex w-full flex-col gap-0.5 rounded-md px-2.5 py-1.5 text-left transition-colors",
          active ? "bg-accent" : "hover:bg-accent/50",
        )}
      >
        <span
          className={cn(
            "absolute left-0 top-1/2 h-4 w-[3px] -translate-y-1/2 rounded-r-full bg-primary transition-opacity",
            active ? "opacity-100" : "opacity-0",
          )}
        />
        <div className="flex items-center justify-between gap-2">
          <span className="truncate text-sm font-medium">{entry.displayName}</span>
          {!entry.exists && (
            <Badge variant="outline" className="shrink-0">
              missing
            </Badge>
          )}
        </div>
        <div className="text-[11px] tabular-nums text-muted-foreground">
          {entry.exists ? `${formatBytes(entry.size)} · ${formatRelative(entry.modified)}` : "—"}
        </div>
      </button>
    </li>
  )
}
