package process

import (
	"bufio"
	"fmt"
	"io"
	"os/exec"
	"strconv"
	"strings"
	"sync"
	"time"

	"CoreForge/internal/events"
)

const (
	batchDelay   = 100 * time.Millisecond
	graceTimeout = 12 * time.Second
	killTimeout  = 5 * time.Second
)

// managedProc is a single server process (authserver or worldserver) that
// CoreForge spawned and owns, attached to a console CoreForge controls.
type managedProc struct {
	target  Target
	exePath string
	workDir string
	emit    events.Emitter
	ring    *ringBuffer
	batch   *lineBatcher
	echoes  echoFilter
	notify  func() // ask the manager to re-evaluate + emit status

	mu      sync.Mutex
	con     console
	state   State
	pid     int
	startAt time.Time
	done    chan struct{}
}

func newManagedProc(target Target, exePath, workDir string, emit events.Emitter, ringSize int, notify func()) *managedProc {
	p := &managedProc{
		target:  target,
		exePath: exePath,
		workDir: workDir,
		emit:    emit,
		ring:    newRingBuffer(ringSize),
		notify:  notify,
		state:   StateStopped,
	}
	p.batch = newLineBatcher(batchDelay, p.flushLines)
	return p
}

func (p *managedProc) flushLines(lines []string) {
	p.emit.Emit(events.EvtProcOutput, procOutputPayload{Target: string(p.target), Lines: lines})
}

// Start spawns the process in a console CoreForge owns. The server lives only as
// long as that console, so CoreForge stops its servers when it closes.
func (p *managedProc) Start() error {
	p.mu.Lock()
	if p.state == StateRunning || p.state == StateStarting {
		p.mu.Unlock()
		return fmt.Errorf("%s server is already running", p.target)
	}
	p.ring.clear()
	con, err := startConsole(p.exePath, p.workDir)
	if err != nil {
		p.mu.Unlock()
		return fmt.Errorf("failed to start %s: %w", p.target, err)
	}
	p.con = con
	p.pid = con.Pid()
	p.startAt = time.Now()
	p.state = StateRunning
	done := make(chan struct{})
	p.done = done
	p.mu.Unlock()

	drained := make(chan struct{})
	go p.pump(con.Output(), drained)
	go p.reap(con, done, drained)
	if p.notify != nil {
		p.notify()
	}
	return nil
}

func (p *managedProc) pump(out io.ReadCloser, drained chan<- struct{}) {
	defer close(drained)
	defer out.Close()
	sc := bufio.NewScanner(out)
	sc.Buffer(make([]byte, 0, 64*1024), 4*1024*1024)
	for sc.Scan() {
		text, keep := terminalLine(sc.Text())
		if !keep {
			continue
		}
		if line, keep := p.echoes.filter(text); keep {
			p.record(line)
		}
	}
}

func (p *managedProc) record(line string) {
	p.ring.append(line)
	p.batch.add(line)
}

// reap waits for the exit, then closes the console: a console's output does not
// end when its process exits, and closing it flushes the final lines, which for a
// crash are the ones that matter.
func (p *managedProc) reap(con console, done chan struct{}, drained <-chan struct{}) {
	err := con.Wait()
	_ = con.Close()
	<-drained
	p.batch.flushNow()

	p.mu.Lock()
	switch {
	case p.state == StateStopping:
		p.state = StateStopped
	case err != nil:
		p.state = StateCrashed
	default:
		p.state = StateStopped
	}
	p.pid = 0
	p.con = nil
	p.mu.Unlock()

	close(done)
	if p.notify != nil {
		p.notify()
	}
}

