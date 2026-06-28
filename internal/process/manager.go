// Package process manages the lifecycle of the auth/world servers (native child
// processes) and the MariaDB container (Docker), and streams status + console
// output to the frontend.
package process

import (
	"context"
	"errors"
	"fmt"
	"sync"
	"time"

	"CoreForge/internal/events"
	"CoreForge/internal/profile"
)

var errNotReady = errors.New("no active install configured")

const (
	dbReadyTimeout = 90 * time.Second
	pollEvery      = 1500 * time.Millisecond
)

// Manager coordinates the DB + auth + world processes for the active core.
type Manager struct {
	mu        sync.Mutex
	emit      events.Emitter
	resolved  profile.ResolvedProfile
	auth      *managedProc
	world     *managedProc
	db        *DockerDB
	tailLines int

	appCtx     context.Context
	pollCancel context.CancelFunc
	pollSignal chan struct{}

	// Touched only by the poller goroutine — no extra lock needed.
	lastStatus Status
	hasLast    bool
}

func NewManager(emit events.Emitter, tailLines int) *Manager {
	return &Manager{
		emit:       emit,
		db:         NewDockerDB(emit),
		tailLines:  tailLines,
		pollSignal: make(chan struct{}, 1),
	}
}

func (m *Manager) SetContext(ctx context.Context) {
	m.mu.Lock()
	m.appCtx = ctx
	m.mu.Unlock()
}

func (m *Manager) SetTailLines(n int) {
	m.mu.Lock()
	if n > 0 {
		m.tailLines = n
	}
	m.mu.Unlock()
}

// Rebind rebuilds the managed processes for a newly-selected core/install.
func (m *Manager) Rebind(r profile.ResolvedProfile) {
	m.mu.Lock()
	defer m.mu.Unlock()
	m.resolved = r
	m.auth = newManagedProc(TargetAuth, r.AuthServerPath(), r.Root, m.emit, m.tailLines, m.triggerPoll)
	m.world = newManagedProc(TargetWorld, r.WorldServerPath(), r.Root, m.emit, m.tailLines, m.triggerPoll)
	m.db.Rebind(r.DockerComposePath(), r.DockerContainer, r.DockerService)
}

// AnyRunning reports whether a server is running/transitioning — used to block a
// core switch while servers are live.
func (m *Manager) AnyRunning() bool {
	m.mu.Lock()
	auth, world := m.auth, m.world
	m.mu.Unlock()
	return isLive(auth) || isLive(world)
}

func isLive(p *managedProc) bool {
	if p == nil {
		return false
	}
	switch p.Info().State {
	case StateRunning, StateStarting, StateStopping:
		return true
	default:
		return false
	}
}

func (m *Manager) procs() (auth, world *managedProc) {
	m.mu.Lock()
	defer m.mu.Unlock()
	return m.auth, m.world
}

func (m *Manager) ctx() context.Context {
	m.mu.Lock()
	defer m.mu.Unlock()
	if m.appCtx == nil {
		return context.Background()
	}
	return m.appCtx
}

// --- server controls ---

func (m *Manager) StartAuth() error {
	auth, _ := m.procs()
	if auth == nil {
		return errNotReady
	}
	return auth.Start()
}

func (m *Manager) StartWorld() error {
	_, world := m.procs()
	if world == nil {
		return errNotReady
	}
	return world.Start()
}

func (m *Manager) StopAuth(force bool) error {
	auth, _ := m.procs()
	if auth == nil {
		return errNotReady
	}
	return auth.Stop(force)
}

func (m *Manager) StopWorld(force bool) error {
	_, world := m.procs()
	if world == nil {
		return errNotReady
	}
	return world.Stop(force)
}

// StartAll brings up the stack in order: DB → wait-ready → auth → world.
func (m *Manager) StartAll() error {
	auth, world := m.procs()
	if auth == nil || world == nil {
		return errNotReady
	}
	if m.db.ComposeConfigured() {
		ctx := m.ctx()
		if err := m.db.Up(ctx); err != nil {
			return err
		}
		if err := m.db.WaitReady(ctx, dbReadyTimeout); err != nil {
			return err
		}
	}
	if err := auth.Start(); err != nil {
		return err
	}
	if err := world.Start(); err != nil {
		return err
	}
	m.triggerPoll()
	return nil
}

// StopAll stops world then auth (DB is left up unless stopped explicitly).
func (m *Manager) StopAll(force bool) error {
	auth, world := m.procs()
	var firstErr error
	if world != nil {
		if err := world.Stop(force); err != nil {
			firstErr = err
		}
	}
	if auth != nil {
		if err := auth.Stop(force); err != nil && firstErr == nil {
			firstErr = err
		}
	}
	m.triggerPoll()
	return firstErr
}

