package process

import (
	"strings"

	gops "github.com/shirou/gopsutil/v4/process"
)

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
