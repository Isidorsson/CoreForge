import { describe, it, expect, vi, beforeEach, afterEach } from "vitest"
import { act, fireEvent, render, screen, waitFor } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { SettingsPage } from "./SettingsPage"

type Override = { host: string; port: string; user: string; pass: string; authDb: string; worldDb: string; charDb: string }
type Install = { type: string; installDir: string; dockerComposeOverride?: string; dockerContainerOverride?: string }

const emptyOverride: Override = { host: "", port: "", user: "", pass: "", authDb: "", worldDb: "", charDb: "" }

const backend = vi.hoisted(() => ({
  listeners: new Map<string, () => void>(),
  state: {} as {
    cores: { type: string; displayName: string; installDir: string; configured: boolean }[]
    settings: {
      activeCore: string
      installs: Record<string, Install>
      logTailLines: number
      confirmDestructive: boolean
      stopServersOnExit: boolean
      metricsDb?: Override
    }
  },
}))

/** Mimics the Go side: every settings write emits app:state. */
function emitState() {
  act(() => backend.listeners.get("app:state")?.())
}

vi.mock("@wails/runtime/runtime", () => ({
  EventsOn: (name: string, cb: () => void) => {
    backend.listeners.set(name, cb)
    return () => backend.listeners.delete(name)
  },
}))

vi.mock("@wails/go/main/App", () => ({
  GetState: vi.fn(async () => structuredClone(backend.state)),
  SetActiveCore: vi.fn(async () => {}),
  SetInstallDir: vi.fn(async (type: string, dir: string) => {
    backend.state.settings.installs[type].installDir = dir
  }),
  BrowseForDirectory: vi.fn(async () => ""),
  SetDockerOverride: vi.fn(async () => {}),
  GetMetricsDBInfo: vi.fn(async () => ({ host: "", port: "", user: "", authDb: "", worldDb: "", charDb: "", source: "auto", hasPass: false })),
  TestMetricsConnection: vi.fn(async () => ({})),
  SetMetricsDBOverride: vi.fn(async () => {}),
  UpdateOptions: vi.fn(async (lines: number, confirm: boolean, stop: boolean) => {
    Object.assign(backend.state.settings, { logTailLines: lines, confirmDestructive: confirm, stopServersOnExit: stop })
  }),
}))

const App = await import("@wails/go/main/App")

function renderSettings() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return render(
    <QueryClientProvider client={client}>
      <SettingsPage />
    </QueryClientProvider>,
  )
}

beforeEach(() => {
  vi.clearAllMocks()
  backend.state = {
    cores: [{ type: "trinity", displayName: "TrinityCore", installDir: "C:\\tc", configured: true }],
    settings: {
      activeCore: "trinity",
      installs: { trinity: { type: "trinity", installDir: "C:\\tc", dockerComposeOverride: "a.yml", dockerContainerOverride: "db" } },
      logTailLines: 500,
      confirmDestructive: true,
      stopServersOnExit: false,
      metricsDb: { ...emptyOverride, host: "10.0.0.1" },
    },
  }
})

describe("InstallRow", () => {
  it("saves the trimmed draft on blur", async () => {
    renderSettings()
    const input = await screen.findByDisplayValue("C:\\tc")
    await userEvent.clear(input)
    await userEvent.type(input, "  D:\\new  ")
    await userEvent.tab()
    expect(App.SetInstallDir).toHaveBeenCalledWith("trinity", "D:\\new")
  })

  it("saves on Enter and skips unchanged values", async () => {
    renderSettings()
    const input = await screen.findByDisplayValue("C:\\tc")
    await userEvent.type(input, "{Enter}")
    expect(App.SetInstallDir).not.toHaveBeenCalled()
    await userEvent.type(input, "2{Enter}")
    expect(App.SetInstallDir).toHaveBeenCalledWith("trinity", "C:\\tc2")
  })

  it("resets the draft when the install dir changes", async () => {
    renderSettings()
    const input = await screen.findByDisplayValue("C:\\tc")
    await userEvent.type(input, "-draft")
    backend.state.settings.installs.trinity.installDir = "E:\\moved"
    emitState()
    expect(await screen.findByDisplayValue("E:\\moved")).toBeInTheDocument()
  })

  it("reverts the draft when saving fails", async () => {
    vi.mocked(App.SetInstallDir).mockRejectedValueOnce(new Error("nope"))
    renderSettings()
    const input = await screen.findByDisplayValue("C:\\tc")
    await userEvent.type(input, "x{Enter}")
    expect(await screen.findByDisplayValue("C:\\tc")).toBeInTheDocument()
  })
})

describe("DockerCard", () => {
  it("saves edited overrides", async () => {
    renderSettings()
    await userEvent.type(await screen.findByDisplayValue("a.yml"), "x")
    await userEvent.click(screen.getByRole("button", { name: "Save overrides" }))
    expect(App.SetDockerOverride).toHaveBeenCalledWith("trinity", "a.ymlx", "db")
  })

  it("resets drafts when the overrides change", async () => {
    renderSettings()
    await userEvent.type(await screen.findByDisplayValue("db"), "-draft")
    backend.state.settings.installs.trinity.dockerContainerOverride = "other"
    emitState()
    expect(await screen.findByDisplayValue("other")).toBeInTheDocument()
    expect(screen.getByDisplayValue("a.yml")).toBeInTheDocument()
  })
})

