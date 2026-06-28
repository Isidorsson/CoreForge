package process

import (
	"bytes"
	"context"
	"errors"
	"fmt"
	"os/exec"
	"strings"
	"sync"
	"time"

	"CoreForge/internal/events"
)

// ErrDockerUnavailable means the docker CLI/daemon could not be reached.
var ErrDockerUnavailable = errors.New("docker is not available — is Docker Desktop running?")

const (
	dockerStateTimeout = 5 * time.Second
	dockerOpTimeout    = 90 * time.Second
)

// DockerDB controls the MariaDB container the servers connect to.
type DockerDB struct {
	mu          sync.Mutex
	composePath string
	container   string
	service     string
	emit        events.Emitter
}

func NewDockerDB(emit events.Emitter) *DockerDB { return &DockerDB{emit: emit} }

func (d *DockerDB) Rebind(composePath, container, service string) {
	d.mu.Lock()
	defer d.mu.Unlock()
	d.composePath = composePath
	d.container = container
	d.service = service
}

// ComposeConfigured reports whether this install has a compose file we can up/down.
func (d *DockerDB) ComposeConfigured() bool {
	d.mu.Lock()
	defer d.mu.Unlock()
	return d.composePath != ""
}

// Up starts the DB container detached.
func (d *DockerDB) Up(ctx context.Context) error {
	d.mu.Lock()
	compose := d.composePath
	d.mu.Unlock()
	if compose == "" {
		return fmt.Errorf("no docker compose file configured for this core")
	}
	d.emitState(DBStarting)
	cctx, cancel := context.WithTimeout(ctx, dockerOpTimeout)
	defer cancel()
	if _, err := runDocker(cctx, "compose", "-f", compose, "up", "-d"); err != nil {
		d.emitState(DBDown)
		return err
	}
	return nil
}

// Down stops and removes the DB container.
func (d *DockerDB) Down(ctx context.Context) error {
	d.mu.Lock()
	compose := d.composePath
	d.mu.Unlock()
	if compose == "" {
		return fmt.Errorf("no docker compose file configured for this core")
	}
	cctx, cancel := context.WithTimeout(ctx, dockerOpTimeout)
	defer cancel()
	_, err := runDocker(cctx, "compose", "-f", compose, "down")
	if err == nil {
		d.emitState(DBDown)
	}
	return err
}

// State inspects the container and maps it to a DBState.
func (d *DockerDB) State(ctx context.Context) DBState {
	d.mu.Lock()
	container := d.container
	d.mu.Unlock()
	if container == "" {
		return DBUnknown
	}
	cctx, cancel := context.WithTimeout(ctx, dockerStateTimeout)
	defer cancel()
	out, err := runDocker(cctx, "inspect", "-f",
		"{{.State.Running}};{{if .State.Health}}{{.State.Health.Status}}{{else}}none{{end}}", container)
	if err != nil {
		if errors.Is(err, ErrDockerUnavailable) {
			return DBUnknown
		}
		return DBDown // container not found / not created
	}
	parts := strings.SplitN(strings.TrimSpace(out), ";", 2)
	running := len(parts) > 0 && parts[0] == "true"
	health := "none"
	if len(parts) > 1 {
		health = parts[1]
	}
	if !running {
		return DBDown
	}
	switch health {
	case "starting":
		return DBStarting
	case "unhealthy":
		return DBUnhealthy
	default: // "healthy" or "none" (no healthcheck defined)
		return DBReady
	}
}

// WaitReady blocks until the DB is ready or the timeout elapses.
func (d *DockerDB) WaitReady(ctx context.Context, timeout time.Duration) error {
	deadline := time.Now().Add(timeout)
	for {
		switch d.State(ctx) {
		case DBReady:
			d.emitState(DBReady)
			return nil
		case DBUnknown:
			return ErrDockerUnavailable
		}
		if time.Now().After(deadline) {
			return fmt.Errorf("database did not become ready within %s", timeout)
		}
		select {
		case <-ctx.Done():
			return ctx.Err()
		case <-time.After(2 * time.Second):
		}
	}
}

func (d *DockerDB) emitState(s DBState) {
	d.emit.Emit(events.EvtDockerState, map[string]string{"state": string(s)})
}

func runDocker(ctx context.Context, args ...string) (string, error) {
	cmd := exec.CommandContext(ctx, "docker", args...)
	configureSysProcAttr(cmd)
	var stdout, stderr bytes.Buffer
	cmd.Stdout = &stdout
	cmd.Stderr = &stderr
	if err := cmd.Run(); err != nil {
		if errors.Is(err, exec.ErrNotFound) {
			return "", ErrDockerUnavailable
		}
		msg := strings.TrimSpace(stderr.String())
		if msg == "" {
			msg = err.Error()
		}
		return stdout.String(), fmt.Errorf("docker %s: %s", strings.Join(args, " "), msg)
	}
	return stdout.String(), nil
}
