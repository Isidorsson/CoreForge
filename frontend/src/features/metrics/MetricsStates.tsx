import { AlertTriangle, RefreshCw } from "lucide-react"
import { Button, Skeleton } from "@/shared/ui/primitives"

export function LoadingState() {
  return (
    <div className="flex flex-col gap-4 p-5">
      <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3 xl:grid-cols-4">
        {Array.from({ length: 7 }).map((_, i) => (
          <Skeleton key={i} className="h-16" />
        ))}
      </div>
      <div className="grid gap-3 lg:grid-cols-2">
        {Array.from({ length: 4 }).map((_, i) => (
          <Skeleton key={i} className="h-64" />
        ))}
      </div>
    </div>
  )
}

export function ConnectionError({ message, onRetry }: { message: string; onRetry: () => void }) {
  return (
    <div className="flex h-full flex-col items-center justify-center gap-4 p-8 text-center">
      <div className="flex size-12 items-center justify-center rounded-lg bg-danger/12 text-danger ring-1 ring-danger/25">
        <AlertTriangle className="size-6" />
      </div>
      <div>
        <p className="text-sm font-medium">Can't reach the database</p>
        <p className="mx-auto mt-1 max-w-md font-sans text-sm leading-relaxed text-muted-foreground">{message}</p>
        <p className="mx-auto mt-2 max-w-md font-sans text-xs leading-relaxed text-muted-foreground">
          Start the database from the Dashboard, or set manual credentials in Settings if the DB is on another host.
        </p>
      </div>
      <Button size="sm" onClick={onRetry}>
        <RefreshCw className="size-3.5" /> Retry
      </Button>
    </div>
  )
}
