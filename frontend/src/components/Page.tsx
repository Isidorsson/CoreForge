import * as React from "react"
import { Link } from "react-router-dom"
import { ServerOff } from "lucide-react"
import { Button } from "@/components/ui/primitives"

export function PageHeader({
  title,
  description,
  actions,
}: {
  title: string
  description?: string
  actions?: React.ReactNode
}) {
  return (
    <div className="flex items-start justify-between gap-4">
      <div className="min-w-0">
        <h1 className="text-xl font-semibold tracking-tight">{title}</h1>
        {description && <p className="mt-0.5 font-sans text-sm text-muted-foreground">{description}</p>}
      </div>
      {actions && <div className="flex shrink-0 items-center gap-2">{actions}</div>}
    </div>
  )
}

/** Shown on any page when no active core/install is configured yet. */
export function NotConfigured() {
  return (
    <div className="flex h-full flex-col items-center justify-center gap-4 p-8 text-center">
      <div className="flex size-12 items-center justify-center rounded-lg bg-muted text-muted-foreground ring-1 ring-border">
        <ServerOff className="size-6" />
      </div>
      <div>
        <p className="text-sm font-medium">No active core configured</p>
        <p className="mx-auto mt-1 max-w-sm font-sans text-sm leading-relaxed text-muted-foreground">
          Choose TrinityCore or AzerothCore and point CoreForge at its install directory to begin.
        </p>
      </div>
      <Link to="/settings">
        <Button size="sm">Open Settings</Button>
      </Link>
    </div>
  )
}

/** Generic empty placeholder for lists. */
export function EmptyState({ icon: Icon, title, hint }: { icon: React.ElementType; title: string; hint?: string }) {
  return (
    <div className="flex flex-col items-center justify-center gap-2 p-10 text-center">
      <div className="flex size-9 items-center justify-center rounded-lg bg-muted/60 text-muted-foreground ring-1 ring-border">
        <Icon className="size-4.5" />
      </div>
      <p className="text-sm font-medium">{title}</p>
      {hint && <p className="max-w-xs font-sans text-xs leading-relaxed text-muted-foreground">{hint}</p>}
    </div>
  )
}
