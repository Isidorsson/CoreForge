import { memo, useEffect, useRef, useState } from "react"
import { ArrowDown } from "lucide-react"
import { highlightLine } from "@/shared/lib/consoleHighlight"
import { cn } from "@/shared/lib/utils"
import { COMMAND_ECHO_MARKER, type ConsoleLine } from "./useConsoleLines"

const FOLLOW_THRESHOLD_PX = 40

/** A terminal-style view of console lines that follows new output until scrolled up. */
export function ConsolePane({
  lines,
  emptyHint,
  className,
}: {
  lines: ConsoleLine[]
  emptyHint: string
  className?: string
}) {
  const boxRef = useRef<HTMLDivElement>(null)
  const [following, setFollowing] = useState(true)

  useEffect(() => {
    const el = boxRef.current
    if (el && following) el.scrollTop = el.scrollHeight
  }, [lines, following])

  function onScroll() {
    const el = boxRef.current
    if (el) setFollowing(el.scrollHeight - el.scrollTop - el.clientHeight < FOLLOW_THRESHOLD_PX)
  }

  return (
    <div className={cn("relative min-h-0", className)}>
      <div
        ref={boxRef}
        onScroll={onScroll}
        className="h-full overflow-auto bg-console p-3 font-mono text-xs leading-relaxed text-foreground/85"
      >
        {lines.length === 0 ? (
          <p className="font-sans text-muted-foreground">{emptyHint}</p>
        ) : (
          lines.map((l) => <ConsoleRow key={l.id} text={l.text} />)
        )}
      </div>
      {!following && (
        <button
          onClick={() => setFollowing(true)}
          className="absolute bottom-3 right-4 flex items-center gap-1.5 rounded-full border border-border bg-card px-3 py-1 text-[11px] font-medium text-foreground shadow-sm hover:bg-accent"
        >
          <ArrowDown className="size-3" /> Jump to latest
        </button>
      )}
    </div>
  )
}

const ConsoleRow = memo(function ConsoleRow({ text }: { text: string }) {
  if (text.startsWith(COMMAND_ECHO_MARKER)) {
    return (
      <div className="-mx-1.5 my-0.5 flex gap-2 rounded-sm bg-accent/60 px-1.5 font-semibold text-foreground">
        <span className="select-none text-primary">›</span>
        <span className="whitespace-pre-wrap break-all">{text.slice(COMMAND_ECHO_MARKER.length)}</span>
      </div>
    )
  }
  return <div className="whitespace-pre-wrap break-all">{highlightLine(text)}</div>
})
