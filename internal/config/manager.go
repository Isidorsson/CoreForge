// Package config lists, reads, edits (with auto-backup) and restores the active
// core's .conf files, handling the TC-root vs AC-configs/ layout difference.
package config

import (
	"errors"
	"fmt"
	"os"
	"path/filepath"
	"regexp"
	"strings"
	"sync"
	"time"

	"CoreForge/internal/profile"
)

var errNotConfigured = errors.New("no active install configured")

const maxSearchResults = 1000

// ConfigFile is the UI-facing description of one config file.
type ConfigFile struct {
	ID       string    `json:"id"`   // "auth" | "world" | "module:<filename>"
	Name     string    `json:"name"` // base filename
	Kind     string    `json:"kind"` // "auth" | "world" | "module"
	RelPath  string    `json:"relPath"`
	Size     int64     `json:"size"`
	Modified time.Time `json:"modified"`
}

// Match is one search hit in a config file.
type Match struct {
	Line int    `json:"line"`
	Text string `json:"text"`
}

// Manager provides config read/edit operations over the active install.
type Manager struct {
	mu       sync.Mutex
	resolved profile.ResolvedProfile
}

func NewManager() *Manager { return &Manager{} }

func (m *Manager) Rebind(r profile.ResolvedProfile) {
	m.mu.Lock()
	defer m.mu.Unlock()
	m.resolved = r
}

func (m *Manager) snapshot() profile.ResolvedProfile {
	m.mu.Lock()
	defer m.mu.Unlock()
	return m.resolved
}

// List returns the auth + world configs plus any module configs (AzerothCore).
func (m *Manager) List() ([]ConfigFile, error) {
	r := m.snapshot()
	if !r.IsConfigured() {
		return nil, errNotConfigured
	}
	out := make([]ConfigFile, 0)
	add := func(id, kind, path string) {
		info, err := os.Stat(path)
		if err != nil {
			return // only list files that exist
		}
		cf := ConfigFile{ID: id, Name: filepath.Base(path), Kind: kind, Size: info.Size(), Modified: info.ModTime()}
		if rel, err := filepath.Rel(r.Root, path); err == nil {
			cf.RelPath = filepath.ToSlash(rel)
		}
		out = append(out, cf)
	}
	add("auth", "auth", r.AuthConfigPath())
	add("world", "world", r.WorldConfigPath())
	if mdir := r.ModuleConfigPath(); mdir != "" {
		if entries, err := os.ReadDir(mdir); err == nil {
			for _, e := range entries {
				if e.IsDir() {
					continue
				}
				n := e.Name()
				if strings.HasSuffix(n, ".conf") || strings.HasSuffix(n, ".conf.dist") {
					add("module:"+n, "module", filepath.Join(mdir, n))
				}
			}
		}
	}
	return out, nil
}

// Read returns the full text of a config file.
func (m *Manager) Read(id string) (string, error) {
	r := m.snapshot()
	if !r.IsConfigured() {
		return "", errNotConfigured
	}
	path, err := m.resolvePath(r, id)
	if err != nil {
		return "", err
	}
	b, err := os.ReadFile(path)
	if err != nil {
		return "", err
	}
	return string(b), nil
}

// Save backs up the current file, then atomically writes content with the file's
// existing line-ending style preserved.
func (m *Manager) Save(id, content string) error {
	r := m.snapshot()
	if !r.IsConfigured() {
		return errNotConfigured
	}
	path, err := m.resolvePath(r, id)
	if err != nil {
		return err
	}
	crlf := false
	if existing, err := os.ReadFile(path); err == nil {
		crlf = strings.Contains(string(existing), "\r\n")
	}
	if _, err := backupFile(path); err != nil {
		return err
	}
	return atomicWrite(path, []byte(normalizeLineEndings(content, crlf)))
}

// Search returns lines matching query (substring, case-insensitive) or a regex.
func (m *Manager) Search(id, query string, useRegex bool) ([]Match, error) {
	if strings.TrimSpace(query) == "" {
		return []Match{}, nil
	}
	content, err := m.Read(id)
	if err != nil {
		return nil, err
	}
	var re *regexp.Regexp
	if useRegex {
		re, err = regexp.Compile(query)
		if err != nil {
			return nil, fmt.Errorf("invalid regex: %w", err)
		}
	}
	needle := strings.ToLower(query)
	out := make([]Match, 0)
	for i, line := range strings.Split(content, "\n") {
		line = strings.TrimSuffix(line, "\r")
		hit := false
		if useRegex {
			hit = re.MatchString(line)
		} else {
			hit = strings.Contains(strings.ToLower(line), needle)
		}
		if hit {
			out = append(out, Match{Line: i + 1, Text: line})
			if len(out) >= maxSearchResults {
				break
			}
		}
	}
	return out, nil
}

// ListBackups returns the saved backups for a config file.
func (m *Manager) ListBackups(id string) ([]Backup, error) {
	r := m.snapshot()
	if !r.IsConfigured() {
		return nil, errNotConfigured
	}
	path, err := m.resolvePath(r, id)
	if err != nil {
		return nil, err
	}
	return listBackups(path)
}

// Restore overwrites a config with one of its backups.
func (m *Manager) Restore(id, backupName string) error {
	r := m.snapshot()
	if !r.IsConfigured() {
		return errNotConfigured
	}
	path, err := m.resolvePath(r, id)
	if err != nil {
		return err
	}
	return restoreBackup(path, backupName)
}

func (m *Manager) resolvePath(r profile.ResolvedProfile, id string) (string, error) {
	switch {
	case id == "auth":
		return r.AuthConfigPath(), nil
	case id == "world":
		return r.WorldConfigPath(), nil
	case strings.HasPrefix(id, "module:"):
		name := strings.TrimPrefix(id, "module:")
		if name == "" || filepath.Base(name) != name {
			return "", fmt.Errorf("invalid module config id")
		}
		mdir := r.ModuleConfigPath()
		if mdir == "" {
			return "", fmt.Errorf("this core has no module configs")
		}
		return filepath.Join(mdir, name), nil
	default:
		return "", fmt.Errorf("unknown config id %q", id)
	}
}
