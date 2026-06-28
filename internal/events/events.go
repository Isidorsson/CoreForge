// Package events defines the event bus used to stream live data (status,
// process output, log lines) from the Go backend to the frontend. Business-logic
// packages depend only on the Emitter interface so they stay unit-testable.
package events

import (
	"context"
	"sync"

	wruntime "github.com/wailsapp/wails/v2/pkg/runtime"
)

// Event names — the frontend subscribes to these via the Wails runtime EventsOn API.
const (
	EvtStatusChanged = "status:changed" // payload: process.Status
	EvtProcOutput    = "proc:output"    // payload: {target, lines:[]}
	EvtLogLine       = "log:line"       // payload: {kind, lines:[], reset?}
	EvtDockerState   = "docker:state"   // payload: {state}
	EvtConfigSaved   = "config:saved"   // payload: {id}
	EvtStateChanged  = "app:state"      // no payload — frontend refetches GetState
	EvtError         = "app:error"      // payload: {op, message}
)

// Emitter publishes a named event with an optional payload.
type Emitter interface {
	Emit(name string, data ...any)
}

// Nop is an Emitter that drops everything (used in tests and before startup).
type Nop struct{}

func (Nop) Emit(string, ...any) {}

// Wails is the production Emitter backed by the Wails runtime.
type Wails struct{ ctx context.Context }

func NewWails(ctx context.Context) *Wails { return &Wails{ctx: ctx} }

func (w *Wails) Emit(name string, data ...any) {
	if w.ctx == nil {
		return
	}
	wruntime.EventsEmit(w.ctx, name, data...)
}

// Switchable wraps an inner Emitter that can be swapped at runtime. This lets the
// managers be constructed before the Wails context exists (it arrives at startup).
type Switchable struct {
	mu    sync.RWMutex
	inner Emitter
}

func NewSwitchable() *Switchable { return &Switchable{inner: Nop{}} }

// Set replaces the backing emitter.
func (s *Switchable) Set(e Emitter) {
	s.mu.Lock()
	defer s.mu.Unlock()
	if e == nil {
		e = Nop{}
	}
	s.inner = e
}

func (s *Switchable) Emit(name string, data ...any) {
	s.mu.RLock()
	inner := s.inner
	s.mu.RUnlock()
	inner.Emit(name, data...)
}
