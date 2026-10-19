import { useEffect, useMemo, useState } from "react"
import { FileCog, Save, History, Search, RotateCcw } from "lucide-react"
import {
  ListConfigs,
  ReadConfig,
  SaveConfig,
  SearchConfig,
  ListConfigBackups,
  RestoreConfig,
} from "../../wailsjs/go/main/App"
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { useAppState, qk } from "@/hooks/useAppData"
import { Button, Card, Badge, Input, Textarea, Spinner } from "@/components/ui/primitives"
import { Modal, ConfirmDialog } from "@/components/ui/dialog"
import { PageHeader, NotConfigured, EmptyState } from "@/components/Page"
import { toast } from "@/lib/toast"
import { formatBytes, formatRelative, errorMessage } from "@/lib/format"
import { cn } from "@/lib/utils"
import type { config } from "../../wailsjs/go/models"

const KIND_LABELS: Record<string, string> = { auth: "Auth", world: "World", module: "Modules" }
const KIND_ORDER = ["auth", "world", "module"]

function kindBadge(kind: string) {
  return <Badge variant={kind === "module" ? "default" : "outline"}>{kind}</Badge>
}

function ConfigList({
  files,
  selectedId,
  onSelect,
}: {
  files: config.ConfigFile[]
  selectedId: string | null
  onSelect: (f: config.ConfigFile) => void
}) {
  const groups = useMemo(() => {
    const map = new Map<string, config.ConfigFile[]>()
    for (const f of files) {
      const arr = map.get(f.kind) ?? []
      arr.push(f)
      map.set(f.kind, arr)
    }
    return KIND_ORDER.filter((k) => map.has(k)).map((k) => ({ kind: k, items: map.get(k)! }))
  }, [files])

  return (
    <div className="flex flex-col gap-4">
      {groups.map(({ kind, items }) => (
        <div key={kind} className="flex flex-col gap-1">
          <div className="px-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">
            {KIND_LABELS[kind] ?? kind}
          </div>
          {items.map((f) => (
            <button
              key={f.id}
              onClick={() => onSelect(f)}
              className={cn(
                "flex flex-col gap-0.5 rounded-md px-2 py-1.5 text-left transition-colors",
                f.id === selectedId ? "bg-accent text-accent-foreground" : "hover:bg-accent/50",
              )}
            >
              <div className="flex items-center justify-between gap-2">
                <span className="truncate text-sm font-medium">{f.name}</span>
                {kindBadge(f.kind)}
              </div>
              <span className="text-xs text-muted-foreground">{formatRelative(f.modified)}</span>
            </button>
          ))}
        </div>
      ))}
    </div>
  )
}

function BackupsModal({
  open,
  fileId,
  onClose,
  onRestored,
}: {
  open: boolean
  fileId: string
  onClose: () => void
  onRestored: () => void
}) {
  const { data: backups, isLoading } = useQuery({
    queryKey: qk.configBackups(fileId),
    queryFn: () => ListConfigBackups(fileId),
    enabled: open,
  })
  const [pending, setPending] = useState<string | null>(null)

  const restore = useMutation({
    mutationFn: (name: string) => RestoreConfig(fileId, name),
    onSuccess: () => {
      toast({ variant: "success", title: "Backup restored" })
      setPending(null)
      onRestored()
      onClose()
    },
    onError: (err) => toast({ variant: "error", title: "Restore backup", description: errorMessage(err) }),
  })

  return (
    <Modal open={open} onClose={onClose} title="Backups" description="Restore a previous version of this file">
      <div className="flex max-h-80 flex-col gap-1 overflow-auto">
        {isLoading ? (
          <div className="flex justify-center py-6">
            <Spinner />
          </div>
        ) : !backups || backups.length === 0 ? (
          <EmptyState icon={History} title="No backups yet" hint="A backup is written each time you save." />
        ) : (
          backups.map((b) => (
            <div key={b.name} className="flex items-center justify-between gap-3 rounded-md px-2 py-1.5 hover:bg-accent/50">
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <span className="truncate font-mono text-xs">{b.name}</span>
                  <Badge variant={b.kind === "auto" ? "outline" : "default"}>{b.kind}</Badge>
                </div>
                <div className="text-xs text-muted-foreground">
                  {formatBytes(b.size)} · {formatRelative(b.modified)}
                </div>
              </div>
              <Button size="sm" variant="outline" onClick={() => setPending(b.name)}>
                <RotateCcw className="size-3.5" /> Restore
              </Button>
            </div>
          ))
        )}
      </div>
      <ConfirmDialog
        open={pending !== null}
        title="Restore backup?"
        description="The current contents will be replaced. A backup of the current file is taken first."
        confirmLabel="Restore"
        loading={restore.isPending}
        onConfirm={() => pending && restore.mutate(pending)}
        onClose={() => setPending(null)}
      />
    </Modal>
  )
}

