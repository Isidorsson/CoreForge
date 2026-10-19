package main

import (
	"context"
	"fmt"

	"CoreForge/internal/config"
	"CoreForge/internal/events"
	"CoreForge/internal/files"
	"CoreForge/internal/logs"
	"CoreForge/internal/metrics"
	"CoreForge/internal/process"
	"CoreForge/internal/profile"
	"CoreForge/internal/settings"

	wruntime "github.com/wailsapp/wails/v2/pkg/runtime"
)

// App is the single Wails-bound struct. It is a thin facade: every method
// validates input, delegates to an internal manager, and emits follow-up events.
type App struct {
	ctx   context.Context
	emit  *events.Switchable
	store *settings.Store

	Process *process.Manager
	Logs    *logs.Manager
	Config  *config.Manager
	Files   *files.Manager
	Metrics *metrics.Manager
}

// NewApp wires the managers with a switchable emitter (the real Wails emitter is
// installed at startup once the runtime context exists).
func NewApp() *App {
	emit := events.NewSwitchable()
	store, err := settings.Load()
	if err != nil || store == nil {
		store = settings.NewMemory()
	}
	s := store.Get()
	return &App{
		emit:    emit,
		store:   store,
		Process: process.NewManager(emit, s.LogTailLines),
		Logs:    logs.NewManager(emit, s.LogTailLines),
		Config:  config.NewManager(),
		Files:   files.NewManager(emit),
		Metrics: metrics.NewManager(),
	}
}

func (a *App) startup(ctx context.Context) {
	a.ctx = ctx
	a.emit.Set(events.NewWails(ctx))
	a.Process.SetContext(ctx)
	a.rebind()
	a.Process.StartStatusPoller(ctx)
}

func (a *App) shutdown(ctx context.Context) {
	a.Logs.StopAll()
	a.Process.StopPoller()
	// Managed servers run in consoles CoreForge owns and die with it, so stop them
	// cleanly (players saved) rather than leave them to be killed.
	a.Process.StopManaged()
}

// rebind resolves the active core and points every manager at it (or at an
// unconfigured profile when nothing is set up yet).
func (a *App) rebind() {
	s := a.store.Get()
	a.Process.SetTailLines(s.LogTailLines)

	resolved, err := a.store.ActiveResolved()
	if err != nil {
		resolved = profile.ResolvedProfile{}
	}
	a.Process.Rebind(resolved)
	a.Logs.Rebind(resolved, s.LogTailLines)
	a.Config.Rebind(resolved)
	a.Files.Rebind(resolved)
	a.Metrics.Rebind(resolved)
	a.applyMetricsOverride()
}

// --- state exposed to the frontend ---

// CoreOption describes a selectable core for the Settings picker.
type CoreOption struct {
	Type        string `json:"type"`
	DisplayName string `json:"displayName"`
	InstallDir  string `json:"installDir"`
	Configured  bool   `json:"configured"`
}

// AppState is the bootstrap snapshot the frontend loads on mount.
type AppState struct {
	Settings   settings.Settings `json:"settings"`
	Cores      []CoreOption      `json:"cores"`
	ActiveCore string            `json:"activeCore"`
	Configured bool              `json:"configured"`
	InstallDir string            `json:"installDir"`
	HasModules bool              `json:"hasModules"`
}

// GetState returns the current settings, the list of cores, and active-core info.
func (a *App) GetState() AppState {
	s := a.store.Get()
	st := AppState{Settings: s, ActiveCore: string(s.ActiveCore)}
	for _, p := range profile.List() {
		opt := CoreOption{Type: string(p.Type), DisplayName: p.DisplayName}
		if inst, ok := s.Installs[p.Type]; ok {
			opt.InstallDir = inst.InstallDir
			opt.Configured = inst.InstallDir != ""
		}
		st.Cores = append(st.Cores, opt)
	}
	if resolved, err := a.store.ActiveResolved(); err == nil {
		st.Configured = true
		st.InstallDir = resolved.Root
		st.HasModules = resolved.ModuleConfigPath() != ""
	}
	return st
}

// GetActiveProfile returns the resolved profile for the active core.
func (a *App) GetActiveProfile() (profile.ResolvedProfile, error) {
	return a.store.ActiveResolved()
}

// SetActiveCore switches the active core (refused while a server is running).
func (a *App) SetActiveCore(core string) error {
	ct := profile.CoreType(core)
	if _, ok := profile.Builtin(ct); !ok {
		return fmt.Errorf("unknown core %q", core)
	}
	if a.Process.AnyRunning() {
		return fmt.Errorf("stop the running server before switching cores")
	}
	if err := a.store.Update(func(s *settings.Settings) { s.ActiveCore = ct }); err != nil {
		return err
	}
	a.rebind()
	a.emit.Emit(events.EvtStateChanged)
	return nil
}

// SetInstallDir records a core's install directory.
func (a *App) SetInstallDir(core, dir string) error {
	ct := profile.CoreType(core)
	if _, ok := profile.Builtin(ct); !ok {
		return fmt.Errorf("unknown core %q", core)
	}
	if ct == a.store.Get().ActiveCore && a.Process.AnyRunning() {
		return fmt.Errorf("stop the running server before changing its install directory")
	}
	if err := a.store.Update(func(s *settings.Settings) {
		inst := s.Installs[ct]
		inst.Type = ct
		inst.InstallDir = dir
		s.Installs[ct] = inst
	}); err != nil {
		return err
	}
	a.rebind()
	a.emit.Emit(events.EvtStateChanged)
	return nil
}

// SetDockerOverride records per-install docker compose/container overrides.
func (a *App) SetDockerOverride(core, composePath, container string) error {
	ct := profile.CoreType(core)
	if _, ok := profile.Builtin(ct); !ok {
		return fmt.Errorf("unknown core %q", core)
	}
	if err := a.store.Update(func(s *settings.Settings) {
		inst := s.Installs[ct]
		inst.Type = ct
		inst.DockerComposeOverride = composePath
		inst.DockerContainerOverride = container
		s.Installs[ct] = inst
	}); err != nil {
		return err
	}
	a.rebind()
	a.emit.Emit(events.EvtStateChanged)
	return nil
}

// UpdateOptions sets the general app options.
func (a *App) UpdateOptions(logTailLines int, confirmDestructive bool) error {
	if err := a.store.Update(func(s *settings.Settings) {
		if logTailLines > 0 {
			s.LogTailLines = logTailLines
		}
		s.ConfirmDestructive = confirmDestructive
	}); err != nil {
		return err
	}
	a.rebind()
	a.emit.Emit(events.EvtStateChanged)
	return nil
}

// BrowseForDirectory opens the native folder picker and returns the chosen path.
func (a *App) BrowseForDirectory(title string) (string, error) {
	return wruntime.OpenDirectoryDialog(a.ctx, wruntime.OpenDialogOptions{Title: title})
}
