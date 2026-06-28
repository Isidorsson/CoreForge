import { useEffect, useRef } from "react"
import { EventsOn } from "../../wailsjs/runtime/runtime"

/**
 * Subscribe to a Wails runtime event for the lifetime of the component. The
 * handler is kept in a ref so re-renders don't re-subscribe.
 */
export function useWailsEvent<T = unknown>(event: string, handler: (data: T) => void) {
  const ref = useRef(handler)
  ref.current = handler
  useEffect(() => {
    const off = EventsOn(event, (...args: unknown[]) => ref.current(args[0] as T))
    return () => off()
  }, [event])
}
