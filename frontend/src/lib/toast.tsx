import { useSyncExternalStore } from "react"
import { CheckCircle2, AlertTriangle, Info, X } from "lucide-react"
import { cn } from "@/lib/utils"

export type ToastVariant = "default" | "success" | "error"
export interface ToastItem {
  id: number
  title: string
  description?: string
  variant: ToastVariant
}

let items: ToastItem[] = []
let listeners: Array<() => void> = []
let nextId = 1

function emit() {
  listeners = listeners.slice()
  listeners.forEach((l) => l())
}

function subscribe(cb: () => void) {
  listeners.push(cb)
  return () => {
    listeners = listeners.filter((l) => l !== cb)
  }
}

/** Push a toast. Auto-dismisses after 5s (errors linger to 8s). */
export function toast(t: { title: string; description?: string; variant?: ToastVariant }) {
  const id = nextId++
  const item: ToastItem = { id, title: t.title, description: t.description, variant: t.variant ?? "default" }
  items = [...items, item]
  emit()
  window.setTimeout(() => dismissToast(id), item.variant === "error" ? 8000 : 5000)
  return id
}

export function dismissToast(id: number) {
  items = items.filter((t) => t.id !== id)
  emit()
}

function useToasts() {
  return useSyncExternalStore(subscribe, () => items)
}

const icons = {
  default: Info,
  success: CheckCircle2,
  error: AlertTriangle,
} as const

const accent = {
  default: "text-muted-foreground",
  success: "text-success",
  error: "text-danger",
} as const

export function Toaster() {
  const toasts = useToasts()
  return (
    <div className="pointer-events-none fixed bottom-4 right-4 z-[60] flex w-[360px] max-w-[calc(100vw-2rem)] flex-col gap-2">
      {toasts.map((t) => {
        const Icon = icons[t.variant]
        return (
          <div
            key={t.id}
            className="animate-toast-in pointer-events-auto flex items-start gap-3 rounded-lg border border-border-strong bg-popover p-3 shadow-[0_8px_30px_-12px_rgba(0,0,0,0.7)]"
          >
            <Icon className={cn("mt-0.5 size-4 shrink-0", accent[t.variant])} />
            <div className="min-w-0 flex-1">
              <p className="text-sm font-medium leading-tight">{t.title}</p>
              {t.description && (
                <p className="mt-0.5 break-words text-xs text-muted-foreground">{t.description}</p>
              )}
            </div>
            <button
              onClick={() => dismissToast(t.id)}
              className="text-muted-foreground transition-colors hover:text-foreground"
              aria-label="Dismiss"
            >
              <X className="size-3.5" />
            </button>
          </div>
        )
      })}
    </div>
  )
}
