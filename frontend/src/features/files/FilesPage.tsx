import { useState } from "react"
import { FolderOpen, HardDrive, Folder, File, Archive, Trash2, AlertTriangle } from "lucide-react"
import {
  BrowseFiles,
  DiskUsage,
  CrashesPreview,
  ClearCrashes,
  BackupFolder,
  DeleteFile,
  OpenInExplorer,
} from "@wails/go/main/App"
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { useAppState, runAction, qk } from "@/shared/hooks/useAppData"
import {
  Button,
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  Spinner,
} from "@/shared/ui/primitives"
import { ConfirmDialog } from "@/shared/ui/dialog"
import { PageHeader, NotConfigured, EmptyState } from "@/shared/ui/Page"
import { toast } from "@/shared/ui/toast"
import { formatBytes, formatRelative, errorMessage } from "@/shared/lib/format"
import { cn } from "@/shared/lib/utils"
import type { files } from "@wails/go/models"

function Breadcrumb({ rel, onNavigate }: { rel: string; onNavigate: (rel: string) => void }) {
  const segments = rel ? rel.split("/") : []
  return (
    <div className="flex flex-wrap items-center gap-1 text-xs text-muted-foreground">
      <button onClick={() => onNavigate("")} className="font-medium hover:text-foreground">
        install
      </button>
      {segments.map((seg, i) => {
        const target = segments.slice(0, i + 1).join("/")
        const isLast = i === segments.length - 1
        return (
          <span key={target} className="flex items-center gap-1">
            <span className="text-muted-foreground/50">/</span>
            <button
              onClick={() => onNavigate(target)}
              className={cn("hover:text-foreground", isLast && "font-medium text-foreground")}
            >
              {seg}
            </button>
          </span>
        )
      })}
    </div>
  )
}

function DiskUsageCard() {
  const usage = useQuery({ queryKey: qk.disk, queryFn: DiskUsage, enabled: false })
  const report = usage.data

  return (
    <Card>
      <CardHeader className="flex-row items-start justify-between">
        <div>
          <CardTitle>Disk usage</CardTitle>
          <CardDescription>
            {report ? `Total ${formatBytes(report.total)} · scanned ${formatRelative(report.scannedAt)}` : "Scan the install directory to measure usage"}
          </CardDescription>
        </div>
        <Button size="sm" variant="outline" loading={usage.isFetching} onClick={() => usage.refetch()}>
          <HardDrive className="size-3.5" /> Scan
        </Button>
      </CardHeader>
      {report && report.buckets.length > 0 && (
        <CardContent className="space-y-2">
          {[...report.buckets]
            .sort((a, b) => b.bytes - a.bytes)
            .map((bucket) => {
              const pct = report.total > 0 ? (bucket.bytes / report.total) * 100 : 0
              return (
                <div key={bucket.name} className="space-y-1">
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-medium">{bucket.name}</span>
                    <span className="text-muted-foreground">{formatBytes(bucket.bytes)}</span>
                  </div>
                  <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted">
                    <div className="h-full rounded-full bg-primary/70" style={{ width: `${pct}%` }} />
                  </div>
                </div>
              )
            })}
        </CardContent>
      )}
    </Card>
  )
}

function CrashesCard() {
  const qc = useQueryClient()
  const [confirm, setConfirm] = useState(false)
  const [preview, setPreview] = useState<files.CleanupPreview | null>(null)

  const previewMut = useMutation({
    mutationFn: CrashesPreview,
    onSuccess: (data) => setPreview(data),
    onError: (err) => toast({ variant: "error", title: "Preview crashes", description: errorMessage(err) }),
  })

  const clearMut = useMutation({
    mutationFn: ClearCrashes,
    onSuccess: (data) => {
      toast({ variant: "success", title: "Crashes cleared", description: `Removed ${data.count} files (${formatBytes(data.bytes)})` })
      setPreview(null)
      setConfirm(false)
      qc.invalidateQueries({ queryKey: qk.disk })
      qc.invalidateQueries({ queryKey: qk.files("") })
    },
    onError: (err) => toast({ variant: "error", title: "Clear crashes", description: errorMessage(err) }),
  })

  const hasFiles = !!preview && preview.count > 0

  return (
    <Card>
      <CardHeader className="flex-row items-start justify-between">
        <div>
          <CardTitle>Crashes</CardTitle>
          <CardDescription>
            {preview
              ? hasFiles
                ? `${preview.count} files · ${formatBytes(preview.bytes)} reclaimable`
                : "Crashes folder is empty"
              : "Inspect and clear crash dumps"}
          </CardDescription>
        </div>
        <div className="flex items-center gap-2">
          <Button size="sm" variant="secondary" loading={previewMut.isPending} onClick={() => previewMut.mutate()}>
            Preview cleanup
          </Button>
          <Button size="sm" variant="destructive" disabled={!hasFiles} onClick={() => setConfirm(true)}>
            <Trash2 className="size-3.5" /> Clear crashes
          </Button>
        </div>
      </CardHeader>
      <ConfirmDialog
        open={confirm}
        title="Clear crash dumps?"
        description={
          preview ? `This permanently deletes ${preview.count} files freeing ${formatBytes(preview.bytes)}.` : undefined
        }
        confirmLabel="Clear crashes"
        confirmVariant="destructive"
        loading={clearMut.isPending}
        onConfirm={() => clearMut.mutate()}
        onClose={() => setConfirm(false)}
      />
    </Card>
  )
}

