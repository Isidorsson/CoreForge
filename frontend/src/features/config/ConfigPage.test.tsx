import { describe, it, expect, vi, beforeEach } from "vitest"
import { render, screen, waitFor } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { ConfigPage } from "./ConfigPage"

const disk: Record<string, string> = {}

vi.mock("@wails/runtime/runtime", () => ({ EventsOn: () => () => {} }))
vi.mock("@wails/go/main/App", () => ({
  GetState: async () => ({ configured: true }),
  ListConfigs: async () => [
    { id: "auth", name: "authserver.conf", kind: "auth", relPath: "authserver.conf", size: 1, modified: "" },
    { id: "world", name: "worldserver.conf", kind: "world", relPath: "worldserver.conf", size: 1, modified: "" },
  ],
  ReadConfig: async (id: string) => disk[id],
  SaveConfig: vi.fn(async (id: string, content: string) => {
    disk[id] = content
  }),
  SearchConfig: async () => [],
  ListConfigBackups: async () => [],
  RestoreConfig: async () => {},
}))

function renderConfig() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return render(
    <QueryClientProvider client={client}>
      <ConfigPage />
    </QueryClientProvider>,
  )
}

async function openFile(name: string) {
  await userEvent.click(await screen.findByText(name))
}

describe("Config editor", () => {
  beforeEach(() => {
    disk.auth = "auth=1"
    disk.world = "world=1"
  })

  it("keeps unsaved edits when switching files is cancelled", async () => {
    renderConfig()
    await openFile("worldserver.conf")
    const editor = await screen.findByDisplayValue("world=1")
    await userEvent.type(editor, " edited")

    await openFile("authserver.conf")
    expect(await screen.findByText("Discard unsaved changes?")).toBeInTheDocument()
    await userEvent.click(screen.getByRole("button", { name: "Keep editing" }))

    expect(screen.getByDisplayValue("world=1 edited")).toBeInTheDocument()
  })

  it("switches files after discarding unsaved edits", async () => {
    renderConfig()
    await openFile("worldserver.conf")
    await userEvent.type(await screen.findByDisplayValue("world=1"), " edited")

    await openFile("authserver.conf")
    await userEvent.click(await screen.findByRole("button", { name: "Discard" }))

    expect(await screen.findByDisplayValue("auth=1")).toBeInTheDocument()
  })

  it("re-reads a file from disk when it is opened again", async () => {
    renderConfig()
    await openFile("worldserver.conf")
    await screen.findByDisplayValue("world=1")
    await openFile("authserver.conf")
    await screen.findByDisplayValue("auth=1")

    disk.world = "world=2"
    await openFile("worldserver.conf")

    expect(await screen.findByDisplayValue("world=2")).toBeInTheDocument()
  })

  it("keeps the saved text and clears the unsaved marker after saving", async () => {
    renderConfig()
    await openFile("worldserver.conf")
    await userEvent.type(await screen.findByDisplayValue("world=1"), " edited")
    expect(screen.getByText("unsaved")).toBeInTheDocument()

    await userEvent.click(screen.getByRole("button", { name: /save/i }))

    await waitFor(() => expect(screen.queryByText("unsaved")).not.toBeInTheDocument())
    expect(disk.world).toBe("world=1 edited")
    expect(screen.getByDisplayValue("world=1 edited")).toBeInTheDocument()
  })
})
