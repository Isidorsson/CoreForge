import { useEffect, useRef, useState } from "react"
import { SlidersHorizontal } from "lucide-react"
import { UpdateOptions } from "@wails/go/main/App"
import { runAction } from "@/shared/hooks/useAppData"
import { Card, CardContent, CardDescription, CardHeader, CardTitle, Input, Label, Switch } from "@/shared/ui/primitives"
import type { main } from "@wails/go/models"

const LINES_SAVE_DELAY_MS = 600

type Options = { lines: number; confirm: boolean }

function parseLines(text: string): number | null {
  const n = Number(text)
  return Number.isInteger(n) && n > 0 ? n : null
}

export function OptionsCard({ settings }: { settings: main.AppState["settings"] }) {
  // The draft remembers the stored value it was typed against. It stays visible
  // while that value (or the draft's own saved value) is current, and drops out
  // when the line count changes elsewhere. A parent key can't do this: each
  // debounced save changes the prop and would remount the input mid-typing.
  const [draft, setDraft] = useState<{ base: number; text: string } | null>(null)
  const pendingSave = useRef<number | undefined>(undefined)
  useEffect(() => () => window.clearTimeout(pendingSave.current), [])

  const stored = settings.logTailLines
  const lines =
    draft && (draft.base === stored || parseLines(draft.text) === stored) ? draft.text : String(stored)

  const current: Options = {
    lines: parseLines(lines) ?? stored,
    confirm: settings.confirmDestructive,
  }

  const persist = (next: Options) =>
    runAction(() => UpdateOptions(next.lines, next.confirm), "Save options").catch(() => {})

  const editLines = (text: string) => {
    window.clearTimeout(pendingSave.current)
    setDraft({ base: stored, text })
    const parsed = parseLines(text)
    if (parsed === null || parsed === stored) return
    pendingSave.current = window.setTimeout(() => persist({ ...current, lines: parsed }), LINES_SAVE_DELAY_MS)
  }

  // Saving a toggle also flushes a pending line-count edit, so the delayed save
  // can't later overwrite the toggle with a stale switch value.
  const toggle = (patch: Partial<Options>) => {
    window.clearTimeout(pendingSave.current)
    persist({ ...current, ...patch })
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
            onChange={(e) => editLines(e.target.value)}
            className="max-w-32"
          />
        </div>
        <div className="flex items-center justify-between gap-4">
          <div>
            <p className="text-sm font-medium">Confirm destructive actions</p>
            <p className="text-xs text-muted-foreground">Ask before deletes, restores and force-stops.</p>
          </div>
          <Switch checked={settings.confirmDestructive} onCheckedChange={(confirm) => toggle({ confirm })} />
        </div>
        <p className="text-xs text-muted-foreground">
          Servers started from CoreForge run in its console and are stopped cleanly when CoreForge closes.
        </p>
      </CardContent>
    </Card>
  )
}
