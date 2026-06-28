package profile

// builtins holds the shipped profiles with the real on-disk values for each core.
var builtins = map[CoreType]Profile{
	TrinityCore: {
		Type:           TrinityCore,
		DisplayName:    "TrinityCore",
		AuthServerExe:  "authserver.exe",
		WorldServerExe: "worldserver.exe",
		AuthConfigRel:  "authserver.conf",
		WorldConfigRel: "worldserver.conf",
		ConfigDirRel:   ".",
		Logs: map[LogKind]LogFile{
			LogServer:   {LogServer, "Server Log", "Server.log", true, true},
			LogAuth:     {LogAuth, "Auth Log", "Auth.log", true, true},
			LogDBErrors: {LogDBErrors, "DB Errors", "DBErrors.log", true, true},
			LogEluna:    {LogEluna, "Eluna Log", "Eluna.log", true, true},
			LogGM:       {LogGM, "GM Log", "GM.log", true, true},
			LogWSStdout: {LogWSStdout, "World stdout", "ws_stdout.txt", true, true},
			LogWSStderr: {LogWSStderr, "World stderr", "ws_stderr.txt", true, true},
		},
		LuaScriptsDir:    "lua_scripts",
		CrashesDir:       "Crashes",
		DataDirs:         []string{"maps", "mmaps", "vmaps", "dbc", "Cameras"},
		DockerComposeRel: "docker/docker-compose.yml",
		DockerContainer:  "tc-mariadb",
		DockerService:    "mariadb",
	},
	AzerothCore: {
		Type:            AzerothCore,
		DisplayName:     "AzerothCore",
		AuthServerExe:   "authserver.exe",
		WorldServerExe:  "worldserver.exe",
		AuthConfigRel:   "configs/authserver.conf",
		WorldConfigRel:  "configs/worldserver.conf",
		ConfigDirRel:    "configs",
		ModuleConfigDir: "configs/modules",
		Logs: map[LogKind]LogFile{
			LogServer:   {LogServer, "Server Log", "Server.log", true, true},
			LogAuth:     {LogAuth, "Auth Log", "Auth.log", true, true},
			LogDBErrors: {LogDBErrors, "Errors", "Errors.log", true, true},
		},
		LuaScriptsDir: "lua_scripts",
		CrashesDir:    "Crashes",
		DataDirs:      []string{"data"},
		// AzerothCore has no docker/ dir of its own in the reference install —
		// it typically shares TrinityCore's tc-mariadb container. These are
		// sensible defaults; both are overridable per install in Settings.
		DockerComposeRel: "docker/docker-compose.yml",
		DockerContainer:  "tc-mariadb",
		DockerService:    "mariadb",
	},
}

// Builtin returns the shipped profile for a core.
func Builtin(t CoreType) (Profile, bool) {
	p, ok := builtins[t]
	return p, ok
}

// List returns all shipped profiles in a stable order (for the core picker).
func List() []Profile {
	return []Profile{builtins[TrinityCore], builtins[AzerothCore]}
}
