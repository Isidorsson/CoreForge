// Package settings persists the user's configuration (active core, per-core
// install dirs, options) to %APPDATA%/CoreForge/settings.json with atomic writes.
package settings

import (
	"encoding/json"
	"errors"
	"os"
	"path/filepath"
	"sync"

	"CoreForge/internal/profile"
)

const (
	appDirName       = "CoreForge"
	settingsFileName = "settings.json"
	defaultTailLines = 500
)

// ErrNotConfigured means no active core / install dir has been chosen yet.
var ErrNotConfigured = errors.New("no active core configured — set one in Settings")

// CoreInstall is one core's on-disk location plus optional docker overrides.
type CoreInstall struct {
	Type                    profile.CoreType `json:"type"`
	InstallDir              string           `json:"installDir"`
	DockerComposeOverride   string           `json:"dockerComposeOverride,omitempty"`
	DockerContainerOverride string           `json:"dockerContainerOverride,omitempty"`
}

// MetricsDBOverride holds manual MySQL credentials for the metrics page, used
// when auto-discovery from worldserver.conf is wrong (e.g. a remote DB host).
// Stored as plaintext, like the worldserver.conf it mirrors — this is a
// local-only desktop tool with no network surface.
type MetricsDBOverride struct {
	Host    string `json:"host"`
	Port    string `json:"port"`
	User    string `json:"user"`
	Pass    string `json:"pass"`
	AuthDB  string `json:"authDb"`
	WorldDB string `json:"worldDb"`
	CharDB  string `json:"charDb"`
}

// Settings is the pure, serializable user configuration.
type Settings struct {
	ActiveCore         profile.CoreType                 `json:"activeCore"`
	Installs           map[profile.CoreType]CoreInstall `json:"installs"`
	LogTailLines       int                              `json:"logTailLines"`
	ConfirmDestructive bool                             `json:"confirmDestructive"`
	StopServersOnExit  bool                             `json:"stopServersOnExit"`
	MetricsDB          *MetricsDBOverride               `json:"metricsDb,omitempty"`
}

// Defaults returns a fresh Settings with sensible defaults.
func Defaults() *Settings {
	return &Settings{
		Installs:           map[profile.CoreType]CoreInstall{},
		LogTailLines:       defaultTailLines,
		ConfirmDestructive: true,
		StopServersOnExit:  false,
	}
}

// Store guards Settings with a mutex and owns the on-disk file.
type Store struct {
	mu   sync.Mutex
	path string
	data *Settings
}

// NewMemory returns a Store backed only by memory (no persistence). Used as a
// last-resort fallback if %APPDATA% cannot be created.
func NewMemory() *Store { return &Store{data: Defaults()} }

// AppDataDir returns (and creates) %APPDATA%/CoreForge.
func AppDataDir() (string, error) {
	base, err := os.UserConfigDir()
	if err != nil {
		return "", err
	}
	dir := filepath.Join(base, appDirName)
	if err := os.MkdirAll(dir, 0o755); err != nil {
		return "", err
	}
	return dir, nil
}

// Load reads settings.json, returning a Store seeded with defaults if the file is
// missing. A corrupt file is renamed aside and defaults are used rather than failing.
func Load() (*Store, error) {
	dir, err := AppDataDir()
	if err != nil {
		return nil, err
	}
	path := filepath.Join(dir, settingsFileName)
	s := &Store{path: path, data: Defaults()}

	b, err := os.ReadFile(path)
	if err != nil {
		if os.IsNotExist(err) {
			return s, nil
		}
		return nil, err
	}

	var d Settings
	if err := json.Unmarshal(b, &d); err != nil {
		_ = os.Rename(path, path+".corrupt")
		return s, nil
	}
	if d.Installs == nil {
		d.Installs = map[profile.CoreType]CoreInstall{}
	}
	if d.LogTailLines <= 0 {
		d.LogTailLines = defaultTailLines
	}
	s.data = &d
	return s, nil
}

// Get returns a copy of the current settings.
func (s *Store) Get() Settings {
	s.mu.Lock()
	defer s.mu.Unlock()
	return *s.data
}

// Update applies fn to the settings under lock and persists the result atomically.
func (s *Store) Update(fn func(*Settings)) error {
	s.mu.Lock()
	defer s.mu.Unlock()
	fn(s.data)
	return s.save()
}

// save writes the settings atomically (temp file in the same dir + rename). Caller holds the lock.
func (s *Store) save() error {
	if s.path == "" {
		return nil // memory-only store
	}
	b, err := json.MarshalIndent(s.data, "", "  ")
	if err != nil {
		return err
	}
	tmp := s.path + ".tmp"
	if err := os.WriteFile(tmp, b, 0o644); err != nil {
		return err
	}
	return os.Rename(tmp, s.path)
}

// ActiveResolved resolves the active core's install into a ResolvedProfile, folding
// in any docker overrides. Returns ErrNotConfigured if no usable install is set.
func (s *Store) ActiveResolved() (profile.ResolvedProfile, error) {
	s.mu.Lock()
	defer s.mu.Unlock()
	d := s.data
	if d.ActiveCore == "" {
		return profile.ResolvedProfile{}, ErrNotConfigured
	}
	inst, ok := d.Installs[d.ActiveCore]
	if !ok || inst.InstallDir == "" {
		return profile.ResolvedProfile{}, ErrNotConfigured
	}
	base, ok := profile.Builtin(d.ActiveCore)
	if !ok {
		return profile.ResolvedProfile{}, errors.New("unknown core: " + string(d.ActiveCore))
	}
	resolved, err := base.Resolve(inst.InstallDir)
	if err != nil {
		return profile.ResolvedProfile{}, err
	}
	resolved.ApplyDockerOverrides(inst.DockerComposeOverride, inst.DockerContainerOverride)
	return resolved, nil
}
