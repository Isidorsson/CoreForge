import type { ReactNode } from "react"
import { useRef } from "react"
import { X } from "lucide-react"
import { cn } from "@/shared/lib/utils"
import type { metrics } from "@wails/go/models"

/* WotLK id spaces, mirrored from internal/metrics/lookup.go for the dropdowns. */

const RACES = [
  { id: 1, name: "Human" },
  { id: 3, name: "Dwarf" },
  { id: 4, name: "Night Elf" },
  { id: 7, name: "Gnome" },
  { id: 11, name: "Draenei" },
  { id: 2, name: "Orc" },
  { id: 5, name: "Undead" },
  { id: 6, name: "Tauren" },
  { id: 8, name: "Troll" },
  { id: 10, name: "Blood Elf" },
]
const CLASSES = [
  { id: 1, name: "Warrior" },
  { id: 2, name: "Paladin" },
  { id: 3, name: "Hunter" },
  { id: 4, name: "Rogue" },
  { id: 5, name: "Priest" },
  { id: 6, name: "Death Knight" },
  { id: 7, name: "Shaman" },
  { id: 8, name: "Mage" },
  { id: 9, name: "Warlock" },
  { id: 11, name: "Druid" },
]

export const emptyFilter = (): metrics.Filter => ({
  faction: "",
  minLevel: 0,
  maxLevel: 0,
  activity: "",
  recentDays: 0,
  race: 0,
  class: 0,
})

export const filterActive = (f: metrics.Filter): boolean =>
  Boolean(f.faction || f.minLevel || f.maxLevel || f.activity || f.race || f.class)

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex items-center gap-2">
      <span className="text-[10px] uppercase tracking-wider text-muted-foreground">{label}</span>
      {children}
    </div>
  )
}

function Segmented({
  value,
  onChange,
  options,
}: {
  value: string
  onChange: (v: string) => void
  options: { value: string; label: string }[]
}) {
  return (
    <div className="inline-flex rounded-md border border-border p-0.5">
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          onClick={() => onChange(o.value)}
          className={cn(
            "rounded px-2 py-0.5 text-xs transition-colors",
            value === o.value ? "bg-secondary text-foreground" : "text-muted-foreground hover:text-foreground",
          )}
        >
          {o.label}
        </button>
      ))}
    </div>
  )
}

/** Numeric box with no spinner arrows: hold-and-drag horizontally to scrub the
 *  value (4px per step), or click to type. Pointer capture keeps the drag alive
 *  outside the box; a tap that never crosses the threshold falls through to focus. */
function NumBox({ value, placeholder, onChange }: { value: number; placeholder: string; onChange: (n: number) => void }) {
  const drag = useRef<{ startX: number; startVal: number; moved: boolean } | null>(null)

  const onPointerDown = (e: React.PointerEvent<HTMLInputElement>) => {
    if (e.button !== 0) return
    drag.current = { startX: e.clientX, startVal: value, moved: false }
  }
  const onPointerMove = (e: React.PointerEvent<HTMLInputElement>) => {
    const d = drag.current
    if (!d) return
    const dx = e.clientX - d.startX
    if (!d.moved && Math.abs(dx) < 3) return
    if (!d.moved) {
      d.moved = true
      e.currentTarget.setPointerCapture(e.pointerId)
    }
    e.preventDefault()
    onChange(Math.max(0, d.startVal + Math.round(dx / 4)))
  }
  const onPointerUp = (e: React.PointerEvent<HTMLInputElement>) => {
    const d = drag.current
    drag.current = null
    if (d?.moved) {
      e.currentTarget.releasePointerCapture(e.pointerId)
      e.currentTarget.blur()
    }
  }

  return (
    <input
      type="text"
      inputMode="numeric"
      aria-label={`${placeholder} level`}
      value={value || ""}
      placeholder={placeholder}
      onChange={(e) => onChange(Math.max(0, parseInt(e.target.value.replace(/\D/g, ""), 10) || 0))}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      className="h-7 w-12 cursor-ew-resize select-none rounded-md border border-border bg-transparent px-2 text-center text-xs tabular-nums placeholder:text-muted-foreground/70 focus-visible:cursor-text focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/60"
    />
  )
}

function MiniSelect({
  value,
  onChange,
  options,
  allLabel,
}: {
  value: number
  onChange: (n: number) => void
  options: { id: number; name: string }[]
  allLabel: string
}) {
  return (
    <select
      value={value}
      onChange={(e) => onChange(parseInt(e.target.value, 10) || 0)}
      className="h-7 rounded-md border border-border bg-card px-2 text-xs text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/60 [&>option]:bg-card"
    >
      <option value={0}>{allLabel}</option>
      {options.map((o) => (
        <option key={o.id} value={o.id}>
          {o.name}
        </option>
      ))}
    </select>
  )
}

export function FilterBar({ value, onChange }: { value: metrics.Filter; onChange: (f: metrics.Filter) => void }) {
  const set = (patch: Partial<metrics.Filter>) => onChange({ ...value, ...patch })
  return (
    <div className="flex flex-wrap items-center gap-x-4 gap-y-2 rounded-lg border border-border bg-card px-3 py-2">
      <Field label="Faction">
        <Segmented
          value={value.faction}
          onChange={(v) => set({ faction: v })}
          options={[
            { value: "", label: "All" },
            { value: "Alliance", label: "Alliance" },
            { value: "Horde", label: "Horde" },
          ]}
        />
      </Field>
      <Field label="Activity">
        <Segmented
          value={value.activity}
          onChange={(v) => set({ activity: v })}
          options={[
            { value: "", label: "All" },
            { value: "online", label: "Online" },
            { value: "recent", label: "Active 14d" },
          ]}
        />
      </Field>
      <Field label="Level">
        <div className="flex items-center gap-1">
          <NumBox value={value.minLevel} placeholder="min" onChange={(n) => set({ minLevel: n })} />
          <span className="text-xs text-muted-foreground">–</span>
          <NumBox value={value.maxLevel} placeholder="max" onChange={(n) => set({ maxLevel: n })} />
        </div>
      </Field>
      <Field label="Class">
        <MiniSelect value={value.class} onChange={(n) => set({ class: n })} options={CLASSES} allLabel="All classes" />
      </Field>
      <Field label="Race">
        <MiniSelect value={value.race} onChange={(n) => set({ race: n })} options={RACES} allLabel="All races" />
      </Field>
      {filterActive(value) && (
        <button
          type="button"
          onClick={() => onChange(emptyFilter())}
          className="ml-auto inline-flex items-center gap-1 text-xs text-muted-foreground transition-colors hover:text-foreground"
        >
          <X className="size-3" /> Reset
        </button>
      )}
    </div>
  )
}
