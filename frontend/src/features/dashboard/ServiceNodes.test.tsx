import { describe, it, expect, vi } from "vitest"
import { render, screen } from "@testing-library/react"
import { ProcNode } from "./ServiceNodes"
import { Button } from "@/shared/ui/primitives"
import { Shield } from "lucide-react"
import type { process as proc } from "@wails/go/models"

vi.mock("@wails/go/main/App", () => ({
  StartDB: vi.fn(),
  StopDB: vi.fn(),
  StartAuth: vi.fn(),
  StopAuth: vi.fn(),
  StartWorld: vi.fn(),
  StopWorld: vi.fn(),
  RestartServer: vi.fn(),
}))

function info(state: string, external = false): proc.ProcInfo {
  return { state, external, pid: 47488, startedAt: 0 } as proc.ProcInfo
}

function renderNode(state: string, busy: string | null = null, external = false) {
  return render(
    <ProcNode title="Auth Server" icon={Shield} target="auth" info={info(state, external)} busy={busy} run={vi.fn()} />,
  )
}

describe("Button loading", () => {
  it("keeps its label in the layout so width does not change", () => {
    render(<Button loading>Stop</Button>)
    const label = screen.getByText("Stop")
    expect(label).toHaveClass("invisible")
    expect(screen.getByRole("button")).toBeDisabled()
  })
})

describe("ProcNode actions", () => {
  it("shows stop controls while stopping, not Start", () => {
    renderNode("stopping")
    expect(screen.queryByRole("button", { name: /^start$/i })).toBeNull()
    expect(screen.getByRole("button", { name: /^stop$/i })).toBeDisabled()
    expect(screen.getByRole("button", { name: /restart/i })).toBeDisabled()
  })

  it("keeps Force available while stopping so a stuck stop can be killed", () => {
    renderNode("stopping")
    expect(screen.getByRole("button", { name: /force/i })).toBeEnabled()
  })

  it("disables sibling actions while one is in flight", () => {
    renderNode("running", "auth-stop")
    expect(screen.getByRole("button", { name: /restart/i })).toBeDisabled()
    expect(screen.getByRole("button", { name: /force/i })).toBeEnabled()
  })

  it("shows only Start when stopped", () => {
    renderNode("stopped")
    expect(screen.getByRole("button", { name: /^start$/i })).toBeEnabled()
    expect(screen.queryByRole("button", { name: /^stop$/i })).toBeNull()
  })
})
