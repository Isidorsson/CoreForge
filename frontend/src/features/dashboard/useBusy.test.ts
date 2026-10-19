import { describe, it, expect, vi } from "vitest"
import { act, renderHook } from "@testing-library/react"
import { useBusy } from "./useBusy"

vi.mock("@/shared/hooks/useAppData", () => ({
  runAction: (fn: () => Promise<unknown>) => fn(),
}))

function deferred() {
  let resolve = () => {}
  const promise = new Promise<void>((r) => (resolve = r))
  return { promise, resolve }
}

describe("useBusy", () => {
  it("keeps a running action busy when another one finishes first", async () => {
    const { result } = renderHook(() => useBusy())
    const auth = deferred()
    const world = deferred()

    act(() => result.current.run("auth-stop", () => auth.promise, "Stop auth"))
    act(() => result.current.run("world-stop", () => world.promise, "Stop world"))
    expect([...result.current.busy]).toEqual(["auth-stop", "world-stop"])

    await act(async () => world.resolve())
    expect([...result.current.busy]).toEqual(["auth-stop"])

    await act(async () => auth.resolve())
    expect(result.current.busy.size).toBe(0)
  })

  it("clears the key when the action fails", async () => {
    const { result } = renderHook(() => useBusy())
    await act(async () => result.current.run("db-start", () => Promise.reject(new Error("boom")), "Start DB"))
    expect(result.current.busy.size).toBe(0)
  })

  it("does not rerun an action that is already in flight", () => {
    const { result } = renderHook(() => useBusy())
    const fn = vi.fn(() => new Promise<void>(() => {}))
    act(() => result.current.run("auth-stop", fn, "Stop auth"))
    act(() => result.current.run("auth-stop", fn, "Stop auth"))
    expect(fn).toHaveBeenCalledTimes(1)
  })
})
