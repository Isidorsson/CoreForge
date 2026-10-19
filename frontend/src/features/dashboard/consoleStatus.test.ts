import { describe, it, expect } from "vitest"
import type { process as proc } from "@wails/go/models"
import { consoleBadge, consoleInput } from "./consoleStatus"
import { MAX_HISTORY, pushHistory, stepHistory } from "./commandHistory"

function info(state: string, external = false): proc.ProcInfo {
  return { state, external, pid: 1, startedAt: 0 } as proc.ProcInfo
}

describe("consoleInput", () => {
  it("enables input only for a running, CoreForge-owned world server", () => {
    expect(consoleInput("world", info("running"))).toEqual({ enabled: true })
  })

  it("explains why the authserver never takes commands", () => {
    expect(consoleInput("auth", info("running"))).toEqual({ enabled: false, reason: "authserver has no command console" })
  })

  it("points an external server at Adopt", () => {
    const r = consoleInput("world", info("running", true))
    expect(r.enabled).toBe(false)
    expect(!r.enabled && r.reason).toMatch(/adopt/i)
  })

  it.each(["stopped", "crashed", "starting", "stopping"])("disables input while %s", (state) => {
    expect(consoleInput("world", info(state)).enabled).toBe(false)
  })
})

describe("consoleBadge", () => {
  it.each([
    [info("running"), "attached", "on"],
    [info("running", true), "external", "transition"],
    [info("crashed"), "crashed", "error"],
    [info("stopped"), "stopped", "off"],
    [undefined, "unknown", "unknown"],
  ])("labels %o as %s", (i, label, tone) => {
    expect(consoleBadge(i)).toEqual({ label, tone })
  })
})

describe("command history", () => {
  it("skips an immediate repeat and caps its length", () => {
    expect(pushHistory(["a"], "a")).toEqual(["a"])
    const full = Array.from({ length: MAX_HISTORY }, (_, i) => String(i))
    const next = pushHistory(full, "new")
    expect(next).toHaveLength(MAX_HISTORY)
    expect(next.at(-1)).toBe("new")
  })

  it("walks back from the newest entry and stops at the oldest", () => {
    const h = ["first", "second"]
    const a = stepHistory(h, null, "older")
    expect(a).toEqual({ cursor: 1, value: "second" })
    const b = stepHistory(h, 1, "older")
    expect(b).toEqual({ cursor: 0, value: "first" })
    expect(stepHistory(h, 0, "older")).toEqual({ cursor: 0, value: "first" })
  })

  it("walks forward and returns to an empty line past the newest", () => {
    const h = ["first", "second"]
    expect(stepHistory(h, 0, "newer")).toEqual({ cursor: 1, value: "second" })
    expect(stepHistory(h, 1, "newer")).toEqual({ cursor: null, value: "" })
    expect(stepHistory(h, null, "newer")).toBeNull()
  })

  it("does nothing with no history", () => {
    expect(stepHistory([], null, "older")).toBeNull()
  })
})
