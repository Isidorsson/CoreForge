package process

import (
	"os"
	"os/exec"
	"path/filepath"
	"runtime"
	"testing"
	"time"

	"CoreForge/internal/events"
	"CoreForge/internal/profile"
)

func resolvedAt(root string) profile.ResolvedProfile {
	return profile.ResolvedProfile{
		Profile: profile.Profile{AuthServerExe: "bin/authserver.exe", WorldServerExe: "bin/worldserver.exe"},
		Root:    root,
	}
}

func TestRebindSamePathsKeepsManagedProcs(t *testing.T) {
	m := NewManager(events.Nop{}, 100)
	m.Rebind(resolvedAt(`C:\cores\tc`))
	auth, world := m.procs()

	m.Rebind(resolvedAt(`C:\cores\tc`))
	auth2, world2 := m.procs()

	if auth2 != auth || world2 != world {
		t.Fatal("rebinding with unchanged paths replaced the managed processes, orphaning any running server")
	}
}

func TestRebindChangedRootReplacesManagedProcs(t *testing.T) {
	m := NewManager(events.Nop{}, 100)
	m.Rebind(resolvedAt(`C:\cores\tc`))
	auth, world := m.procs()

	m.Rebind(resolvedAt(`C:\cores\ac`))
	auth2, world2 := m.procs()

	if auth2 == auth || world2 == world {
		t.Fatal("rebinding to a new install root kept the old processes")
	}
	if auth2.exePath != `C:\cores\ac\bin\authserver.exe` {
		t.Fatalf("auth exe = %q", auth2.exePath)
	}
}

func TestSetTailLinesResizesExistingBacklog(t *testing.T) {
	m := NewManager(events.Nop{}, 5)
	m.Rebind(resolvedAt(`C:\cores\tc`))
	auth, _ := m.procs()
	for _, l := range []string{"a", "b", "c", "d", "e"} {
		auth.ring.append(l)
	}

	m.SetTailLines(2)

	got := auth.Backlog()
	if len(got) != 2 || got[0] != "d" || got[1] != "e" {
		t.Fatalf("backlog after shrink = %v, want [d e]", got)
	}
}

// installFakeServers copies the test binary in as authserver.exe and worldserver.exe,
// so a spawned copy is discovered by exe path exactly like a real server.
func installFakeServers(t *testing.T) profile.ResolvedProfile {
	t.Helper()
	self, err := os.Executable()
	if err != nil {
		t.Fatal(err)
	}
	data, err := os.ReadFile(self)
	if err != nil {
		t.Fatal(err)
	}
	r := resolvedAt(t.TempDir())
	for _, exe := range []string{r.AuthServerPath(), r.WorldServerPath()} {
		if err := os.MkdirAll(filepath.Dir(exe), 0o755); err != nil {
			t.Fatal(err)
		}
		if err := os.WriteFile(exe, data, 0o755); err != nil {
			t.Fatal(err)
		}
	}
	return r
}

// startExternal launches a hung server outside the manager, as a .bat script would.
func startExternal(t *testing.T, exe string) int {
	t.Helper()
	cmd := exec.Command(exe)
	cmd.Env = append(os.Environ(), helperHangEnv+"=1")
	if err := cmd.Start(); err != nil {
		t.Fatal(err)
	}
	t.Cleanup(func() {
		_ = cmd.Process.Kill()
		_ = cmd.Wait()
	})
	pid := cmd.Process.Pid
	waitFor(t, func() bool { return discoverOne(exe) == pid })
	return pid
}

func TestExternalStopReportsStoppingAndForceFinishesIt(t *testing.T) {
	skipUnlessWindows(t)
	r := installFakeServers(t)
	m := NewManager(events.Nop{}, 10)
	m.Rebind(r)
	pid := startExternal(t, r.AuthServerPath())

	graceful := make(chan error, 1)
	go func() { graceful <- m.StopAuth(false) }()
	waitFor(t, func() bool {
		a := m.GetStatus().Auth
		return a.State == StateStopping && a.External && a.PID == pid
	})

	if err := m.StopAuth(true); err != nil {
		t.Fatalf("force stop: %v", err)
	}
	if pidAlive(pid) {
		t.Fatal("force stop returned while the process was still alive; an immediate Adopt would collide with it")
	}
	select {
	case <-graceful:
	case <-time.After(killTimeout):
		t.Fatal("graceful external stop did not finish after the force kill")
	}
	if a := m.GetStatus().Auth; a.State != StateStopped || a.External {
		t.Fatalf("auth after stop = %+v, want stopped", a)
	}
}

func TestStartAllSkipsAServerAlreadyRunningExternally(t *testing.T) {
	skipUnlessWindows(t)
	t.Setenv(helperHangEnv, "1")
	r := installFakeServers(t)
	m := NewManager(events.Nop{}, 10)
	m.Rebind(r)
	startExternal(t, r.AuthServerPath())
	_, world := m.procs()
	t.Cleanup(func() { _ = world.Stop(true) })

	if err := m.StartAll(); err != nil {
		t.Fatalf("StartAll with auth already running: %v", err)
	}
	if s := world.Info().State; s != StateRunning {
		t.Fatalf("world state = %s, want running", s)
	}
}

func skipUnlessWindows(t *testing.T) {
	t.Helper()
	if runtime.GOOS != "windows" {
		t.Skip("stop paths shell out to taskkill")
	}
}

func waitFor(t *testing.T, cond func() bool) {
	t.Helper()
	deadline := time.Now().Add(10 * time.Second)
	for !cond() {
		if time.Now().After(deadline) {
			t.Fatal("condition not met within 10s")
		}
		time.Sleep(50 * time.Millisecond)
	}
}
