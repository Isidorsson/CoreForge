// Package logs lists, tails, clears and archives the active core's log files.
package logs

import (
	"context"
	"errors"
	"fmt"
	"os"
	"sync"
	"time"

	"CoreForge/internal/events"
	"CoreForge/internal/profile"
)

var errNotConfigured = errors.New("no active install configured")

const readCapBytes = 512 * 1024 // scan at most the last 512KB for the initial pane fill

// LogEntry is the UI-facing description of one log file.
type LogEntry struct {
	Kind        string    `json:"kind"`
	DisplayName string    `json:"displayName"`
	RelPath     string    `json:"relPath"`
	Exists      bool      `json:"exists"`
	Size        int64     `json:"size"`
	Modified    time.Time `json:"modified"`
	Clearable   bool      `json:"clearable"`
	Archivable  bool      `json:"archivable"`
}

// Manager owns the active core's log state and any live tailers.
type Manager struct {
	mu        sync.Mutex
	resolved  profile.ResolvedProfile
	emit      events.Emitter
	tailers   map[profile.LogKind]*tailer
	tailLines int
}

func NewManager(emit events.Emitter, tailLines int) *Manager {
	return &Manager{
		emit:      emit,
		tailers:   map[profile.LogKind]*tailer{},
		tailLines: tailLines,
	}
}

// Rebind switches to a new core, stopping any live tailers first.
func (m *Manager) Rebind(r profile.ResolvedProfile, tailLines int) {
	m.mu.Lock()
	defer m.mu.Unlock()
	m.stopAllLocked()
	m.resolved = r
	if tailLines > 0 {
		m.tailLines = tailLines
	}
}

// List returns every log the active core defines, with live size/modtime.
func (m *Manager) List() []LogEntry {
	m.mu.Lock()
	r := m.resolved
	m.mu.Unlock()
	if !r.IsConfigured() {
		return []LogEntry{}
	}
	out := make([]LogEntry, 0)
	for _, lf := range r.OrderedLogs() {
		path, _ := r.LogPath(lf.Kind)
		e := LogEntry{
			Kind:        string(lf.Kind),
			DisplayName: lf.DisplayName,
			RelPath:     lf.RelPath,
			Clearable:   lf.Clearable,
			Archivable:  lf.Archivable,
		}
		if info, err := os.Stat(path); err == nil {
			e.Exists = true
			e.Size = info.Size()
			e.Modified = info.ModTime()
		}
		out = append(out, e)
	}
	return out
}

// Read returns the last tailLines lines of a log for the initial pane fill.
func (m *Manager) Read(kind string) ([]string, error) {
	path, _, err := m.pathFor(kind)
	if err != nil {
		return nil, err
	}
	m.mu.Lock()
	maxLines := m.tailLines
	m.mu.Unlock()
	return readTail(path, maxLines, readCapBytes)
}

// StartTail begins streaming new lines of a log via EvtLogLine events.
func (m *Manager) StartTail(kind string) error {
	path, _, err := m.pathFor(kind)
	if err != nil {
		return err
	}
	m.mu.Lock()
	defer m.mu.Unlock()
	k := profile.LogKind(kind)
	if _, ok := m.tailers[k]; ok {
		return nil // already tailing
	}
	ctx, cancel := context.WithCancel(context.Background())
	t := &tailer{kind: k, path: path, emit: m.emit, cancel: cancel}
	t.seekEnd()
	m.tailers[k] = t
	go t.run(ctx)
	return nil
}

// StopTail ends a log's live stream.
func (m *Manager) StopTail(kind string) error {
	m.mu.Lock()
	defer m.mu.Unlock()
	k := profile.LogKind(kind)
	if t, ok := m.tailers[k]; ok {
		t.cancel()
		delete(m.tailers, k)
	}
	return nil
}

// StopAll stops every live tailer (called on shutdown / core switch).
func (m *Manager) StopAll() {
	m.mu.Lock()
	defer m.mu.Unlock()
	m.stopAllLocked()
}

func (m *Manager) stopAllLocked() {
	for k, t := range m.tailers {
		t.cancel()
		delete(m.tailers, k)
	}
}

// Clear truncates a log in place — never delete+recreate, which would break the
// running server's open append handle.
func (m *Manager) Clear(kind string) error {
	path, lf, err := m.pathFor(kind)
	if err != nil {
		return err
	}
	if !lf.Clearable {
		return fmt.Errorf("%s is not clearable", lf.DisplayName)
	}
	if err := os.Truncate(path, 0); err != nil && !os.IsNotExist(err) {
		return err
	}
	m.mu.Lock()
	if t, ok := m.tailers[profile.LogKind(kind)]; ok {
		t.reset()
	}
	m.mu.Unlock()
	return nil
}

func (m *Manager) pathFor(kind string) (string, profile.LogFile, error) {
	m.mu.Lock()
	r := m.resolved
	m.mu.Unlock()
	if !r.IsConfigured() {
		return "", profile.LogFile{}, errNotConfigured
	}
	k := profile.LogKind(kind)
	lf, ok := r.Logs[k]
	if !ok {
		return "", profile.LogFile{}, fmt.Errorf("unknown log %q for this core", kind)
	}
	path, _ := r.LogPath(k)
	return path, lf, nil
}
