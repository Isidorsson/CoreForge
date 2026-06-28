import { useQuery, useQueryClient } from "@tanstack/react-query"
import { GetState, GetStatus, GetServerMetrics } from "../../wailsjs/go/main/App"
import { useWailsEvent } from "./useWailsEvent"
import { toast } from "@/lib/toast"
import { errorMessage } from "@/lib/format"
import type { process as proc } from "../../wailsjs/go/models"

/** Stable query keys. */
export const qk = {
  state: ["state"] as const,
  status: ["status"] as const,
  logs: ["logs"] as const,
  configs: ["configs"] as const,
  configBackups: (id: string) => ["configBackups", id] as const,
  files: (rel: string) => ["files", rel] as const,
  disk: ["disk"] as const,
  metrics: ["metrics"] as const,
}

/** App bootstrap state (active core, installs, options). Refetches on app:state. */
export function useAppState() {
  const qc = useQueryClient()
  useWailsEvent("app:state", () => {
    qc.invalidateQueries({ queryKey: qk.state })
  })
  return useQuery({ queryKey: qk.state, queryFn: GetState })
}

/** Live server/DB status. Seeded by GetStatus, then kept fresh by status:changed. */
export function useStatus() {
  const qc = useQueryClient()
  useWailsEvent<proc.Status>("status:changed", (s) => {
    qc.setQueryData(qk.status, s)
  })
  return useQuery({ queryKey: qk.status, queryFn: GetStatus, refetchInterval: 4000 })
}

/** Server metrics snapshot. Heavy query — manual refetch, no auto-retry so a
 *  DB connection error surfaces immediately. */
export function useMetrics() {
  return useQuery({ queryKey: qk.metrics, queryFn: GetServerMetrics, staleTime: 30_000, retry: false })
}

/** Surface backend error events as toasts (registered once at the shell). */
export function useErrorToasts() {
  useWailsEvent<{ op?: string; message?: string }>("app:error", (e) => {
    toast({ variant: "error", title: e.op || "Error", description: e.message })
  })
}

/** Run a bound action, returning its result and toasting on failure. */
export async function runAction<T>(fn: () => Promise<T>, errTitle: string): Promise<T> {
  try {
    return await fn()
  } catch (err) {
    toast({ variant: "error", title: errTitle, description: errorMessage(err) })
    throw err
  }
}
