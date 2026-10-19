import { useCallback, useEffect, useRef, useState } from "react"
import { ClearConsole, GetBacklog } from "@wails/go/main/App"
import { runAction } from "@/shared/hooks/useAppData"
import { useWailsEvent } from "@/shared/hooks/useWailsEvent"
import type { ConsoleTarget } from "./consoleStatus"

export const MAX_LINES = 2000

/** Prefixes lines that record a command sent from CoreForge (mirrors commandEchoMarker in Go). */
export const COMMAND_ECHO_MARKER = "\u001e"

/** A console line with a stable id, so trimming old lines does not re-render the rest. */
export type ConsoleLine = { id: number; text: string }

/** A server's console backlog followed by its live output. Key the caller by target. */
export function useConsoleLines(target: ConsoleTarget) {
  const [lines, setLines] = useState<ConsoleLine[]>([])
  const nextId = useRef(0)
  const toLines = useCallback((texts: string[]) => texts.map((text) => ({ id: nextId.current++, text })), [])

  useEffect(() => {
    let alive = true
    runAction(() => GetBacklog(target), "Load console")
      .then((backlog) => {
        if (alive) setLines(toLines(backlog ?? []).slice(-MAX_LINES))
      })
      .catch(() => {}) // runAction already reported it
    return () => {
      alive = false
    }
  }, [target, toLines])

  useWailsEvent<{ target: string; lines: string[] }>("proc:output", (p) => {
    if (p.target !== target || !p.lines) return
    setLines((prev) => prev.concat(toLines(p.lines)).slice(-MAX_LINES))
  })

  const clear = () => {
    setLines([])
    runAction(() => ClearConsole(target), "Clear console").catch(() => {})
  }

  return { lines, clear }
}

/** The plain text of a line, as it would be copied. */
export function lineText(text: string): string {
  return text.startsWith(COMMAND_ECHO_MARKER) ? `> ${text.slice(COMMAND_ECHO_MARKER.length)}` : text
}
