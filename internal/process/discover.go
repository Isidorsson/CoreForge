package process

import (
	"strings"

	gops "github.com/shirou/gopsutil/v4/process"
)

// discoverOne returns the PID of a running process whose executable path matches
// exe (case-insensitive), or 0 if none. Used by start/stop to reconcile a server
// CoreForge does not own (an orphan from a previous run or an external .bat).
func discoverOne(exe string) int {
	if exe == "" {
		return 0
	}
	procs, err := gops.Processes()
	if err != nil {
		return 0
	}
	for _, p := range procs {
		if ex, err := p.Exe(); err == nil && strings.EqualFold(ex, exe) {
			return int(p.Pid)
		}
	}
	return 0
}

// pidAlive reports whether a PID is still present on the system.
func pidAlive(pid int) bool {
	if pid <= 0 {
		return false
	}
	ok, err := gops.PidExists(int32(pid))
	return err == nil && ok
}

// discoverRunning returns the PIDs of running processes whose executable path
// matches the given auth/world exe paths (case-insensitive). A returned 0 means
// not found. This lets CoreForge detect servers started outside the app (e.g. via
// the user's .bat scripts) so it never double-spawns and can still stop them.
func discoverRunning(authExe, worldExe string) (authPID, worldPID int) {
	procs, err := gops.Processes()
	if err != nil {
		return 0, 0
	}
	for _, p := range procs {
		exe, err := p.Exe()
		if err != nil || exe == "" {
			continue
		}
		if authPID == 0 && strings.EqualFold(exe, authExe) {
			authPID = int(p.Pid)
		}
		if worldPID == 0 && strings.EqualFold(exe, worldExe) {
			worldPID = int(p.Pid)
		}
		if authPID != 0 && worldPID != 0 {
			break
		}
	}
	return authPID, worldPID
}
