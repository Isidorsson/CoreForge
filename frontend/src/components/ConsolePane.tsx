import { useEffect, useRef, useState } from "react"
import { GetBacklog } from "../../wailsjs/go/main/App"
import { useWailsEvent } from "@/hooks/useWailsEvent"
import { highlightLine } from "@/lib/consoleHighlight"
import { cn } from "@/lib/utils"

const MAX_LINES = 2000

/** A terminal-style pane that shows a process's backlog then streams live output. */
export function ConsolePane({ target, className }: { target: "auth" | "world"; className?: string }) {
  const [lines, setLines] = useState<string[]>([])
  const boxRef = useRef<HTMLDivElement>(null)
  const stick = useRef(true)

  useEffect(() => {
    let alive = true
    setLines([])
    GetBacklog(target).then((b) => {
      if (alive && b) setLines(b)
    })
    return () => {
      alive = false
    }
  }, [target])

  useWailsEvent<{ target: string; lines: string[] }>("proc:output", (p) => {
    if (p.target !== target || !p.lines) return
    setLines((prev) => {
      const next = prev.concat(p.lines)
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

  return (
    <div
      ref={boxRef}
      onScroll={onScroll}
      className={cn(
        "h-full overflow-auto rounded-md border border-border bg-[oklch(0.13_0.012_252)] p-3 font-mono text-xs leading-relaxed text-foreground/90",
        className,
      )}
    >
      {lines.length === 0 ? (
        <p className="text-muted-foreground">No output yet — start the server to stream its console here.</p>
      ) : (
        lines.map((l, i) => (
          <div key={i} className="whitespace-pre-wrap break-all">
            {highlightLine(l)}
          </div>
        ))
      )}
    </div>
  )
}
