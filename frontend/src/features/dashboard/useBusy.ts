import { useState } from "react"
import { runAction } from "@/shared/hooks/useAppData"

export type BusyKeys = ReadonlySet<string>

/** Tracks every in-flight action by key, so concurrent actions never clear each other. */
export function useBusy() {
  const [busy, setBusy] = useState<BusyKeys>(() => new Set())
  const run = (key: string, fn: () => Promise<unknown>, errTitle: string) => {
    if (busy.has(key)) return
    setBusy((prev) => new Set(prev).add(key))
    runAction(fn, errTitle)
      .catch(() => {})
      .finally(() =>
        setBusy((prev) => {
          const next = new Set(prev)
          next.delete(key)
          return next
        }),
      )
  }
  return { busy, run }
}
