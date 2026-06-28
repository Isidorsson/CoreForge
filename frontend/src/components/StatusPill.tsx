import { cn } from "@/lib/utils"

export type Tone = "on" | "transition" | "off" | "error" | "unknown"

const toneClasses: Record<Tone, string> = {
  on: "bg-success/15 text-success",
  transition: "bg-warning/15 text-warning",
  off: "bg-muted text-muted-foreground",
  error: "bg-danger/15 text-danger",
  unknown: "bg-muted text-muted-foreground",
}

const dotClasses: Record<Tone, string> = {
  on: "bg-success",
  transition: "bg-warning animate-pulse",
  off: "bg-muted-foreground/50",
  error: "bg-danger",
  unknown: "bg-muted-foreground/50",
}

export function StatusPill({ tone, label, className }: { tone: Tone; label: string; className?: string }) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-xs font-medium",
        toneClasses[tone],
        className,
      )}
    >
      <span className={cn("size-1.5 rounded-full", dotClasses[tone])} />
      {label}
    </span>
  )
}

export function procTone(state: string, external?: boolean): { tone: Tone; label: string } {
  switch (state) {
    case "running":
      return { tone: "on", label: external ? "External" : "Running" }
    case "starting":
      return { tone: "transition", label: "Starting" }
    case "stopping":
      return { tone: "transition", label: "Stopping" }
    case "crashed":
      return { tone: "error", label: "Crashed" }
    default:
      return { tone: "off", label: "Stopped" }
  }
}

export function dbTone(state: string): { tone: Tone; label: string } {
  switch (state) {
    case "ready":
      return { tone: "on", label: "Ready" }
    case "starting":
      return { tone: "transition", label: "Starting" }
    case "unhealthy":
      return { tone: "error", label: "Unhealthy" }
    case "down":
      return { tone: "off", label: "Down" }
    default:
      return { tone: "unknown", label: "Unknown" }
  }
}
