import { CheckCircle2 } from "lucide-react"
import { SetActiveCore } from "@wails/go/main/App"
import { runAction } from "@/shared/hooks/useAppData"
import { Card, CardContent, CardDescription, CardHeader, CardTitle, Badge } from "@/shared/ui/primitives"
import { toast } from "@/shared/ui/toast"
import { cn } from "@/shared/lib/utils"
import type { main } from "@wails/go/models"

export function ActiveCoreCard({ cores, active }: { cores: main.CoreOption[]; active: string }) {
  const pick = (type: string) =>
    runAction(() => SetActiveCore(type), "Switch active core")
      .then(() => toast({ variant: "success", title: "Active core changed" }))
      .catch(() => {})

  return (
    <Card>
      <CardHeader>
        <CardTitle>Active core</CardTitle>
        <CardDescription>The emulator CoreForge manages and shows status for.</CardDescription>
      </CardHeader>
      <CardContent className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        {cores.map((core) => {
          const selected = core.type === active
          return (
            <button
              key={core.type}
              onClick={() => !selected && pick(core.type)}
              className={cn(
                "flex items-center justify-between gap-3 rounded-lg border border-border p-3 text-left transition-colors",
                selected ? "bg-primary/15 ring-2 ring-primary" : "hover:bg-accent",
              )}
            >
              <div className="flex items-center gap-2">
                {selected && <CheckCircle2 className="size-4 text-primary" />}
                <span className="text-sm font-medium">{core.displayName}</span>
              </div>
              <Badge variant={core.configured ? "success" : "outline"}>
                {core.configured ? "configured" : "not set up"}
              </Badge>
            </button>
          )
        })}
      </CardContent>
    </Card>
  )
}
