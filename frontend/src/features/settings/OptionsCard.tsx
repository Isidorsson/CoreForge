import { useEffect, useState } from "react"
import { SlidersHorizontal } from "lucide-react"
import { UpdateOptions } from "@wails/go/main/App"
import { runAction } from "@/shared/hooks/useAppData"
import { Card, CardContent, CardDescription, CardHeader, CardTitle, Input, Label, Switch } from "@/shared/ui/primitives"
import type { main } from "@wails/go/models"

export function OptionsCard({ settings }: { settings: main.AppState["settings"] }) {
  const [lines, setLines] = useState(String(settings.logTailLines))
  const [confirmDestructive, setConfirmDestructive] = useState(settings.confirmDestructive)
  const [stopOnExit, setStopOnExit] = useState(settings.stopServersOnExit)

  useEffect(() => {
    setLines(String(settings.logTailLines))
    setConfirmDestructive(settings.confirmDestructive)
    setStopOnExit(settings.stopServersOnExit)
  }, [settings.logTailLines, settings.confirmDestructive, settings.stopServersOnExit])

  const persist = (next: { lines: number; confirm: boolean; stop: boolean }) =>
    runAction(() => UpdateOptions(next.lines, next.confirm, next.stop), "Save options").catch(() => {})

  useEffect(() => {
    const parsed = Number(lines)
    if (!Number.isFinite(parsed) || parsed <= 0 || parsed === settings.logTailLines) return
    const id = window.setTimeout(
      () => persist({ lines: parsed, confirm: confirmDestructive, stop: stopOnExit }),
      600,
    )
    return () => window.clearTimeout(id)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lines])

  const toggleConfirm = (v: boolean) => {
    setConfirmDestructive(v)
    persist({ lines: settings.logTailLines, confirm: v, stop: stopOnExit })
  }
  const toggleStop = (v: boolean) => {
    setStopOnExit(v)
    persist({ lines: settings.logTailLines, confirm: confirmDestructive, stop: v })
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center gap-2">
          <SlidersHorizontal className="size-4 text-muted-foreground" />
          <CardTitle>Options</CardTitle>
        </div>
        <CardDescription>General app behaviour.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-1.5">
          <Label>Log tail buffer (lines)</Label>
          <Input
            type="number"
            min={1}
            value={lines}
            onChange={(e) => setLines(e.target.value)}
            className="max-w-32"
          />
        </div>
        <div className="flex items-center justify-between gap-4">
          <div>
            <p className="text-sm font-medium">Confirm destructive actions</p>
            <p className="text-xs text-muted-foreground">Ask before deletes, restores and force-stops.</p>
          </div>
          <Switch checked={confirmDestructive} onCheckedChange={toggleConfirm} />
        </div>
        <div className="flex items-center justify-between gap-4">
          <div>
            <p className="text-sm font-medium">Stop servers when CoreForge closes</p>
            <p className="text-xs text-muted-foreground">Gracefully stop managed processes on exit.</p>
          </div>
          <Switch checked={stopOnExit} onCheckedChange={toggleStop} />
        </div>
      </CardContent>
    </Card>
  )
}
