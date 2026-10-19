import { Routes, Route } from "react-router-dom"
import { Shell } from "@/app/shell/Shell"
import { DashboardPage } from "@/features/dashboard/DashboardPage"
import { MetricsPage } from "@/features/metrics/MetricsPage"
import { LoadersShowcase } from "@/dev/LoadersShowcase"
import { LogsPage } from "@/features/logs/LogsPage"
import { ConfigPage } from "@/features/config/ConfigPage"
import { FilesPage } from "@/features/files/FilesPage"
import { SettingsPage } from "@/features/settings/SettingsPage"
import { Toaster } from "@/shared/ui/toast"
import { useErrorToasts } from "@/shared/hooks/useAppData"

export default function App() {
  useErrorToasts()
  return (
    <>
      <Routes>
        <Route element={<Shell />}>
          <Route index element={<DashboardPage />} />
          <Route path="metrics" element={<MetricsPage />} />
          {import.meta.env.DEV && <Route path="loaders" element={<LoadersShowcase />} />}
          <Route path="logs" element={<LogsPage />} />
          <Route path="config" element={<ConfigPage />} />
          <Route path="files" element={<FilesPage />} />
          <Route path="settings" element={<SettingsPage />} />
        </Route>
      </Routes>
      <Toaster />
    </>
  )
}
