export const MAX_HISTORY = 100

/** Cursor into history: null while editing a fresh line, else an index into entries. */
export type HistoryCursor = number | null

/** Adds a sent command, skipping an immediate repeat and capping the length. */
export function pushHistory(entries: readonly string[], cmd: string): string[] {
  if (entries.at(-1) === cmd) return [...entries]
  return [...entries, cmd].slice(-MAX_HISTORY)
}

/**
 * Moves through history like a shell: "older" walks back from the newest entry,
 * "newer" walks forward and returns to an empty line past the newest.
 */
export function stepHistory(
  entries: readonly string[],
  cursor: HistoryCursor,
  dir: "older" | "newer",
): { cursor: HistoryCursor; value: string } | null {
  if (entries.length === 0) return null
  if (dir === "older") {
    const next = cursor === null ? entries.length - 1 : Math.max(0, cursor - 1)
    return { cursor: next, value: entries[next] }
  }
  if (cursor === null) return null
  const next = cursor + 1
  return next >= entries.length ? { cursor: null, value: "" } : { cursor: next, value: entries[next] }
}
