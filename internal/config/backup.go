package config

import (
	"fmt"
	"os"
	"path/filepath"
	"sort"
	"strings"
	"time"
)

const maxAutoBackups = 15

// Backup describes one saved copy of a config file.
type Backup struct {
	Name     string    `json:"name"`
	Size     int64     `json:"size"`
	Modified time.Time `json:"modified"`
	Kind     string    `json:"kind"` // "auto" (.bak.*) | "user" (.old)
}

// backupFile copies path to "<name>.bak.<timestamp>" beside it and prunes old
// auto-backups. Returns the backup filename, or "" if the source did not exist.
func backupFile(path string) (string, error) {
	data, err := os.ReadFile(path)
	if err != nil {
		if os.IsNotExist(err) {
			return "", nil
		}
		return "", err
	}
	name := filepath.Base(path) + ".bak." + time.Now().Format("20060102-150405")
	if err := os.WriteFile(filepath.Join(filepath.Dir(path), name), data, 0o644); err != nil {
		return "", err
	}
	pruneBackups(path)
	return name, nil
}

func pruneBackups(path string) {
	dir := filepath.Dir(path)
	prefix := filepath.Base(path) + ".bak."
	entries, err := os.ReadDir(dir)
	if err != nil {
		return
	}
	var autos []string
	for _, e := range entries {
		if strings.HasPrefix(e.Name(), prefix) {
			autos = append(autos, e.Name())
		}
	}
	if len(autos) <= maxAutoBackups {
		return
	}
	sort.Strings(autos) // timestamp suffix sorts chronologically
	for _, name := range autos[:len(autos)-maxAutoBackups] {
		_ = os.Remove(filepath.Join(dir, name))
	}
}

// listBackups returns the auto (.bak.*) and user (.old) backups of a config file,
// newest first.
func listBackups(path string) ([]Backup, error) {
	dir := filepath.Dir(path)
	base := filepath.Base(path)
	entries, err := os.ReadDir(dir)
	if err != nil {
		if os.IsNotExist(err) {
			return []Backup{}, nil
		}
		return nil, err
	}
	out := make([]Backup, 0)
	for _, e := range entries {
		if e.IsDir() {
			continue
		}
		name := e.Name()
		var kind string
		switch {
		case strings.HasPrefix(name, base+".bak."):
			kind = "auto"
		case name == base+".old":
			kind = "user"
		default:
			continue
		}
		info, err := e.Info()
		if err != nil {
			continue
		}
		out = append(out, Backup{Name: name, Size: info.Size(), Modified: info.ModTime(), Kind: kind})
	}
	sort.Slice(out, func(i, j int) bool { return out[i].Modified.After(out[j].Modified) })
	return out, nil
}

// restoreBackup overwrites path with the named backup, snapshotting the current
// contents first so the restore is itself undoable.
func restoreBackup(path, backupName string) error {
	if backupName == "" || filepath.Base(backupName) != backupName {
		return fmt.Errorf("invalid backup name")
	}
	base := filepath.Base(path)
	if !strings.HasPrefix(backupName, base+".bak.") && backupName != base+".old" {
		return fmt.Errorf("%q is not a backup of %s", backupName, base)
	}
	data, err := os.ReadFile(filepath.Join(filepath.Dir(path), backupName))
	if err != nil {
		return err
	}
	if _, err := backupFile(path); err != nil {
		return err
	}
	return atomicWrite(path, data)
}

// atomicWrite writes data via a temp file in the same dir + rename (same-volume atomic).
func atomicWrite(path string, data []byte) error {
	tmp := path + ".tmp"
	if err := os.WriteFile(tmp, data, 0o644); err != nil {
		return err
	}
	return os.Rename(tmp, path)
}

// normalizeLineEndings rewrites s to use CRLF when crlf is true, else LF.
func normalizeLineEndings(s string, crlf bool) string {
	s = strings.ReplaceAll(s, "\r\n", "\n")
	if crlf {
		s = strings.ReplaceAll(s, "\n", "\r\n")
	}
	return s
}
