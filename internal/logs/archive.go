package logs

import (
	"fmt"
	"os"
	"path/filepath"
	"time"

	"CoreForge/internal/files"
	"CoreForge/internal/profile"
)

// ArchiveAll zips every non-empty archivable log into _archives and returns the
// archive's path relative to the install root.
func (m *Manager) ArchiveAll() (string, error) {
	m.mu.Lock()
	r := m.resolved
	m.mu.Unlock()
	if !r.IsConfigured() {
		return "", errNotConfigured
	}
	var kinds []string
	for _, lf := range r.OrderedLogs() {
		if lf.Archivable {
			kinds = append(kinds, string(lf.Kind))
		}
	}
	return m.Archive(kinds)
}

// Archive zips the named logs (skipping empty/missing ones) into _archives.
func (m *Manager) Archive(kinds []string) (string, error) {
	m.mu.Lock()
	r := m.resolved
	m.mu.Unlock()
	if !r.IsConfigured() {
		return "", errNotConfigured
	}
	var paths []string
	for _, k := range kinds {
		path, ok := r.LogPath(profile.LogKind(k))
		if !ok {
			continue
		}
		if info, err := os.Stat(path); err == nil && info.Size() > 0 {
			paths = append(paths, path)
		}
	}
	if len(paths) == 0 {
		return "", fmt.Errorf("no non-empty logs to archive")
	}
	name := fmt.Sprintf("logs-%s.zip", time.Now().Format("20060102-150405"))
	dest := filepath.Join(r.Root, files.ArchiveDir, name)
	if err := files.ZipFiles(dest, r.Root, paths); err != nil {
		return "", err
	}
	return filepath.ToSlash(filepath.Join(files.ArchiveDir, name)), nil
}
