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

  const slice = (label: string, count: number) => ({ key: label, label, count })
  const dayISO = (daysAgo: number) => new Date(now - daysAgo * 86_400_000).toISOString().slice(0, 10)
  const char = (name: string, race: string, klass: string, level: number, value: number) => ({
    name, race, class: klass, level, value,
  })

  const metrics = {
    generatedAt: iso(0),
    overview: {
      accounts: 1284,
      activeAccounts: 342,
      characters: 4173,
      onlineNow: 37,
      guilds: 86,
      bannedAccounts: 14,
      maxLevelChars: 512,
      avgLevel: 41.7,
    },
    races: [
      slice("Human", 980), slice("Blood Elf", 720), slice("Night Elf", 540), slice("Orc", 430),
      slice("Undead", 410), slice("Tauren", 300), slice("Troll", 280), slice("Draenei", 250),
      slice("Dwarf", 190), slice("Gnome", 173),
    ],
    classes: [
      slice("Death Knight", 640), slice("Paladin", 560), slice("Warrior", 520), slice("Mage", 470),
      slice("Hunter", 460), slice("Priest", 400), slice("Warlock", 360), slice("Rogue", 340),
      slice("Druid", 290), slice("Shaman", 233),
    ],
    factions: [slice("Alliance", 2133), slice("Horde", 2040)],
    genders: [slice("Male", 2300), slice("Female", 1873)],
    levels: [
      { label: "1–9", min: 1, max: 9, count: 430 },
      { label: "10–19", min: 10, max: 19, count: 380 },
      { label: "20–29", min: 20, max: 29, count: 340 },
      { label: "30–39", min: 30, max: 39, count: 300 },
      { label: "40–49", min: 40, max: 49, count: 280 },
      { label: "50–59", min: 50, max: 59, count: 260 },
      { label: "60", min: 60, max: 60, count: 210 },
      { label: "61–69", min: 61, max: 69, count: 340 },
      { label: "70", min: 70, max: 70, count: 520 },
      { label: "71–79", min: 71, max: 79, count: 601 },
      { label: "80", min: 80, max: 80, count: 512 },
    ],
    economy: {
      totalCopper: 92_473_100_000,
      avgGold: 2216.4,
      richest: [
        char("Goldmaxxer", "Goblin", "Rogue", 80, 214_748_360),
        char("Bankalt", "Blood Elf", "Mage", 80, 198_220_010),
        char("Tycoonia", "Gnome", "Warlock", 80, 176_540_900),
        char("Auctionz", "Human", "Paladin", 80, 154_330_220),
        char("Hoarder", "Undead", "Priest", 79, 132_009_870),
        char("Coinflip", "Orc", "Hunter", 80, 119_870_500),
        char("Smelter", "Dwarf", "Warrior", 77, 98_220_340),
        char("Flipper", "Troll", "Shaman", 80, 87_650_120),
      ],
    },
    topPlaytime: [
      char("Nolifeking", "Human", "Druid", 80, 8_640_000),
      char("Grindset", "Orc", "Death Knight", 80, 7_920_400),
      char("Marathon", "Night Elf", "Hunter", 80, 7_110_900),
      char("Everquest", "Undead", "Warlock", 80, 6_840_300),
      char("Sleepless", "Tauren", "Shaman", 80, 6_120_700),
      char("Veteran", "Draenei", "Paladin", 80, 5_980_100),
      char("Persistent", "Blood Elf", "Mage", 79, 5_220_440),
      char("Dedicated", "Gnome", "Rogue", 80, 4_900_000),
    ],
    topLevel: [
      char("Firstto80", "Blood Elf", "Paladin", 80, 80),
      char("Speedrun", "Human", "Mage", 80, 80),
      char("Worldfirst", "Orc", "Warrior", 80, 80),
      char("Hardcore", "Night Elf", "Druid", 80, 80),
      char("Climber", "Undead", "Priest", 79, 79),
      char("Almostthere", "Tauren", "Hunter", 79, 79),
      char("Pushing", "Troll", "Shaman", 78, 78),
      char("Leveling", "Draenei", "Paladin", 77, 77),
    ],
    topGuilds: [
      { name: "Eternal Vanguard", members: 312, leader: "Highlord" },
      { name: "Crimson Covenant", members: 268, leader: "Bloodqueen" },
      { name: "Northwatch", members: 221, leader: "Captainmarsh" },
      { name: "Shadow Syndicate", members: 198, leader: "Nightblade" },
      { name: "Ironforge Brigade", members: 176, leader: "Anvilbeard" },
      { name: "Emerald Circle", members: 154, leader: "Thornwarden" },
      { name: "Sunfury Remnant", members: 132, leader: "Pyromancer" },
      { name: "Frostwolf Legacy", members: 119, leader: "Wolfmother" },
    ],
    signups: Array.from({ length: 30 }, (_, i) => ({ date: dayISO(29 - i), count: 6 + ((i * 7) % 19) })),
  }

  const dbInfo = {
    host: "127.0.0.1",
    port: "3306",
    user: "trinity",
    authDb: "auth",
    worldDb: "world",
    charDb: "characters",
    source: "config",
    hasPass: true,
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
    GetServerMetrics: async () => metrics,
    GetMetricsDBInfo: async () => dbInfo,
    TestMetricsConnection: async () => dbInfo,
    SetMetricsDBOverride: async () => undefined,
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
    // The wailsjs runtime wrapper's EventsOn/EventsOnce delegate to
    // EventsOnMultiple, so it must exist or every useWailsEvent crashes.
    EventsOnMultiple: () => () => undefined,
    EventsOn: () => () => undefined,
    EventsOnce: () => () => undefined,
    EventsOff: () => undefined,
    EventsOffAll: () => undefined,
    EventsEmit: () => undefined,
    LogPrint: () => undefined,
    LogError: () => undefined,
    LogFatal: () => undefined,
    WindowSetTitle: () => undefined,
    ClipboardSetText: async () => true,
  }
  w.runtime = runtime

  // eslint-disable-next-line no-console
  console.info("[CoreForge] dev Wails mock installed — browser preview, representative data")
}

if (import.meta.env.DEV && typeof (window as unknown as WailsWindow).runtime === "undefined") {
  install()
}
