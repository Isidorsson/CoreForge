import { useState } from "react"
import { useQuery, useQueryClient } from "@tanstack/react-query"
import { BarChart3, Plug } from "lucide-react"
import { GetMetricsDBInfo, TestMetricsConnection, SetMetricsDBOverride } from "@wails/go/main/App"
import { runAction, qk } from "@/shared/hooks/useAppData"
import { Button, Card, CardContent, CardDescription, CardHeader, CardTitle, Input, Label, Badge } from "@/shared/ui/primitives"
import { toast } from "@/shared/ui/toast"
import type { settings as settingsNs } from "@wails/go/models"

type DBOverride = settingsNs.MetricsDBOverride
const emptyOverride: DBOverride = { host: "", port: "", user: "", pass: "", authDb: "", worldDb: "", charDb: "" }

/** Keyed by the stored override in the parent, so the draft resets when it changes. */
export function MetricsDBCard({ override }: { override?: DBOverride }) {
  const qc = useQueryClient()
  const { data: info } = useQuery({ queryKey: ["metricsDb"], queryFn: GetMetricsDBInfo, retry: false })
  const [f, setF] = useState<DBOverride>(override ?? emptyOverride)
  const [testing, setTesting] = useState(false)

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
