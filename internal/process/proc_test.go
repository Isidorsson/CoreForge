package process

import (
	"fmt"
	"os"
	"strconv"
	"testing"
	"time"

	"CoreForge/internal/events"
)

const (
	helperLinesEnv = "COREFORGE_HELPER_LINES"
	helperHangEnv  = "COREFORGE_HELPER_HANG"
)

// TestMain doubles as a fake server binary: with helperLinesEnv set, the test
// executable prints that many lines and exits non-zero, like a crashing worldserver;
// with helperHangEnv set, it ignores stdin and never exits, like a stuck one.
func TestMain(m *testing.M) {
	if os.Getenv(helperHangEnv) != "" {
		time.Sleep(time.Hour)
		os.Exit(0)
	}
	if n, err := strconv.Atoi(os.Getenv(helperLinesEnv)); err == nil {
		for i := 1; i <= n; i++ {
			fmt.Printf("line %d\n", i)
		}
		os.Exit(3)
	}
	os.Exit(m.Run())
}

func TestCrashKeepsEveryOutputLine(t *testing.T) {
	const lines = 20000
	t.Setenv(helperLinesEnv, strconv.Itoa(lines))
	exe, err := os.Executable()
	if err != nil {
		t.Fatal(err)
	}
	p := newManagedProc(TargetWorld, exe, t.TempDir(), events.Nop{}, lines, nil)

	if err := p.Start(); err != nil {
		t.Fatal(err)
	}
	p.mu.Lock()
	done := p.done
	p.mu.Unlock()
	select {
	case <-done:
	case <-time.After(30 * time.Second):
		t.Fatal("helper process did not exit")
	}

	got := p.Backlog()
	if len(got) != lines {
		t.Fatalf("captured %d of %d lines; trailing crash output was dropped", len(got), lines)
	}
	if got[len(got)-1] != fmt.Sprintf("line %d", lines) {
		t.Fatalf("last line = %q", got[len(got)-1])
	}
	if s := p.Info().State; s != StateCrashed {
		t.Fatalf("state = %s, want crashed", s)
	}
}

func TestForceKillsAProcessStuckInGracefulStop(t *testing.T) {
	skipUnlessWindows(t)
	t.Setenv(helperHangEnv, "1")
	exe, err := os.Executable()
	if err != nil {
		t.Fatal(err)
	}
	p := newManagedProc(TargetWorld, exe, t.TempDir(), events.Nop{}, 10, nil)
	if err := p.Start(); err != nil {
		t.Fatal(err)
	}
	t.Cleanup(func() { _ = p.Stop(true) })

	graceful := make(chan error, 1)
	go func() { graceful <- p.Stop(false) }()
	waitFor(t, func() bool { return p.Info().State == StateStopping })

	if err := p.Stop(true); err != nil {
		t.Fatalf("force stop: %v", err)
	}
	if s := p.Info().State; s != StateStopped {
		t.Fatalf("state after force = %s, want stopped", s)
	}
	select {
	case <-graceful:
	case <-time.After(killTimeout):
		t.Fatal("graceful stop kept waiting after the process was force-killed")
	}
}
