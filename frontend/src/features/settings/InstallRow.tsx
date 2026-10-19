import { useState } from "react"
import { FolderSearch } from "lucide-react"
import { SetInstallDir, BrowseForDirectory } from "@wails/go/main/App"
import { runAction } from "@/shared/hooks/useAppData"
import { Button, Input, Label } from "@/shared/ui/primitives"
import { toast } from "@/shared/ui/toast"
import type { main } from "@wails/go/models"

/** Keyed by installDir in the parent, so the draft resets when the saved dir changes. */
export function InstallRow({ core, installDir }: { core: main.CoreOption; installDir: string }) {
  const [value, setValue] = useState(installDir)

  const save = (dir: string) => {
    if (dir === installDir) return
    runAction(() => SetInstallDir(core.type, dir), "Set install directory")
      .then(() => toast({ variant: "success", title: `${core.displayName} install dir updated` }))
      .catch(() => setValue(installDir))
  }

  const browse = () =>
    runAction(() => BrowseForDirectory(`Select ${core.displayName} install dir`), "Browse")
      .then((dir) => {
        const picked = dir as string
        if (!picked) return
        setValue(picked)
        save(picked)
      })
      .catch(() => {})

  return (
    <div className="space-y-1.5">
      <Label>{core.displayName}</Label>
      <div className="flex gap-2">
        <Input
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onBlur={() => save(value.trim())}
          onKeyDown={(e) => e.key === "Enter" && save(value.trim())}
          placeholder="C:\\path\\to\\install"
          className="font-mono"
        />
        <Button variant="outline" onClick={browse}>
          <FolderSearch className="size-3.5" /> Browse
        </Button>
      </div>
    </div>
  )
}
