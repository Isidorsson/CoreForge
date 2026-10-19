import type { Tone } from "@/shared/ui/StatusPill"
import type { process as proc } from "@wails/go/models"

export type ConsoleTarget = "auth" | "world"

export type ConsoleInput = { enabled: true } | { enabled: false; reason: string }

/** Whether commands can be typed into a server's console, and why not. */
export function consoleInput(target: ConsoleTarget, info: proc.ProcInfo | undefined): ConsoleInput {
  if (target === "auth") return { enabled: false, reason: "authserver has no command console" }
  if (!info) return { enabled: false, reason: "world server status unknown" }
  if (info.external) return { enabled: false, reason: "started outside CoreForge: Adopt it to use the console" }
  switch (info.state) {
    case "running":
      return { enabled: true }
    case "starting":
      return { enabled: false, reason: "world server is starting…" }
    case "stopping":
      return { enabled: false, reason: "world server is stopping…" }
    default:
      return { enabled: false, reason: "start the world server to send commands" }
  }
}

/** The connection badge shown next to the console tabs. */
export function consoleBadge(info: proc.ProcInfo | undefined): { tone: Tone; label: string } {
  if (!info) return { tone: "unknown", label: "unknown" }
  if (info.external) return { tone: "transition", label: "external" }
  switch (info.state) {
    case "running":
      return { tone: "on", label: "attached" }
    case "starting":
    case "stopping":
      return { tone: "transition", label: info.state }
    case "crashed":
      return { tone: "error", label: "crashed" }
    default:
      return { tone: "off", label: "stopped" }
  }
}
