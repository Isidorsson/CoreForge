import { describe, it, expect } from "vitest"
import { segmentClass, tokenizeLine, type TokenKind } from "./consoleHighlight"

function kinds(line: string): [string, TokenKind | undefined][] {
  return tokenizeLine(line)
    .filter((s) => s.kind)
    .map((s) => [s.text, s.kind])
}

describe("tokenizeLine", () => {
  it("round-trips the line text exactly", () => {
    const line = '[NodeGraphLib.Triggers] OnItem registered for itemId=6948 (ok) in "Main" 0x1F'
    expect(
      tokenizeLine(line)
        .map((s) => s.text)
        .join(""),
    ).toBe(line)
  })

  it("colors the parts of a NodeGraph trigger line", () => {
    expect(kinds("[NodeGraphLib.Triggers] OnItem registered for itemId=6948 (ok)")).toEqual([
      ["[NodeGraphLib.Triggers]", "tag"],
      ["itemId", "key"],
      ["6948", "num"],
      ["(ok)", "good"],
    ])
  })

  it("prefers timestamps and IPs over bare numbers", () => {
    expect(kinds("2026-06-28 12:04:11 client 127.0.0.1:3724 connected")).toEqual([
      ["2026-06-28 12:04:11", "time"],
      ["127.0.0.1:3724", "ip"],
      ["connected", "good"],
    ])
  })

  it("keeps units with their numbers", () => {
    expect(kinds("Loaded 1234 creature templates in 30 ms")).toEqual([
      ["Loaded", "good"],
      ["1234", "num"],
      ["30 ms", "num"],
    ])
  })

  it("marks log levels and failure words", () => {
    expect(kinds("ERROR: Failed to open table")).toEqual([
      ["ERROR", "level"],
      ["Failed", "bad"],
    ])
  })

  it("marks Windows paths without the trailing period", () => {
    expect(kinds("Using configuration file C:/Games/TC/etc/worldserver.conf.")).toEqual([
      ["C:/Games/TC/etc/worldserver.conf", "path"],
    ])
  })

  it("does not split words that merely contain numbers", () => {
    expect(kinds("Map0 loaded")).toEqual([["loaded", "good"]])
  })
})

describe("segmentClass", () => {
  it("styles levels by severity", () => {
    expect(segmentClass({ text: "ERROR", kind: "level" })).toContain("text-danger")
    expect(segmentClass({ text: "WARN", kind: "level" })).toContain("text-warning")
    expect(segmentClass({ text: "plain" })).toBe("")
  })
})
