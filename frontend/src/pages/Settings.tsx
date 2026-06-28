import { useEffect, useState } from "react"
import { useQuery, useQueryClient } from "@tanstack/react-query"
import { FolderSearch, Database, SlidersHorizontal, CheckCircle2, BarChart3, Plug } from "lucide-react"
import {
  SetActiveCore,
  SetInstallDir,
  SetDockerOverride,
  UpdateOptions,
  BrowseForDirectory,
  GetMetricsDBInfo,
  TestMetricsConnection,
  SetMetricsDBOverride,
} from "../../wailsjs/go/main/App"
import { useAppState, runAction, qk } from "@/hooks/useAppData"
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
import type { main, settings as settingsNs } from "../../wailsjs/go/models"

type CoreInstall = main.AppState["settings"]["installs"][string]
type DBOverride = settingsNs.MetricsDBOverride
const emptyOverride: DBOverride = { host: "", port: "", user: "", pass: "", authDb: "", worldDb: "", charDb: "" }

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

function MetricsDBCard({ override }: { override?: DBOverride }) {
  const qc = useQueryClient()
  const { data: info } = useQuery({ queryKey: ["metricsDb"], queryFn: GetMetricsDBInfo, retry: false })
  const [f, setF] = useState<DBOverride>(override ?? emptyOverride)
  const [testing, setTesting] = useState(false)
  useEffect(() => setF(override ?? emptyOverride), [override])

  const set = (k: keyof DBOverride) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setF((p) => ({ ...p, [k]: e.target.value }))

  const refresh = () => {
    qc.invalidateQueries({ queryKey: ["metricsDb"] })
    qc.invalidateQueries({ queryKey: qk.metrics })
  }

  const save = () =>
    runAction(() => SetMetricsDBOverride(f), "Save DB credentials")
      .then(() => {
        toast({ variant: "success", title: "Manual DB credentials saved" })
        refresh()
      })
      .catch(() => {})

  const clear = () =>
    runAction(() => SetMetricsDBOverride(emptyOverride), "Clear DB credentials")
      .then(() => {
        setF(emptyOverride)
        toast({ variant: "success", title: "Reverted to auto-discovery" })
        refresh()
      })
      .catch(() => {})

  const test = () => {
    setTesting(true)
    runAction(() => TestMetricsConnection(), "Test connection")
      .then((i) => toast({ variant: "success", title: "Connected", description: `${i.host}:${i.port} · ${i.charDb}` }))
      .catch(() => {})
      .finally(() => setTesting(false))
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center gap-2">
          <BarChart3 className="size-4 text-muted-foreground" />
          <CardTitle>Metrics database</CardTitle>
          {info && (
            <Badge variant={info.source === "manual" ? "info" : "success"} className="ml-auto">
              {info.source === "manual" ? "manual" : "auto from worldserver.conf"}
            </Badge>
          )}
        </div>
        <CardDescription>
          Read-only connection the Metrics page queries. Auto-detected from the active core's worldserver.conf — only
          fill these in to override (e.g. a remote DB host). Leave blank to revert to auto.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <Label>Host</Label>
            <Input value={f.host} onChange={set("host")} placeholder={info?.host || "127.0.0.1"} className="font-mono" />
          </div>
          <div className="space-y-1.5">
            <Label>Port</Label>
            <Input value={f.port} onChange={set("port")} placeholder={info?.port || "3306"} className="font-mono" />
          </div>
          <div className="space-y-1.5">
            <Label>User</Label>
            <Input value={f.user} onChange={set("user")} placeholder={info?.user || "trinity"} className="font-mono" />
          </div>
          <div className="space-y-1.5">
            <Label>Password</Label>
            <Input
              type="password"
              value={f.pass}
              onChange={set("pass")}
              placeholder={info?.hasPass ? "•••••• (set)" : "password"}
              className="font-mono"
            />
          </div>
        </div>
        <div className="grid grid-cols-3 gap-3">
          <div className="space-y-1.5">
            <Label>Auth DB</Label>
            <Input value={f.authDb} onChange={set("authDb")} placeholder={info?.authDb || "auth"} className="font-mono" />
          </div>
          <div className="space-y-1.5">
            <Label>World DB</Label>
            <Input value={f.worldDb} onChange={set("worldDb")} placeholder={info?.worldDb || "world"} className="font-mono" />
          </div>
          <div className="space-y-1.5">
            <Label>Characters DB</Label>
            <Input value={f.charDb} onChange={set("charDb")} placeholder={info?.charDb || "characters"} className="font-mono" />
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button size="sm" onClick={save}>
            Save override
          </Button>
          <Button size="sm" variant="outline" onClick={clear}>
            Use auto
          </Button>
          <Button size="sm" variant="secondary" className="ml-auto" loading={testing} onClick={test}>
            <Plug className="size-3.5" /> Test connection
          </Button>
        </div>
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

        <MetricsDBCard override={state.settings.metricsDb} />

        <OptionsCard settings={state.settings} />
      </div>
    </div>
  )
}
