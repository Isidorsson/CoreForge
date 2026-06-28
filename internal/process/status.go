package process

// State is the lifecycle of a managed server process.
type State string

const (
	StateStopped  State = "stopped"
	StateStarting State = "starting"
	StateRunning  State = "running"
	StateStopping State = "stopping"
	StateCrashed  State = "crashed"
)

// Target names one of the two server processes.
type Target string

const (
	TargetAuth  Target = "auth"
	TargetWorld Target = "world"
)

// DBState is the health of the MariaDB container.
type DBState string

const (
	DBUnknown   DBState = "unknown" // docker not available / not configured
	DBDown      DBState = "down"
	DBStarting  DBState = "starting"
	DBReady     DBState = "ready"
	DBUnhealthy DBState = "unhealthy"
)

// ProcInfo is the live state of one server process. StartedAt lets the UI compute
// uptime locally so we don't have to emit an event every second.
type ProcInfo struct {
	Target    Target `json:"target"`
	State     State  `json:"state"`
	PID       int    `json:"pid"`
	StartedAt int64  `json:"startedAt"` // unix ms, 0 when not running
	External  bool   `json:"external"`  // running but not started/owned by CoreForge
}

// Status is the combined snapshot streamed to the frontend.
type Status struct {
	Core      string   `json:"core"`
	DB        DBState  `json:"db"`
	Auth      ProcInfo `json:"auth"`
	World     ProcInfo `json:"world"`
	UpdatedAt int64    `json:"updatedAt"`
}

type procOutputPayload struct {
	Target string   `json:"target"`
	Lines  []string `json:"lines"`
}

func statusEqual(a, b Status) bool {
	return a.Core == b.Core && a.DB == b.DB &&
		procEqual(a.Auth, b.Auth) && procEqual(a.World, b.World)
}

// procEqual compares everything that should trigger a UI update (uptime is derived
// from StartedAt locally, so it is intentionally not a spam source here).
func procEqual(a, b ProcInfo) bool {
	return a.State == b.State && a.PID == b.PID && a.StartedAt == b.StartedAt && a.External == b.External
}
