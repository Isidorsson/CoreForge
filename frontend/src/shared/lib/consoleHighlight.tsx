import * as React from "react"

/*
 * Token highlighter for server console output. tokenizeLine splits a line into
 * typed segments; highlightLine renders them with the theme's status colors so
 * the console reads at a glance in light and dark mode. Class names are literal
 * strings so Tailwind's scanner keeps them.
 */

export type TokenKind =
  | "time"
  | "level"
  | "tag"
  | "ip"
  | "path"
  | "str"
  | "hex"
  | "file"
  | "key"
  | "good"
  | "bad"
  | "num"

export type Segment = { text: string; kind?: TokenKind }

// Order matters: more specific patterns first (timestamps/IPs before bare numbers,
// log levels before generic error words).
const TOKENS: { kind: TokenKind; re: string }[] = [
  { kind: "time", re: String.raw`\b\d{4}-\d{2}-\d{2}(?:[ T]\d{2}:\d{2}:\d{2})?\b|\b\d{1,2}:\d{2}:\d{2}\b` },
  { kind: "level", re: String.raw`\b(?:FATAL|ERROR|WARN(?:ING)?|INFO|NOTICE|DEBUG|TRACE)\b` },
  { kind: "tag", re: String.raw`\[[A-Za-z][^\]\s]{0,48}\]` },
  { kind: "ip", re: String.raw`\b\d{1,3}(?:\.\d{1,3}){3}(?::\d+)?\b` },
  { kind: "path", re: String.raw`\b[A-Za-z]:[\\/][^\s'"]*[^\s'".,:;)]` },
  { kind: "str", re: String.raw`"[^"]*"|'[^']*'` },
  {
    kind: "hex",
    re: String.raw`\b0x[0-9a-fA-F]+\b|\b[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}\b`,
  },
  { kind: "file", re: String.raw`\b[\w.-]+\.(?:conf|log|sql|dll|exe|lua|dist|dbc|db2|map|vmap|mmap)\b` },
  { kind: "key", re: String.raw`\b[A-Za-z_][\w.]*(?==)` },
  {
    kind: "good",
    re: String.raw`\((?:ok|OK)\)|\b(?:OK|ok|[Ss]uccess(?:ful(?:ly)?)?|[Dd]one|[Rr]eady|[Ll]oaded|[Ee]nabled|[Cc]onnected)\b`,
  },
  {
    kind: "bad",
    re: String.raw`\b(?:[Ee]rror|[Ff]ail(?:ed|ure)?|[Ee]xception|[Cc]rash(?:ed)?|[Ii]nvalid|[Mm]issing|[Uu]nable|[Cc]annot|[Dd]isabled)\b`,
  },
  { kind: "num", re: String.raw`\b\d+(?:\.\d+)?(?:%|\s?(?:ms|MB|KB|GB)\b)?` },
]

const COMBINED = new RegExp(TOKENS.map((t) => `(?<${t.kind}>${t.re})`).join("|"), "g")

const KIND_CLASS: Record<Exclude<TokenKind, "level">, string> = {
  time: "text-muted-foreground",
  tag: "text-info",
  ip: "text-info",
  path: "text-info/80",
  str: "text-success/90",
  hex: "text-warning/80",
  file: "text-info/80",
  key: "text-muted-foreground",
  good: "text-success",
  bad: "text-danger",
  num: "text-warning",
}

function levelClass(word: string): string {
  if (word === "ERROR" || word === "FATAL") return "text-danger font-semibold"
  if (word.startsWith("WARN")) return "text-warning font-semibold"
  if (word === "INFO" || word === "NOTICE") return "text-info font-medium"
  return "text-muted-foreground"
}

export function segmentClass(seg: Segment): string {
  if (!seg.kind) return ""
  return seg.kind === "level" ? levelClass(seg.text) : KIND_CLASS[seg.kind]
}

/** Splits a line into plain and typed segments, in order. */
export function tokenizeLine(line: string): Segment[] {
  const out: Segment[] = []
  let last = 0
  for (const m of line.matchAll(COMBINED)) {
    if (m[0] === "") continue
    if (m.index > last) out.push({ text: line.slice(last, m.index) })
    const groups = m.groups ?? {}
    const hit = TOKENS.find((t) => groups[t.kind] !== undefined)
    out.push({ text: m[0], kind: hit?.kind })
    last = m.index + m[0].length
  }
  if (last < line.length) out.push({ text: line.slice(last) })
  return out
}

/** Returns the line split into colored spans and plain text. */
export function highlightLine(line: string): React.ReactNode {
  return tokenizeLine(line).map((seg, i) =>
    seg.kind ? (
      <span key={i} className={segmentClass(seg)}>
        {seg.text}
      </span>
    ) : (
      seg.text
    ),
  )
}