describe("MetricsDBCard", () => {
  it("saves the edited override", async () => {
    renderSettings()
    await userEvent.type(await screen.findByDisplayValue("10.0.0.1"), "0")
    await userEvent.click(screen.getByRole("button", { name: "Save override" }))
    expect(App.SetMetricsDBOverride).toHaveBeenCalledWith({ ...emptyOverride, host: "10.0.0.10" })
  })

  it("keeps the draft across unrelated state refreshes", async () => {
    renderSettings()
    await userEvent.type(await screen.findByDisplayValue("10.0.0.1"), "0")
    backend.state.settings.logTailLines = 900
    emitState()
    await screen.findByDisplayValue("900")
    expect(screen.getByDisplayValue("10.0.0.10")).toBeInTheDocument()
  })

  it("resets the draft when the stored override changes", async () => {
    renderSettings()
    await userEvent.type(await screen.findByDisplayValue("10.0.0.1"), "0")
    backend.state.settings.metricsDb = { ...emptyOverride, host: "db.local" }
    emitState()
    expect(await screen.findByDisplayValue("db.local")).toBeInTheDocument()
  })
})

describe("OptionsCard", () => {
  afterEach(() => vi.useRealTimers())

  it("debounces log tail edits into a single save", async () => {
    renderSettings()
    const input = await screen.findByDisplayValue("500")
    vi.useFakeTimers()
    fireEvent.change(input, { target: { value: "7" } })
    fireEvent.change(input, { target: { value: "75" } })
    fireEvent.change(input, { target: { value: "750" } })
    act(() => vi.advanceTimersByTime(599))
    expect(App.UpdateOptions).not.toHaveBeenCalled()
    act(() => vi.advanceTimersByTime(1))
    expect(App.UpdateOptions).toHaveBeenCalledTimes(1)
    expect(App.UpdateOptions).toHaveBeenCalledWith(750, true, false)
  })

  it("does not save invalid or unchanged line counts", async () => {
    renderSettings()
    const input = await screen.findByDisplayValue("500")
    vi.useFakeTimers()
    fireEvent.change(input, { target: { value: "0" } })
    act(() => vi.advanceTimersByTime(1000))
    fireEvent.change(input, { target: { value: "500" } })
    act(() => vi.advanceTimersByTime(1000))
    expect(App.UpdateOptions).not.toHaveBeenCalled()
  })

  it("keeps the typed value after its save lands", async () => {
    renderSettings()
    const input = await screen.findByDisplayValue("500")
    vi.useFakeTimers()
    fireEvent.change(input, { target: { value: "750" } })
    act(() => vi.advanceTimersByTime(600))
    vi.useRealTimers()
    backend.state.settings.logTailLines = 750
    emitState()
    await waitFor(() => expect(App.GetState).toHaveBeenCalledTimes(2))
    expect(input).toHaveValue(750)
  })

  it("resets the draft when the stored line count changes elsewhere", async () => {
    renderSettings()
    const input = await screen.findByDisplayValue("500")
    fireEvent.change(input, { target: { value: "0" } })
    backend.state.settings.logTailLines = 900
    emitState()
    expect(await screen.findByDisplayValue("900")).toBeInTheDocument()
  })

  it("flushes a pending line edit into a toggle save instead of saving twice", async () => {
    renderSettings()
    const input = await screen.findByDisplayValue("500")
    const [confirm] = screen.getAllByRole("switch")
    vi.useFakeTimers()
    fireEvent.change(input, { target: { value: "750" } })
    fireEvent.click(confirm)
    act(() => vi.advanceTimersByTime(1000))
    expect(App.UpdateOptions).toHaveBeenCalledTimes(1)
    expect(App.UpdateOptions).toHaveBeenCalledWith(750, false, false)
  })

  it("cancels a pending save on unmount", async () => {
    const { unmount } = renderSettings()
    const input = await screen.findByDisplayValue("500")
    vi.useFakeTimers()
    fireEvent.change(input, { target: { value: "750" } })
    unmount()
    act(() => vi.advanceTimersByTime(1000))
    expect(App.UpdateOptions).not.toHaveBeenCalled()
  })

  it("persists switch toggles with the other current options", async () => {
    renderSettings()
    const [confirm, stop] = await screen.findAllByRole("switch")
    await userEvent.click(confirm)
    expect(App.UpdateOptions).toHaveBeenLastCalledWith(500, false, false)
    emitState()
    await waitFor(() => expect(confirm).toHaveAttribute("aria-checked", "false"))
    await userEvent.click(stop)
    expect(App.UpdateOptions).toHaveBeenLastCalledWith(500, false, true)
  })
})
