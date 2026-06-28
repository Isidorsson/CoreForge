// Package profile models the per-core differences between the supported WoW
// server emulators as plain data. Everything core-specific lives here so the
// rest of the app never branches on the core name.
package profile

// CoreType identifies a supported emulator.
type CoreType string

const (
	TrinityCore CoreType = "TrinityCore"
	AzerothCore CoreType = "AzerothCore"
)

// LogKind is the stable logical identity of a log, decoupled from its filename
// (TC's "DBErrors.log" and AC's "Errors.log" are both LogDBErrors).
type LogKind string

const (
	LogAuth     LogKind = "auth"
	LogServer   LogKind = "server"
	LogDBErrors LogKind = "dberrors"
	LogEluna    LogKind = "eluna"
	LogGM       LogKind = "gm"
	LogWSStdout LogKind = "ws_stdout"
	LogWSStderr LogKind = "ws_stderr"
)

// canonicalLogOrder controls the display order of logs in the UI.
var canonicalLogOrder = []LogKind{
	LogServer, LogAuth, LogDBErrors, LogEluna, LogGM, LogWSStdout, LogWSStderr,
}

// LogFile describes how to find a log relative to the install root plus its UI metadata.
type LogFile struct {
	Kind        LogKind `json:"kind"`
	DisplayName string  `json:"displayName"`
	RelPath     string  `json:"relPath"`
	Archivable  bool    `json:"archivable"`
	Clearable   bool    `json:"clearable"`
}

// Profile is a relative-path template for one core. Paths use forward slashes
// and are resolved against an install root via Resolve.
type Profile struct {
	Type        CoreType `json:"type"`
	DisplayName string   `json:"displayName"`

	AuthServerExe  string `json:"authServerExe"`
	WorldServerExe string `json:"worldServerExe"`

	// Config layout — captures TC (root) vs AC (configs/) differences.
	AuthConfigRel   string `json:"authConfigRel"`
	WorldConfigRel  string `json:"worldConfigRel"`
	ConfigDirRel    string `json:"configDirRel"`
	ModuleConfigDir string `json:"moduleConfigDir"`

	Logs map[LogKind]LogFile `json:"logs"`

	LuaScriptsDir string   `json:"luaScriptsDir"`
	CrashesDir    string   `json:"crashesDir"`
	DataDirs      []string `json:"dataDirs"`

	DockerComposeRel string `json:"dockerComposeRel"`
	DockerContainer  string `json:"dockerContainer"`
	DockerService    string `json:"dockerService"`
}

// OrderedLogs returns the profile's logs in canonical display order.
func (p Profile) OrderedLogs() []LogFile {
	out := make([]LogFile, 0, len(p.Logs))
	for _, k := range canonicalLogOrder {
		if lf, ok := p.Logs[k]; ok {
			out = append(out, lf)
		}
	}
	return out
}