function FileRow({ entry, onDescend, onBackup, onDelete }: {
  entry: files.Entry
  onDescend: (entry: files.Entry) => void
  onBackup: (entry: files.Entry) => void
  onDelete: (entry: files.Entry) => void
}) {
  const Icon = entry.isDir ? Folder : File
  return (
    <div className="group flex items-center gap-3 rounded-md px-3 py-1.5 hover:bg-accent">
      <Icon className={cn("size-4 shrink-0", entry.isDir ? "text-primary" : "text-muted-foreground")} />
      <button
        onClick={() => entry.isDir && onDescend(entry)}
        className={cn("min-w-0 flex-1 truncate text-left text-sm", entry.isDir && "hover:underline")}
        disabled={!entry.isDir}
      >
        {entry.name}
      </button>
      <span className="w-20 shrink-0 text-right text-xs tabular-nums text-muted-foreground">
        {entry.isDir ? "—" : formatBytes(entry.size)}
      </span>
      <span className="w-24 shrink-0 text-right text-xs tabular-nums text-muted-foreground">{formatRelative(entry.modified)}</span>
      <div className="flex w-[64px] shrink-0 items-center justify-end gap-1 opacity-0 transition-opacity group-hover:opacity-100">
        {entry.isDir && (
          <Button size="icon" variant="ghost" className="size-7" title="Back up folder" onClick={() => onBackup(entry)}>
            <Archive className="size-3.5" />
          </Button>
        )}
        <Button size="icon" variant="ghost" className="size-7 text-danger" title="Delete" onClick={() => onDelete(entry)}>
          <Trash2 className="size-3.5" />
        </Button>
      </div>
    </div>
  )
}

function FileBrowser({ rel, onNavigate }: { rel: string; onNavigate: (rel: string) => void }) {
  const qc = useQueryClient()
  const [pendingDelete, setPendingDelete] = useState<files.Entry | null>(null)
  const [deleting, setDeleting] = useState(false)

  const browse = useQuery({ queryKey: qk.files(rel), queryFn: () => BrowseFiles(rel) })
  const entries = browse.data ?? []

  function backup(entry: files.Entry) {
    runAction(async () => {
      const zip = await BackupFolder(entry.relPath)
      toast({ variant: "success", title: "Backup created", description: zip })
    }, "Back up folder").catch(() => {})
  }

  function confirmDelete() {
    if (!pendingDelete) return
    setDeleting(true)
    runAction(() => DeleteFile(pendingDelete.relPath), "Delete")
      .then(() => {
        toast({ variant: "success", title: "Deleted", description: pendingDelete.name })
        qc.invalidateQueries({ queryKey: qk.files(rel) })
        setPendingDelete(null)
      })
      .catch(() => {})
      .finally(() => setDeleting(false))
  }

  return (
    <Card className="flex min-h-0 flex-1 flex-col">
      <CardHeader className="flex-row items-center justify-between gap-3">
        <Breadcrumb rel={rel} onNavigate={onNavigate} />
        {browse.isFetching && <Spinner className="size-3.5" />}
      </CardHeader>
      <CardContent className="flex min-h-0 flex-1 flex-col overflow-hidden p-0">
        <div className="flex items-center gap-3 border-y border-border px-3 py-1.5 text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
          <span className="size-4 shrink-0" />
          <span className="flex-1">Name</span>
          <span className="w-20 shrink-0 text-right">Size</span>
          <span className="w-24 shrink-0 text-right">Modified</span>
          <span className="w-[64px] shrink-0" />
        </div>
        <div className="min-h-0 flex-1 overflow-auto p-1.5">
          {entries.length === 0 ? (
            <EmptyState icon={Folder} title="Empty folder" hint="Nothing to show in this directory." />
          ) : (
            <div className="space-y-0.5">
              {entries.map((entry) => (
                <FileRow
                  key={entry.relPath}
                  entry={entry}
                  onDescend={(e) => onNavigate(e.relPath)}
                  onBackup={backup}
                  onDelete={setPendingDelete}
                />
              ))}
            </div>
          )}
        </div>
      </CardContent>
      <ConfirmDialog
        open={!!pendingDelete}
        title={pendingDelete?.isDir ? "Delete folder?" : "Delete file?"}
        description={
          pendingDelete ? (
            <span className="flex items-start gap-2">
              <AlertTriangle className="mt-0.5 size-4 shrink-0 text-warning" />
              <span>
                Permanently delete <span className="font-medium text-foreground">{pendingDelete.name}</span>? This cannot be undone.
              </span>
            </span>
          ) : undefined
        }
        confirmLabel="Delete"
        confirmVariant="destructive"
        loading={deleting}
        onConfirm={confirmDelete}
        onClose={() => setPendingDelete(null)}
      />
    </Card>
  )
}

export function FilesPage() {
  const { data: state } = useAppState()
  const [rel, setRel] = useState("")

  if (state && !state.configured) return <NotConfigured />

  return (
    <div className="flex h-full flex-col gap-4 p-5">
      <PageHeader
        title="Files"
        description="Browse, back up and clean your install directory"
        actions={
          <Button
            size="sm"
            variant="outline"
            onClick={() => runAction(() => OpenInExplorer(rel), "Open in Explorer").catch(() => {})}
          >
            <FolderOpen className="size-3.5" /> Open in Explorer
          </Button>
        }
      />
      <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
        <DiskUsageCard />
        <CrashesCard />
      </div>
      <FileBrowser rel={rel} onNavigate={setRel} />
    </div>
  )
}