/** Loads a config fresh from disk on every open (gcTime 0) and never refetches in
 *  the background, so the body's edit state can't be overwritten mid-typing. The
 *  body remounts only when the file is explicitly re-read (e.g. after a restore). */
function ConfigEditor({ file, onDirtyChange }: { file: config.ConfigFile; onDirtyChange: (dirty: boolean) => void }) {
  const { data: original, dataUpdatedAt } = useQuery({
    queryKey: ["config", file.id],
    queryFn: () => ReadConfig(file.id),
    staleTime: Infinity,
    gcTime: 0,
  })

  if (original === undefined) {
    return (
      <div className="flex flex-1 items-center justify-center">
        <Spinner />
      </div>
    )
  }
  return <ConfigEditorBody key={dataUpdatedAt} file={file} original={original} onDirtyChange={onDirtyChange} />
}

function ConfigEditorBody({
  file,
  original,
  onDirtyChange,
}: {
  file: config.ConfigFile
  original: string
  onDirtyChange: (dirty: boolean) => void
}) {
  const queryClient = useQueryClient()
  const [content, setContent] = useState(original)
  const [loaded, setLoaded] = useState(original)
  const [query, setQuery] = useState("")
  const [matches, setMatches] = useState<config.Match[] | null>(null)
  const [showBackups, setShowBackups] = useState(false)

  const dirty = content !== loaded

  function edit(next: string) {
    setContent(next)
    onDirtyChange(next !== loaded)
  }

  const save = useMutation({
    mutationFn: (text: string) => SaveConfig(file.id, text),
    onSuccess: (_, text) => {
      setLoaded(text)
      onDirtyChange(content !== text)
      toast({ variant: "success", title: "Saved", description: file.name })
      queryClient.invalidateQueries({ queryKey: qk.configs })
      queryClient.invalidateQueries({ queryKey: qk.configBackups(file.id) })
    },
    onError: (err) => toast({ variant: "error", title: "Save config", description: errorMessage(err) }),
  })

  // ⌘S / Ctrl+S saves when there are unsaved edits.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "s") {
        e.preventDefault()
        if (dirty && !save.isPending) save.mutate(content)
      }
    }
    window.addEventListener("keydown", onKey)
    return () => window.removeEventListener("keydown", onKey)
  }, [dirty, save, content])

  useEffect(() => {
    const q = query.trim()
    if (!q) {
      setMatches(null)
      return
    }
    const id = window.setTimeout(() => {
      SearchConfig(file.id, q, false)
        .then(setMatches)
        .catch((err) => toast({ variant: "error", title: "Search config", description: errorMessage(err) }))
    }, 300)
    return () => window.clearTimeout(id)
  }, [query, file.id])

  function reload() {
    onDirtyChange(false)
    queryClient.invalidateQueries({ queryKey: ["config", file.id] })
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-3">
      <div className="flex items-center justify-between gap-2">
        <div className="flex min-w-0 items-center gap-2">
          <span className="truncate text-sm font-medium">{file.name}</span>
          {kindBadge(file.kind)}
          {dirty && <Badge variant="warning">unsaved</Badge>}
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <Button size="sm" loading={save.isPending} disabled={!dirty} onClick={() => save.mutate(content)}>
            <Save className="size-3.5" /> Save
          </Button>
          <Button size="sm" variant="ghost" disabled={!dirty} onClick={() => edit(loaded)}>
            <RotateCcw className="size-3.5" /> Revert
          </Button>
          <Button size="sm" variant="outline" onClick={() => setShowBackups(true)}>
            <History className="size-3.5" /> Backups
          </Button>
        </div>
      </div>

      <div className="relative">
        <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search this file…"
          className="pl-9 font-mono"
        />
      </div>

      {matches && (
        <div className="flex max-h-40 flex-col gap-0.5 overflow-auto rounded-md border border-border bg-console p-2">
          <div className="px-1 pb-1 text-xs text-muted-foreground">
            {matches.length} {matches.length === 1 ? "match" : "matches"}
          </div>
          {matches.slice(0, 50).map((m, i) => (
            <div key={`${m.line}-${i}`} className="flex gap-2 font-mono text-xs">
              <span className="w-10 shrink-0 text-right text-muted-foreground">{m.line}</span>
              <span className="truncate">{m.text}</span>
            </div>
          ))}
        </div>
      )}

      <Textarea
        value={content}
        onChange={(e) => edit(e.target.value)}
        spellCheck={false}
        className="min-h-0 flex-1 resize-none whitespace-pre bg-console font-mono text-xs leading-relaxed"
      />

      {showBackups && (
        <BackupsModal open={showBackups} fileId={file.id} onClose={() => setShowBackups(false)} onRestored={reload} />
      )}
    </div>
  )
}

