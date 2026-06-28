import * as React from "react"

/*
 * Lightweight token highlighter for server/console output. Splits a line into
 * spans and colors numbers, IPs, timestamps, quoted strings, hex/GUIDs and log
 * levels. Class names are literal strings so Tailwind's scanner keeps them.
 */

type Token = { name: string; re: string; cls: string }

// Order matters: more specific patterns first (timestamps/IPs before bare numbers).
const TOKENS: Token[] = [
  {
    name: "time",
    re: String.raw`\b\d{4}-\d{2}-\d{2}(?:[ T]\d{2}:\d{2}:\d{2})?\b|\b\d{1,2}:\d{2}:\d{2}\b`,
    cls: "text-zinc-500",
  },
  { name: "level", re: String.raw`\b(?:FATAL|ERROR|WARN(?:ING)?|INFO|NOTICE|DEBUG|TRACE)\b`, cls: "" },
  { name: "ip", re: String.raw`\b\d{1,3}(?:\.\d{1,3}){3}(?::\d+)?\b`, cls: "text-cyan-400" },
  { name: "str", re: String.raw`"[^"]*"|'[^']*'`, cls: "text-emerald-400" },
  { name: "hex", re: String.raw`\b0x[0-9a-fA-F]+\b`, cls: "text-fuchsia-400" },
  { name: "url", re: String.raw`\b[\w.-]+\.(?:conf|log|sql|dll|exe|lua|dist)\b`, cls: "text-sky-400" },
  { name: "num", re: String.raw`\b\d+(?:\.\d+)?\b`, cls: "text-amber-400" },
]

const COMBINED = new RegExp(TOKENS.map((t) => `(?<${t.name}>${t.re})`).join("|"), "g")

function levelClass(word: string): string {
  const u = word.toUpperCase()
  if (u === "ERROR" || u === "FATAL") return "text-red-400 font-semibold"
  if (u.startsWith("WARN")) return "text-amber-400 font-semibold"
  if (u === "INFO" || u === "NOTICE") return "text-sky-400 font-medium"
  return "text-zinc-500"
}

/** Returns the line split into colored spans + plain text. */
export function highlightLine(line: string): React.ReactNode {
  const nodes: React.ReactNode[] = []
  let last = 0
  let key = 0
  COMBINED.lastIndex = 0
  let m: RegExpExecArray | null
  while ((m = COMBINED.exec(line)) !== null) {
    if (m.index > last) nodes.push(line.slice(last, m.index))
    const groups = m.groups ?? {}
    const hit = TOKENS.find((t) => groups[t.name] !== undefined)
    const cls = hit?.name === "level" ? levelClass(m[0]) : (hit?.cls ?? "")
    nodes.push(
      <span key={key++} className={cls}>
        {m[0]}
      </span>,
    )
    last = m.index + m[0].length
    if (m[0].length === 0) COMBINED.lastIndex++ // guard against zero-width loops
  }
  if (last < line.length) nodes.push(line.slice(last))
  return nodes
}
