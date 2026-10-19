import { useAppState } from "@/shared/hooks/useAppData"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/shared/ui/primitives"
import { PageHeader } from "@/shared/ui/Page"
import { ActiveCoreCard } from "./ActiveCoreCard"
import { InstallRow } from "./InstallRow"
import { DockerCard } from "./DockerCard"
import { MetricsDBCard } from "./MetricsDBCard"
import { OptionsCard } from "./OptionsCard"

export function SettingsPage() {
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
