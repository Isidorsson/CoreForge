import { useState } from "react"
import { runAction } from "@/shared/hooks/useAppData"

export function useBusy() {
  const [busy, setBusy] = useState<string | null>(null)
  const run = (key: string, fn: () => Promise<unknown>, errTitle: string) => {
    setBusy(key)
    runAction(fn, errTitle)
      .catch(() => {})
      .finally(() => setBusy(null))
  }
  return { busy, run }
}
