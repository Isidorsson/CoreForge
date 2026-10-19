//go:build windows

package process

import (
	"fmt"
	"os"
	"os/signal"
	"strings"
	"testing"
	"time"

	"golang.org/x/sys/windows"

	"CoreForge/internal/events"
)

// runCLIHelper behaves like TrinityCore's Windows CLI thread: it reads commands
// with ReadConsoleW, answers with WriteConsoleW (both fail on plain pipes) and
// shuts down cleanly on Ctrl+C.
func runCLIHelper() {
	interrupt := make(chan os.Signal, 1)
	signal.Notify(interrupt, os.Interrupt)
	go func() {
		<-interrupt
		fmt.Println("shutting down cleanly")
		os.Exit(0)
	}()

	in, _ := windows.GetStdHandle(windows.STD_INPUT_HANDLE)
	out, _ := windows.GetStdHandle(windows.STD_OUTPUT_HANDLE)
	write := func(s string) {
		u := windows.StringToUTF16(s)
		var n uint32
		_ = windows.WriteConsole(out, &u[0], uint32(len(u)-1), &n, nil)
	}
	fmt.Println("world initialized")
	write("TC> ")
	buf := make([]uint16, 256)
	for {
		var n uint32
		if err := windows.ReadConsole(in, &buf[0], uint32(len(buf)), &n, nil); err != nil || n == 0 {
			time.Sleep(10 * time.Millisecond)
			continue
		}
		cmd := strings.TrimRight(windows.UTF16ToString(buf[:n]), "\r\n")
		write("reply to " + cmd + "\r\n")
		write("TC> ")
	}
}

func startCLIHelper(t *testing.T) *managedProc {
	t.Helper()
	t.Setenv(helperCLIEnv, "1")
	exe, err := os.Executable()
	if err != nil {
		t.Fatal(err)
	}
	p := newManagedProc(TargetWorld, exe, t.TempDir(), events.Nop{}, 100, nil)
	if err := p.Start(); err != nil {
		t.Fatal(err)
	}
	t.Cleanup(func() { _ = p.Stop(true) })
	waitFor(t, func() bool { return backlogHas(p, "world initialized") })
	return p
}

func TestConsoleCommandReachesServerAndReplyIsCaptured(t *testing.T) {
	p := startCLIHelper(t)

	if err := p.SendLine("server info"); err != nil {
		t.Fatal(err)
	}
	waitFor(t, func() bool { return backlogHas(p, "reply to server info") })

	got := p.Backlog()
	echoes := 0
	for _, l := range got {
		if l == commandEchoMarker+"server info" {
			echoes++
		}
		if strings.Contains(l, "TC>") || strings.ContainsRune(l, '\x1b') {
			t.Errorf("backlog line still has terminal noise: %q", l)
		}
		if l == "server info" {
			t.Errorf("the console's own echo leaked into the backlog: %v", got)
		}
	}
	if echoes != 1 {
		t.Fatalf("command echo lines = %d, want 1; backlog %v", echoes, got)
	}
}

func TestGracefulStopSendsCtrlC(t *testing.T) {
	p := startCLIHelper(t)

	start := time.Now()
	if err := p.Stop(false); err != nil {
		t.Fatal(err)
	}
	if time.Since(start) > killTimeout {
		t.Fatalf("graceful stop took %s; Ctrl+C was not delivered", time.Since(start))
	}
	if !backlogHas(p, "shutting down cleanly") {
		t.Fatalf("server did not run its shutdown path; backlog %v", p.Backlog())
	}
	if s := p.Info().State; s != StateStopped {
		t.Fatalf("state = %s, want stopped", s)
	}
}
