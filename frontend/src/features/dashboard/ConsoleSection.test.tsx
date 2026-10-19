import { describe, it, expect, vi, beforeEach } from "vitest"
import { act, render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import type { process as proc } from "@wails/go/models"
import { ConsoleSection } from "./ConsoleSection"
import { COMMAND_ECHO_MARKER } from "./useConsoleLines"

const bus = vi.hoisted(() => ({ handlers: new Map<string, (data: unknown) => void>() }))

vi.mock("@wails/runtime/runtime", () => ({
  EventsOn: (name: string, cb: (data: unknown) => void) => {
    bus.handlers.set(name, cb)
    return () => bus.handlers.delete(name)
  },
  ClipboardSetText: vi.fn(async () => true),
}))

vi.mock("@wails/go/main/App", () => ({
  GetBacklog: vi.fn(async () => ["[World] started"]),
  ClearConsole: vi.fn(async () => {}),
  SendConsole: vi.fn(async () => {}),
}))

const App = await import("@wails/go/main/App")

function status(world: Partial<proc.ProcInfo>): proc.Status {
  const base = { state: "running", pid: 1, startedAt: 0, external: false }
  return { auth: { ...base, target: "auth" }, world: { ...base, target: "world", ...world } } as proc.Status
}

function emitOutput(lines: string[]) {
  act(() => bus.handlers.get("proc:output")?.({ target: "world", lines }))
}

beforeEach(() => vi.clearAllMocks())

describe("ConsoleSection", () => {
  it("sends a command, clears the input and shows the echoed command", async () => {
    render(<ConsoleSection status={status({})} />)
    const input = screen.getByRole("textbox", { name: "world command" })
    await userEvent.type(input, "server info{Enter}")
    expect(App.SendConsole).toHaveBeenCalledWith("world", "server info")
    expect(input).toHaveValue("")

    emitOutput([`${COMMAND_ECHO_MARKER}server info`, "Players online: 0"])
    expect(await screen.findByText("server info")).toBeInTheDocument()
    expect(screen.getByText((_, el) => el?.textContent === "Players online: 0" && el.tagName === "DIV")).toBeInTheDocument()
  })

  it("recalls earlier commands with the arrow keys", async () => {
    render(<ConsoleSection status={status({})} />)
    const input = screen.getByRole("textbox", { name: "world command" })
    await userEvent.type(input, "first{Enter}")
    await userEvent.type(input, "second{Enter}")
    await userEvent.keyboard("{ArrowUp}")
    expect(input).toHaveValue("second")
    await userEvent.keyboard("{ArrowUp}")
    expect(input).toHaveValue("first")
    await userEvent.keyboard("{ArrowDown}{ArrowDown}")
    expect(input).toHaveValue("")
  })

  it("keeps the command when sending fails so it can be retried", async () => {
    vi.mocked(App.SendConsole).mockRejectedValueOnce(new Error("pipe closed"))
    render(<ConsoleSection status={status({})} />)
    const input = screen.getByRole("textbox", { name: "world command" })
    await userEvent.type(input, "saveall{Enter}")
    expect(input).toHaveValue("saveall")
  })

  it("disables input for an external server and says why", () => {
    render(<ConsoleSection status={status({ external: true })} />)
    const input = screen.getByRole("textbox", { name: "world command" })
    expect(input).toBeDisabled()
    expect(input).toHaveAttribute("placeholder", expect.stringMatching(/adopt/i))
    expect(screen.getByText("external")).toBeInTheDocument()
  })

  it("explains that the auth tab is output only", async () => {
    render(<ConsoleSection status={status({})} />)
    await userEvent.click(screen.getByRole("button", { name: "auth" }))
    expect(screen.getByRole("textbox", { name: "auth command" })).toHaveAttribute(
      "placeholder",
      "authserver has no command console",
    )
  })

  it("clears both the view and the stored backlog", async () => {
    render(<ConsoleSection status={status({})} />)
    expect(await screen.findByText("[World]", { exact: false })).toBeInTheDocument()
    await userEvent.click(screen.getByTitle("Clear console"))
    expect(App.ClearConsole).toHaveBeenCalledWith("world")
    expect(screen.queryByText("[World]", { exact: false })).toBeNull()
  })
})
