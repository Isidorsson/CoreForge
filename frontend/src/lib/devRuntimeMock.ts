/*
 * Dev-only Wails runtime + bindings mock.
 *
 * Activates ONLY in a plain browser (vite dev server / design preview) where the
 * native Wails runtime is absent. Inside the real Wails webview `window.runtime`
 * is injected before the frontend loads, so the guard below is false and nothing
 * is installed. Excluded from production bundles via `import.meta.env.DEV`.
 *
 * Purpose: lets the UI render with representative data outside the desktop shell,
 * so the design can be reviewed in a browser and iterated with tooling.
 */

type Fn = (...args: unknown[]) => unknown
type Bindings = Record<string, Fn>

interface WailsWindow {
  runtime?: unknown
  go?: { main: { App: Bindings } }
}

function install() {
  const w = window as unknown as WailsWindow
  const now = Date.now()
  const iso = (msAgo: number) => new Date(now - msAgo).toISOString()

  const status = {
    core: "trinitycore",
    db: "ready",
    auth: { target: "auth", state: "running", pid: 24180, startedAt: now - 3_725_000, external: false },
    world: { target: "world", state: "running", pid: 24192, startedAt: now - 3_680_000, external: false },
    updatedAt: now,
  }

  const state = {
    configured: true,
    activeCore: "trinitycore",
    installDir: "C:\\Games\\TrinityCore\\server",
    hasModules: true,
    cores: [
      { type: "trinitycore", displayName: "TrinityCore", installDir: "C:\\Games\\TrinityCore\\server", configured: true },
      { type: "azerothcore", displayName: "AzerothCore", installDir: "", configured: false },
    ],
    settings: {
      activeCore: "trinitycore",
      logTailLines: 3000,
      confirmDestructive: true,
      stopServersOnExit: true,
      installs: { trinitycore: { type: "trinitycore", installDir: "C:\\Games\\TrinityCore\\server" } },
    },
  }

  const worldLog = [
    "TrinityCore rev. a1b2c3d4e5f6 2026-06-20 (Win64, RelWithDebInfo) started.",
    "Using configuration file C:/Games/TrinityCore/server/etc/worldserver.conf.",
    "2026-06-28 12:04:11 Opening DatabasePool 'world'. Asynchronous connections: 2, synchronous connections: 3.",
    "2026-06-28 12:04:11 MySQL client library: 8.0.36  | MySQL server ver: 8.0.36",
    "2026-06-28 12:04:12 Loading C++ scripts",
    "2026-06-28 12:04:13 >> Loaded 41218 creature templates in 1.842 s",
    "2026-06-28 12:04:14 >> Loaded 9032 spawn points in 0.611 s",
    "2026-06-28 12:04:14 [INFO] World initialized in 2 minutes 14 seconds.",
    "2026-06-28 12:04:14 SERVER: World Server started.",
    "2026-06-28 12:05:02 [INFO] Account login: 'ADMIN' (id 1) from 192.168.1.24:51544",
    "2026-06-28 12:06:31 WARNING: Map 530 (ExpansionArea) grid load latency 142 ms exceeds budget",
    "2026-06-28 12:07:48 [INFO] Player 'Khadgar' entered world at 0x0007F2 (Stormwind)",
    "2026-06-28 12:09:10 NOTICE: Saving 3 online characters",
  ]
  const authLog = [
    "TrinityCore auth server rev. a1b2c3d4e5f6 started.",
    "Using configuration file C:/Games/TrinityCore/server/etc/authserver.conf.",
    "2026-06-28 12:03:55 Opening DatabasePool 'login'. Synchronous connections: 1.",
    "2026-06-28 12:03:56 Started auth database connection pool.",
    "2026-06-28 12:03:56 Authentication server started on 0.0.0.0:3724",
    "2026-06-28 12:05:02 [INFO] '192.168.1.24:51540' attempting connection (account ADMIN)",
    "2026-06-28 12:05:02 [INFO] Realm list request from 192.168.1.24:51540",
  ]

  const logs = [
    { kind: "world", displayName: "Server.log", relPath: "logs/Server.log", exists: true, size: 1_843_200, modified: iso(45_000), clearable: true, archivable: true },
    { kind: "auth", displayName: "Auth.log", relPath: "logs/Auth.log", exists: true, size: 51_204, modified: iso(120_000), clearable: true, archivable: true },
    { kind: "dberrors", displayName: "DBErrors.log", relPath: "logs/DBErrors.log", exists: true, size: 0, modified: iso(8_400_000), clearable: true, archivable: false },
  ]

  const configs = [
    { id: "auth", name: "authserver.conf", kind: "auth", relPath: "etc/authserver.conf", size: 5_120, modified: iso(3_600_000) },
    { id: "world", name: "worldserver.conf", kind: "world", relPath: "etc/worldserver.conf", size: 84_210, modified: iso(900_000) },
    { id: "mod-eluna", name: "mod_LuaEngine.conf", kind: "module", relPath: "etc/modules/mod_LuaEngine.conf", size: 1_280, modified: iso(7_200_000) },
  ]
  const worldConf = [
    "###################################################",
    "# TrinityCore World Server configuration file",
    "###################################################",
    "[worldserver]",
    "",
    'DataDir = "."',
    "LogsDir = \"logs\"",
    "",
    "WorldServerPort = 8085",
    "GameType = 0",
    "RealmZone = 1",
    "Motd = \"Welcome to a TrinityCore server.\"",
    "",
    "# Rates",
    "Rate.XP.Kill = 1",
    "Rate.Drop.Money = 1",
    "MaxPlayerLevel = 80",
  ].join("\n")

  const files = [
    { name: "bin", relPath: "bin", isDir: true, size: 0, modified: iso(2_000_000) },
    { name: "data", relPath: "data", isDir: true, size: 0, modified: iso(86_400_000) },
    { name: "etc", relPath: "etc", isDir: true, size: 0, modified: iso(900_000) },
    { name: "logs", relPath: "logs", isDir: true, size: 0, modified: iso(45_000) },
    { name: "worldserver.exe", relPath: "worldserver.exe", isDir: false, size: 36_700_160, modified: iso(2_000_000) },
    { name: "authserver.exe", relPath: "authserver.exe", isDir: false, size: 18_874_368, modified: iso(2_000_000) },
    { name: "readme.md", relPath: "readme.md", isDir: false, size: 4_096, modified: iso(5_400_000) },
  ]

  const disk = {
    total: 48_318_382_080,
    scannedAt: iso(30_000),
    buckets: [
      { name: "data", bytes: 32_212_254_720 },
      { name: "maps", bytes: 9_663_676_416 },
      { name: "mmaps", bytes: 5_368_709_120 },
      { name: "logs", bytes: 1_073_741_824 },
    ],
  }

  const bindings: Bindings = {
    GetState: async () => state,
    GetStatus: async () => status,
    GetBacklog: async (target) => (target === "auth" ? authLog : worldLog),
    ListLogs: async () => logs,
    ReadLog: async (kind) => (kind === "auth" ? authLog : worldLog),
    StartLogTail: async () => undefined,
    StopLogTail: async () => undefined,
    ListConfigs: async () => configs,
    ReadConfig: async () => worldConf,
    SearchConfig: async () => [],
    ListConfigBackups: async () => [],
    BrowseFiles: async () => files,
    DiskUsage: async () => disk,
    CrashesPreview: async () => ({ files: [], count: 0, bytes: 0 }),
    BrowseForDirectory: async () => "",
  }

  const noop = async () => undefined
  w.go = {
    main: {
      App: new Proxy(bindings, {
        get: (t, p: string) => (p in t ? t[p] : noop),
      }),
    },
  }

  const runtime: Record<string, Fn> = {
    EventsOn: () => () => undefined,
    EventsOnce: () => () => undefined,
    EventsOff: () => undefined,
    EventsEmit: () => undefined,
    LogPrint: () => undefined,
    WindowSetTitle: () => undefined,
  }
  w.runtime = runtime

  // eslint-disable-next-line no-console
  console.info("[CoreForge] dev Wails mock installed — browser preview, representative data")
}

if (import.meta.env.DEV && typeof (window as unknown as WailsWindow).runtime === "undefined") {
  install()
}
