import { cn } from "@/lib/utils"

export type Tone = "on" | "transition" | "off" | "error" | "unknown"

const toneClasses: Record<Tone, string> = {
  on: "bg-success/12 text-success ring-success/25",
  transition: "bg-warning/12 text-warning ring-warning/25",
  off: "bg-muted text-muted-foreground ring-border",
  error: "bg-danger/12 text-danger ring-danger/30",
  unknown: "bg-muted text-muted-foreground ring-border",
}

const dotClasses: Record<Tone, string> = {
  on: "bg-success shadow-[0_0_6px_currentColor]",
  transition: "bg-warning animate-blink",
  off: "bg-muted-foreground/50",
  error: "bg-danger shadow-[0_0_6px_currentColor]",
  unknown: "bg-muted-foreground/50",
}

/** Color-blind-safe status: dot + label + color, never color alone. */
export function StatusDot({ tone, className }: { tone: Tone; className?: string }) {
  return <span className={cn("size-1.5 rounded-full", dotClasses[tone], className)} />
}

export function StatusPill({ tone, label, className }: { tone: Tone; label: string; className?: string }) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-[11px] font-medium uppercase tracking-wide ring-1 ring-inset",
        toneClasses[tone],
        className,
      )}
    >
      <StatusDot tone={tone} />
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