// Stop sends Ctrl+C, which the cores handle as a clean shutdown (players saved,
// DB flushed), then force-kills if the server has not exited within the grace
// period. force=true skips straight to the kill, and also cuts short a graceful
// stop that is already in progress but hanging.
func (p *managedProc) Stop(force bool) error {
	p.mu.Lock()
	pid, con, done := p.pid, p.con, p.done
	switch {
	case p.state == StateStopping && force:
		p.mu.Unlock()
		return p.kill(pid, done)
	case p.state != StateRunning && p.state != StateStarting:
		p.mu.Unlock()
		return nil
	}
	p.state = StateStopping
	p.mu.Unlock()
	if p.notify != nil {
		p.notify()
	}

	if !force && con != nil && con.Interrupt() == nil && p.await(done, graceTimeout) == nil {
		return nil
	}
	return p.kill(pid, done)
}

// kill force-terminates the process tree and waits for reap to observe the exit.
func (p *managedProc) kill(pid int, done chan struct{}) error {
	_ = taskkill(pid, true)
	return p.await(done, killTimeout)
}

func (p *managedProc) await(done chan struct{}, timeout time.Duration) error {
	if done == nil {
		return nil
	}
	select {
	case <-done:
		return nil
	case <-time.After(timeout):
		return fmt.Errorf("%s did not stop within %s", p.target, timeout)
	}
}

// SendLine types a command into the server's console and records it in the
// backlog. Control characters are stripped so input cannot, say, send Ctrl+C.
func (p *managedProc) SendLine(s string) error {
	cmd := strings.TrimSpace(cleanTerminalLine(s))
	if cmd == "" {
		return fmt.Errorf("empty command")
	}
	p.mu.Lock()
	defer p.mu.Unlock()
	if p.state != StateRunning || p.con == nil {
		return fmt.Errorf("%s server is not running", p.target)
	}
	p.echoes.expect(cmd)
	if _, err := io.WriteString(p.con.Input(), cmd+"\r"); err != nil {
		return fmt.Errorf("send to %s console: %w", p.target, err)
	}
	p.record(commandEchoMarker + cmd)
	return nil
}

func (p *managedProc) Info() ProcInfo {
	p.mu.Lock()
	defer p.mu.Unlock()
	info := ProcInfo{Target: p.target, State: p.state, PID: p.pid}
	if p.state == StateRunning && !p.startAt.IsZero() {
		info.StartedAt = p.startAt.UnixMilli()
	}
	return info
}

func (p *managedProc) Backlog() []string { return p.ring.snapshot() }

// ClearBacklog empties the stored console output.
func (p *managedProc) ClearBacklog() { p.ring.clear() }

// stopExternal terminates a server CoreForge did not spawn (an orphan from a
// previous run, or one launched via the user's .bat scripts). We don't own its
// stdin, so there is no clean "quit" path — escalate taskkill: polite (WM_CLOSE,
// which a console worldserver can still trap and flush on) first, then forced.
// force=true skips straight to the forced kill.
func stopExternal(pid int, force bool) error {
	if pid <= 0 {
		return nil
	}
	if !force {
		_ = taskkill(pid, false)
		if waitGone(pid, graceTimeout) {
			return nil
		}
	}
	// taskkill /F returns before the process is fully gone; wait so a restart
	// that follows does not see the old instance and refuse to start.
	_ = taskkill(pid, true)
	if !waitGone(pid, killTimeout) {
		return fmt.Errorf("process %d did not exit within %s", pid, killTimeout)
	}
	return nil
}

// waitGone polls until the PID disappears or the timeout elapses.
func waitGone(pid int, timeout time.Duration) bool {
	deadline := time.Now().Add(timeout)
	for time.Now().Before(deadline) {
		if !pidAlive(pid) {
			return true
		}
		time.Sleep(250 * time.Millisecond)
	}
	return !pidAlive(pid)
}

// taskkill terminates a process tree by PID via the Windows taskkill utility.
func taskkill(pid int, force bool) error {
	if pid <= 0 {
		return nil
	}
	args := []string{"/PID", strconv.Itoa(pid), "/T"}
	if force {
		args = append(args, "/F")
	}
	cmd := exec.Command("taskkill", args...)
	configureSysProcAttr(cmd)
	return cmd.Run()
}
