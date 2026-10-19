# CoreForge

A desktop control panel for **World of Warcraft** private-server emulators —
manage **TrinityCore** and **AzerothCore** from one app. Start/stop the server
stack, stream live console output, tail and clear logs, edit config files with
automatic backups, browse realm metrics, and run sandboxed file tools.

Built with **Go + Wails v2** (native, single binary) and a **React 19 +
TypeScript + Tailwind v4** frontend.

> Status: v1 in development. Source-code/update management (git pull + rebuild)
> is planned for a later release.

## Features

- **Server control** — start/stop/restart the auth + world servers and the
  MariaDB (Docker) container, with a live status dashboard (state, PID, uptime)
  and detection of servers started outside the app. A server launched from your
  own `.bat` scripts is shown as external: CoreForge will not double-start it,
  can stop it, and can **Adopt** it (relaunch under CoreForge to get its console).
- **Live console** — stream `worldserver`/`authserver` stdout into the app and
  send console commands back to the running server.
- **Log management** — list every log the active core defines, live-tail, clear
  (truncate-in-place, safe while running), and archive to a timestamped zip.
- **Config editor** — edit `.conf` files with search; every save is backed up
  (`*.bak.<timestamp>`) and written atomically with the file's line endings
  preserved. Restore any backup. Ctrl+S saves, and switching files asks before
  discarding unsaved edits.
- **Metrics** — read-only realm statistics straight from the emulator's MySQL
  databases: accounts, online players, class/race/level/faction breakdowns,
  gold and playtime distributions, new-account trend, and leaderboards. Filter
  by faction, level range, race, class, and recent activity.
- **File tools** — sandboxed directory browser, disk-usage breakdown, one-click
  Crashes cleanup (with preview), and folder-to-zip backups.
- **Dynamic core profiles** — TrinityCore and AzerothCore differ on disk
  (config locations, log filenames); the app is driven by a per-core *profile*
  so the same UI works for both. Adding a third core is one registry entry.
- **Command palette** — Ctrl+K (⌘K) to jump between pages or start, stop, and
  restart any part of the stack from the keyboard.

## How it handles two cores

Everything core-specific is data in a `Profile`, never an `if core == ...`:

| | TrinityCore | AzerothCore |
|---|---|---|
| Config files | repo root (`worldserver.conf`) | `configs/` (+ `configs/modules/`) |
| Error log | `DBErrors.log` | `Errors.log` |
| Extra logs | `Eluna.log`, `GM.log`, `ws_stdout/stderr.txt` | — |

A `Profile` is resolved against your install directory (`ResolvedProfile`) and
every manager operates over that — so switching cores just rebinds paths.

## Architecture

```
main.go / app.go          Wails app + thin bound facade (the JS-callable surface)
internal/
  profile/                core abstraction + TC/AC registry + Resolve(root)
  settings/               %APPDATA%/CoreForge/settings.json (atomic)
  events/                 event bus (Emitter) streamed to the frontend
  process/                native auth/world processes + Docker DB + status poller
  logs/                   list / tail (offset-poll) / clear (truncate) / archive
  config/                 read / edit (+auto-backup) / restore / search
  files/                  sandboxed browse / disk usage / cleanup / backup
  metrics/                read-only MySQL aggregates for the Metrics page
frontend/                 React 19 + TS + Vite + Tailwind v4 SPA
  wailsjs/                generated Go bindings (imported as @wails/*)
  src/
    app/                  entry, routes, shell (sidebar, command palette), global CSS
    features/<page>/      one folder per page: the page plus its private parts
    shared/ui|hooks|lib/  code used by two or more features
    dev/                  browser-only Wails mock + loader showcase (dev builds only)
docs/                     design and product notes
```

New code goes in its feature folder. It moves to `shared/` only once a second
feature needs it.

The backend streams live data (status, console output, log lines) to the UI via
Wails runtime events rather than polling. `internal/` packages depend only on an
`Emitter` interface, so they're unit-testable without Wails.

## Requirements

- [Go](https://go.dev/) 1.26+ (`go.mod` pins toolchain 1.27.2; newer Go downloads it automatically)
- [Wails CLI](https://wails.io/) matching the module version:
  `go install github.com/wailsapp/wails/v2/cmd/wails@v2.16.0`
- [Node](https://nodejs.org/) 20.19+ and [pnpm](https://pnpm.io/)
- A WebView2 runtime (preinstalled on Windows 11)
- [Docker Desktop](https://www.docker.com/) — for the MariaDB database controls

## Development

```bash
# install frontend deps
cd frontend && pnpm install && cd ..

# run with hot reload (Go + frontend)
wails dev
```

## Testing

```bash
go test ./...                 # backend unit tests
cd frontend && pnpm test      # frontend tests (Vitest + Testing Library)
cd frontend && pnpm typecheck
```

## Build

```bash
wails build                       # produces build/bin/CoreForge.exe
wails build -nsis -webview2 embed # installer + bundled WebView2 runtime
```

## First run

1. Open **Settings**.
2. Pick the active core (TrinityCore or AzerothCore).
3. Set its **install directory** (e.g. `F:\...\MyServer\TrinityCore`).
4. (Optional) set Docker compose/container overrides — AzerothCore typically
   shares TrinityCore's `tc-mariadb` container.
5. Head to the **Dashboard** and start your stack.
6. (Optional) open **Metrics**. DB credentials are read from your
   `worldserver.conf` automatically. If that is wrong (e.g. a remote DB), set a
   manual override in Settings.

## Safety notes

- Logs are **truncated in place**, never deleted, so a running server's open log
  handle is never broken.
- Stopping a server walks a graceful ladder: console `quit` → polite `taskkill`
  → forced kill (only as a last resort).
- Every file path from the UI passes through a single path-traversal guard
  (`files.SafeJoin`) that keeps operations inside the install directory.
- Closing CoreForge does **not** stop your servers by default (they run
  headless); enable "Stop servers on exit" in Settings if you want that.
- Saving settings never drops a running server's handle; changing the active
  core or its install directory is refused while a server is running.
- Metrics queries are strictly read-only. A manual metrics DB override is stored
  in plain text in `%APPDATA%/CoreForge/settings.json`, like the
  `worldserver.conf` it mirrors.
