package process

import (
	"bufio"
	"fmt"
	"io"
	"os/exec"
	"strconv"
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
// CoreForge spawned and owns.
type managedProc struct {
	target  Target
	exePath string
	workDir string
	emit    events.Emitter
	ring    *ringBuffer
	batch   *lineBatcher
	notify  func() // ask the manager to re-evaluate + emit status

	mu      sync.Mutex
	cmd     *exec.Cmd
	stdin   io.WriteCloser
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

// Start spawns the process. It is deliberately NOT tied to a context — closing
// CoreForge must not kill a running game server.
func (p *managedProc) Start() error {
	p.mu.Lock()
	if p.state == StateRunning || p.state == StateStarting {
		p.mu.Unlock()
		return fmt.Errorf("%s server is already running", p.target)
	}
	p.state = StateStarting

	cmd := exec.Command(p.exePath)
	cmd.Dir = p.workDir
	configureSysProcAttr(cmd)

	stdout, err := cmd.StdoutPipe()
	if err != nil {
		p.state = StateStopped
		p.mu.Unlock()
		return err
	}
	stderr, err := cmd.StderrPipe()
	if err != nil {
		p.state = StateStopped
		p.mu.Unlock()
		return err
	}
	stdin, err := cmd.StdinPipe()
	if err != nil {
		p.state = StateStopped
		p.mu.Unlock()
		return err
	}

	p.ring.clear()
	if err := cmd.Start(); err != nil {
		p.state = StateStopped
		p.mu.Unlock()
		return fmt.Errorf("failed to start %s: %w", p.target, err)
	}

	p.cmd = cmd
	p.stdin = stdin
	p.pid = cmd.Process.Pid
	p.startAt = time.Now()
	p.state = StateRunning
	done := make(chan struct{})
	p.done = done
	p.mu.Unlock()

	go p.pump(stdout)
	go p.pump(stderr)
	go p.reap(done)
	if p.notify != nil {
		p.notify()
	}
	return nil
}

func (p *managedProc) pump(r io.Reader) {
	sc := bufio.NewScanner(r)
	sc.Buffer(make([]byte, 0, 64*1024), 4*1024*1024)
	for sc.Scan() {
		line := sc.Text()
		p.ring.append(line)
		p.batch.add(line)
	}
}

func (p *managedProc) reap(done chan struct{}) {
	err := p.cmd.Wait()
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
	p.stdin = nil
	p.mu.Unlock()

	close(done)
	if p.notify != nil {
		p.notify()
	}
}

// Stop walks the graceful-stop ladder: stdin "quit" → polite taskkill → forced
// taskkill. force=true skips straight to the forced kill.
func (p *managedProc) Stop(force bool) error {
	p.mu.Lock()
	if p.state != StateRunning && p.state != StateStarting {
		p.mu.Unlock()
		return nil
	}
	p.state = StateStopping
	pid := p.pid
	stdin := p.stdin
	done := p.done
	p.mu.Unlock()
	if p.notify != nil {
		p.notify()
	}

	if force {
		_ = taskkill(pid, true)
		return p.await(done, killTimeout)
	}
	// 1. Clean shutdown: the worldserver console accepts "quit"; this flushes the
	//    DB and releases log handles. authserver ignores it and falls through.
	if stdin != nil {
		_, _ = io.WriteString(stdin, "quit\r\n")
		if p.await(done, graceTimeout) == nil {
			return nil
		}
	}
	// 2. Polite taskkill (WM_CLOSE-style, no /F).
	_ = taskkill(pid, false)
	if p.await(done, killTimeout) == nil {
		return nil
	}
	// 3. Forced kill — last resort.
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

// SendLine writes a console command to the process's stdin.
func (p *managedProc) SendLine(s string) error {
	p.mu.Lock()
	defer p.mu.Unlock()
	if p.state != StateRunning || p.stdin == nil {
		return fmt.Errorf("%s server is not running", p.target)
	}
	_, err := io.WriteString(p.stdin, s+"\r\n")
	return err
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

// stopExternal terminates a server CoreForge did not spawn (an orphan from a
// previous run, or one launched via the user's .bat scripts). We don't own its
// stdin, so there is no clean "quit" path — escalate taskkill: polite (WM_CLOSE,
// which a console worldserver can still trap and flush on) first, then forced.
// force=true skips straight to the forced kill.
func stopExternal(pid int, force bool) error {
	if pid <= 0 {
		return nil
	}
	if force {
		return taskkill(pid, true)
	}
	_ = taskkill(pid, false)
	if waitGone(pid, graceTimeout) {
		return nil
	}
	return taskkill(pid, true)
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
