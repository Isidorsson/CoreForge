/** Human-readable byte size (1024-based). */
export function formatBytes(n: number): string {
  if (!n || n < 0) return "0 B"
  const units = ["B", "KB", "MB", "GB", "TB"]
  let v = n
  let i = 0
  while (v >= 1024 && i < units.length - 1) {
    v /= 1024
    i++
  }
  return `${v.toFixed(i > 0 && v < 100 ? 1 : 0)} ${units[i]}`
}

/** Locale date+time from a Go time.Time JSON value (string), or em-dash. */
export function formatDateTime(value: unknown): string {
  if (!value) return "—"
  const d = new Date(value as string)
  if (Number.isNaN(d.getTime())) return "—"
  return d.toLocaleString()
}

/** Compact relative time ("3m ago", "just now"). */
export function formatRelative(value: unknown): string {
  if (!value) return "—"
  const t = new Date(value as string).getTime()
  if (Number.isNaN(t)) return "—"
  const secs = Math.floor((Date.now() - t) / 1000)
  if (secs < 5) return "just now"
  if (secs < 60) return `${secs}s ago`
  const mins = Math.floor(secs / 60)
  if (mins < 60) return `${mins}m ago`
  const hrs = Math.floor(mins / 60)
  if (hrs < 24) return `${hrs}h ago`
  const days = Math.floor(hrs / 24)
  return `${days}d ago`
}

/** Uptime from a unix-ms start timestamp (0 → em-dash). */
export function formatUptime(startedAtMs: number): string {
  if (!startedAtMs) return "—"
  let s = Math.floor((Date.now() - startedAtMs) / 1000)
  if (s < 0) s = 0
  const h = Math.floor(s / 3600)
  const m = Math.floor((s % 3600) / 60)
  const sec = s % 60
  if (h > 0) return `${h}h ${m}m`
  if (m > 0) return `${m}m ${sec}s`
  return `${sec}s`
}

/** Gold amount from a raw copper value ("21,474g"). Sub-gold is dropped — the
 *  metrics page deals in totals where copper/silver precision is just noise. */
export function formatGold(copper: number): string {
  if (!copper || copper < 0) return "0g"
  return `${Math.floor(copper / 10000).toLocaleString()}g`
}

/** /played duration from a seconds count ("12d 4h", "3h 20m", "45m"). */
export function formatPlaytime(seconds: number): string {
  if (!seconds || seconds < 0) return "—"
  const d = Math.floor(seconds / 86400)
  const h = Math.floor((seconds % 86400) / 3600)
  const m = Math.floor((seconds % 3600) / 60)
  if (d > 0) return `${d}d ${h}h`
  if (h > 0) return `${h}h ${m}m`
  return `${m}m`
}

/** Compact count for big KPI numbers (1.2k, 3.4M); small values pass through. */
export function formatCompact(n: number): string {
  if (Math.abs(n) < 1000) return n.toLocaleString()
  return Intl.NumberFormat(undefined, { notation: "compact", maximumFractionDigits: 1 }).format(n)
}

/** Normalize unknown thrown values (Wails rejects with strings) to a message. */
export function errorMessage(err: unknown): string {
  if (typeof err === "string") return err
  if (err instanceof Error) return err.message
  return String(err)
}