export function Config() {
  const { data: state } = useAppState()
  const { data: files } = useQuery({ queryKey: qk.configs, queryFn: ListConfigs })
  const [selected, setSelected] = useState<config.ConfigFile | null>(null)
  const [dirty, setDirty] = useState(false)
  const [pendingSwitch, setPendingSwitch] = useState<config.ConfigFile | null>(null)

  function select(f: config.ConfigFile) {
    if (f.id === selected?.id) return
    if (dirty) {
      setPendingSwitch(f)
      return
    }
    open(f)
  }

  function open(f: config.ConfigFile) {
    setSelected(f)
    setDirty(false)
    setPendingSwitch(null)
  }

  if (state && !state.configured) return <NotConfigured />

  return (
    <div className="flex h-full flex-col gap-4 p-5">
      <PageHeader title="Config" description="Edit server configuration with automatic backups" />
      <div className="flex min-h-0 flex-1 gap-4">
        <Card className="w-64 shrink-0 overflow-auto p-2">
          {files && files.length > 0 ? (
            <ConfigList files={files} selectedId={selected?.id ?? null} onSelect={select} />
          ) : (
            <EmptyState icon={FileCog} title="No config files" />
          )}
        </Card>
        <Card className="flex min-h-0 flex-1 flex-col p-4">
          {selected ? (
            <ConfigEditor key={selected.id} file={selected} onDirtyChange={setDirty} />
          ) : (
            <div className="flex flex-1 items-center justify-center">
              <EmptyState icon={FileCog} title="Select a config file" hint="Pick a file from the list to start editing." />
            </div>
          )}
        </Card>
      </div>
      <ConfirmDialog
        open={pendingSwitch !== null}
        title="Discard unsaved changes?"
        description={`Your edits to ${selected?.name ?? "this file"} will be lost.`}
        confirmLabel="Discard"
        cancelLabel="Keep editing"
        confirmVariant="destructive"
        onConfirm={() => pendingSwitch && open(pendingSwitch)}
        onClose={() => setPendingSwitch(null)}
      />
    </div>
  )
}