func (m *Manager) Restart(target string) error {
	switch Target(target) {
	case TargetAuth:
		if err := m.StopAuth(false); err != nil {
			return err
		}
		return m.StartAuth()
	case TargetWorld:
		if err := m.StopWorld(false); err != nil {
			return err
		}
		return m.StartWorld()
	default:
		return fmt.Errorf("unknown target %q", target)
	}
}

func (m *Manager) SendConsole(target, cmd string) error {
	auth, world := m.procs()
	switch Target(target) {
	case TargetAuth:
		if auth == nil {
			return errNotReady
		}
		return auth.SendLine(cmd)
	case TargetWorld:
		if world == nil {
			return errNotReady
		}
		return world.SendLine(cmd)
	default:
		return fmt.Errorf("unknown target %q", target)
	}
}

func (m *Manager) Backlog(target string) []string {
	auth, world := m.procs()
	switch Target(target) {
	case TargetAuth:
		if auth != nil {
			return auth.Backlog()
		}
	case TargetWorld:
		if world != nil {
			return world.Backlog()
		}
	}
	return nil
}

// --- DB controls ---

func (m *Manager) StartDB() error {
	ctx := m.ctx()
	if err := m.db.Up(ctx); err != nil {
		return err
	}
	go func() {
		_ = m.db.WaitReady(ctx, dbReadyTimeout)
		m.triggerPoll()
	}()
	m.triggerPoll()
	return nil
}

func (m *Manager) StopDB() error {
	err := m.db.Down(m.ctx())
	m.triggerPoll()
	return err
}

// --- status ---

// GetStatus computes a fresh snapshot, including detection of externally-started
// servers that CoreForge does not own.
func (m *Manager) GetStatus() Status {
	m.mu.Lock()
	auth, world, db := m.auth, m.world, m.db
	resolved := m.resolved
	m.mu.Unlock()

	st := Status{
		Core:      string(resolved.Type),
		DB:        DBUnknown,
		Auth:      ProcInfo{Target: TargetAuth, State: StateStopped},
		World:     ProcInfo{Target: TargetWorld, State: StateStopped},
		UpdatedAt: time.Now().UnixMilli(),
	}
	if !resolved.IsConfigured() {
		return st
	}

	st.DB = db.State(context.Background())
	if auth != nil {
		st.Auth = auth.Info()
	}
	if world != nil {
		st.World = world.Info()
	}

	needAuth := st.Auth.State == StateStopped || st.Auth.State == StateCrashed
	needWorld := st.World.State == StateStopped || st.World.State == StateCrashed
	if needAuth || needWorld {
		aPID, wPID := discoverRunning(resolved.AuthServerPath(), resolved.WorldServerPath())
		if needAuth && aPID > 0 {
			st.Auth = ProcInfo{Target: TargetAuth, State: StateRunning, PID: aPID, External: true}
		}
		if needWorld && wPID > 0 {
			st.World = ProcInfo{Target: TargetWorld, State: StateRunning, PID: wPID, External: true}
		}
	}
	return st
}

// StartStatusPoller emits status changes on a ticker and whenever triggerPoll fires.
func (m *Manager) StartStatusPoller(ctx context.Context) {
	cctx, cancel := context.WithCancel(ctx)
	m.mu.Lock()
	m.pollCancel = cancel
	m.mu.Unlock()

	go func() {
		t := time.NewTicker(pollEvery)
		defer t.Stop()
		m.emitStatus()
		for {
			select {
			case <-cctx.Done():
				return
			case <-t.C:
				m.emitStatus()
			case <-m.pollSignal:
				m.emitStatus()
			}
		}
	}()
}

func (m *Manager) StopPoller() {
	m.mu.Lock()
	cancel := m.pollCancel
	m.mu.Unlock()
	if cancel != nil {
		cancel()
	}
}

func (m *Manager) triggerPoll() {
	select {
	case m.pollSignal <- struct{}{}:
	default:
	}
}

// emitStatus is only ever called from the poller goroutine, so lastStatus/hasLast
// need no extra synchronization.
func (m *Manager) emitStatus() {
	st := m.GetStatus()
	if m.hasLast && statusEqual(st, m.lastStatus) {
		return
	}
	m.lastStatus = st
	m.hasLast = true
	m.emit.Emit(events.EvtStatusChanged, st)
}
