import { Routes, Route } from "react-router-dom"
import { Shell } from "@/components/layout/Shell"
import { Dashboard } from "@/pages/Dashboard"
import { Metrics } from "@/pages/Metrics"
import { Loaders } from "@/pages/Loaders"
import { Logs } from "@/pages/Logs"
import { Config } from "@/pages/Config"
import { Files } from "@/pages/Files"
import { Settings } from "@/pages/Settings"
import { Toaster } from "@/lib/toast"
import { useErrorToasts } from "@/hooks/useAppData"

export default function App() {
  useErrorToasts()
  return (
    <>
      <Routes>
        <Route element={<Shell />}>
          <Route index element={<Dashboard />} />
          <Route path="metrics" element={<Metrics />} />
          <Route path="loaders" element={<Loaders />} />
          <Route path="logs" element={<Logs />} />
          <Route path="config" element={<Config />} />
          <Route path="files" element={<Files />} />
          <Route path="settings" element={<Settings />} />
        </Route>
      </Routes>
      <Toaster />
    </>
  )
}
