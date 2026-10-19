package process

import (
	"fmt"
	"os"
	"os/signal"
	"strconv"
	"testing"
	"time"

	"CoreForge/internal/events"
)

const (
	helperLinesEnv = "COREFORGE_HELPER_LINES"
	helperHangEnv  = "COREFORGE_HELPER_HANG"
	helperCLIEnv   = "COREFORGE_HELPER_CLI"
)

// TestMain doubles as a fake server binary: with helperLinesEnv set, the test
// executable prints that many lines and exits non-zero, like a crashing worldserver;
// with helperHangEnv set, it ignores input and Ctrl+C and never exits, like a stuck
// one; with helperCLIEnv set, it runs a console command loop (see runCLIHelper).
func TestMain(m *testing.M) {
	if os.Getenv(helperCLIEnv) != "" {
		runCLIHelper()
	}
	if os.Getenv(helperHangEnv) != "" {
		// Subscribing without reading swallows Ctrl+C; signal.Ignore would not on
		// Windows, where Go's default handler exits the process.
		signal.Notify(make(chan os.Signal, 1), os.Interrupt)
		fmt.Println("hung")
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
	waitFor(t, func() bool { return backlogHas(p, "hung") })

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

func backlogHas(p *managedProc, line string) bool {
	for _, l := range p.Backlog() {
		if l == line {
			return true
		}
	}
	return false
}
