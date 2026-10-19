import { useEffect, useState } from "react"
import { Database } from "lucide-react"
import { SetDockerOverride } from "@wails/go/main/App"
import { runAction } from "@/shared/hooks/useAppData"
import { Button, Card, CardContent, CardDescription, CardHeader, CardTitle, Input, Label } from "@/shared/ui/primitives"
import { toast } from "@/shared/ui/toast"
import type { main } from "@wails/go/models"

type CoreInstall = main.AppState["settings"]["installs"][string]

export function DockerCard({ install, activeCore, displayName }: {
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
