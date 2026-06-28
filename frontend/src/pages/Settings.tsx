import { useEffect, useState } from "react"
import { FolderSearch, Database, SlidersHorizontal, CheckCircle2 } from "lucide-react"
import {
  SetActiveCore,
  SetInstallDir,
  SetDockerOverride,
  UpdateOptions,
  BrowseForDirectory,
} from "../../wailsjs/go/main/App"
import { useAppState, runAction } from "@/hooks/useAppData"
import {
  Button,
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  Input,
  Label,
  Switch,
  Badge,
} from "@/components/ui/primitives"
import { PageHeader } from "@/components/Page"
import { toast } from "@/lib/toast"
import { cn } from "@/lib/utils"
import type { main } from "../../wailsjs/go/models"

type CoreInstall = main.AppState["settings"]["installs"][string]

function ActiveCoreCard({ cores, active }: { cores: main.CoreOption[]; active: string }) {
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

function InstallRow({ core, installDir }: { core: main.CoreOption; installDir: string }) {
  const [value, setValue] = useState(installDir)
  useEffect(() => setValue(installDir), [installDir])

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

function DockerCard({ install, activeCore, displayName }: {
  install: CoreInstall | undefined
  activeCore: string
  displayName: string
}) {
  const [compose, setCompose] = useState(install?.dockerComposeOverride ?? "")
  const [container, setContainer] = useState(install?.dockerContainerOverride ?? "")
  useEffect(() => {
    setCompose(install?.dockerComposeOverride ?? "")
    setContainer(install?.dockerContainerOverride ?? "")
  }, [install?.dockerComposeOverride, install?.dockerContainerOverride])

  const save = () =>
    runAction(() => SetDockerOverride(activeCore, compose.trim(), container.trim()), "Save Docker overrides")
      .then(() => toast({ variant: "success", title: "Docker overrides saved" }))
      .catch(() => {})

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center gap-2">
          <Database className="size-4 text-muted-foreground" />
          <CardTitle>Database (Docker) overrides</CardTitle>
        </div>
        <CardDescription>Overrides for {displayName}. Leave blank to use the core defaults.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-1.5">
          <Label>Compose file path</Label>
          <Input
            value={compose}
            onChange={(e) => setCompose(e.target.value)}
            placeholder="docker/docker-compose.yml"
            className="font-mono"
          />
        </div>
        <div className="space-y-1.5">
          <Label>Container name</Label>
          <Input
            value={container}
            onChange={(e) => setContainer(e.target.value)}
            placeholder="tc-mariadb"
            className="font-mono"
          />
        </div>
        <p className="text-xs text-muted-foreground">
          AzerothCore usually shares TrinityCore's <code className="font-mono">tc-mariadb</code> container — point it at
          the same compose file and container name.
        </p>
        <Button size="sm" variant="secondary" onClick={save}>
          Save overrides
        </Button>
      </CardContent>
    </Card>
  )
}

function OptionsCard({ settings }: { settings: main.AppState["settings"] }) {
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

export function Settings() {
  const { data: state } = useAppState()

  if (!state) return null

  const cores = state.cores ?? []
  const installs = state.settings.installs ?? {}
  const activeCore = state.settings.activeCore
  const activeOption = cores.find((c) => c.type === activeCore)

  return (
    <div className="flex h-full flex-col gap-4 overflow-auto p-5">
      <div className="mx-auto w-full max-w-3xl space-y-4">
        <PageHeader title="Settings" description="Configure cores, install paths and app options" />

        <ActiveCoreCard cores={cores} active={activeCore} />

        <Card>
          <CardHeader>
            <CardTitle>Install directories</CardTitle>
            <CardDescription>Where each core's binaries and config live on disk.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {cores.map((core) => (
              <InstallRow key={core.type} core={core} installDir={installs[core.type]?.installDir ?? ""} />
            ))}
          </CardContent>
        </Card>

        {activeCore && (
          <DockerCard
            install={installs[activeCore]}
            activeCore={activeCore}
            displayName={activeOption?.displayName ?? activeCore}
          />
        )}

        <OptionsCard settings={state.settings} />
      </div>
    </div>
  )
}
