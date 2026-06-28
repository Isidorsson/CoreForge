package files

import (
	"fmt"
	"os"
	"os/exec"
	"path/filepath"
	"sort"
	"sync"
	"time"

	"CoreForge/internal/events"
	"CoreForge/internal/profile"
)

// ArchiveDir is the in-tree folder where backups/log archives are written.
const ArchiveDir = "_archives"

// Entry is one item in a directory listing.
type Entry struct {
	Name     string    `json:"name"`
	RelPath  string    `json:"relPath"`
	IsDir    bool      `json:"isDir"`
	Size     int64     `json:"size"`
	Modified time.Time `json:"modified"`
}

// UsageBucket is a disk-usage total for one top-level area of the install.
type UsageBucket struct {
	Name  string `json:"name"`
	Bytes int64  `json:"bytes"`
}

// UsageReport is the result of a disk-usage scan.
type UsageReport struct {
	Total     int64         `json:"total"`
	Buckets   []UsageBucket `json:"buckets"`
	ScannedAt time.Time     `json:"scannedAt"`
}

// CleanupPreview describes files a destructive op would (or did) remove.
type CleanupPreview struct {
	Files []string `json:"files"`
	Count int      `json:"count"`
	Bytes int64    `json:"bytes"`
}

// Manager provides sandboxed file operations over the active install directory.
type Manager struct {
	mu       sync.RWMutex
	resolved profile.ResolvedProfile
	emit     events.Emitter
}

func NewManager(emit events.Emitter) *Manager { return &Manager{emit: emit} }

// Rebind points the manager at a new resolved profile (e.g. after a core switch).
func (m *Manager) Rebind(r profile.ResolvedProfile) {
	m.mu.Lock()
	defer m.mu.Unlock()
	m.resolved = r
}

func (m *Manager) root() (string, error) {
	m.mu.RLock()
	defer m.mu.RUnlock()
	if !m.resolved.IsConfigured() {
		return "", fmt.Errorf("no active install configured")
	}
	return m.resolved.Root, nil
}

// Browse lists the directory at rel (relative to the install root).
func (m *Manager) Browse(rel string) ([]Entry, error) {
	root, err := m.root()
	if err != nil {
		return nil, err
	}
	dir, err := SafeJoin(root, rel)
	if err != nil {
		return nil, err
	}
	items, err := os.ReadDir(dir)
	if err != nil {
		return nil, err
	}
	out := make([]Entry, 0, len(items))
	for _, it := range items {
		info, err := it.Info()
		if err != nil {
			continue
		}
		childRel := filepath.ToSlash(filepath.Join(rel, it.Name()))
		out = append(out, Entry{
			Name:     it.Name(),
			RelPath:  childRel,
			IsDir:    it.IsDir(),
			Size:     info.Size(),
			Modified: info.ModTime(),
		})
	}
	// Directories first, then alphabetical.
	sort.Slice(out, func(i, j int) bool {
		if out[i].IsDir != out[j].IsDir {
			return out[i].IsDir
		}
		return out[i].Name < out[j].Name
	})
	return out, nil
}

// DiskUsage walks the install tree and totals bytes by top-level area. This can be
// slow on multi-GB map data, so the UI should call it on demand behind a spinner.
func (m *Manager) DiskUsage() (UsageReport, error) {
	root, err := m.root()
	if err != nil {
		return UsageReport{}, err
	}
	top, err := os.ReadDir(root)
	if err != nil {
		return UsageReport{}, err
	}
	report := UsageReport{ScannedAt: time.Now()}
	var rootFiles int64
	for _, it := range top {
		full := filepath.Join(root, it.Name())
		if !it.IsDir() {
			if info, err := it.Info(); err == nil {
				rootFiles += info.Size()
			}
			continue
		}
		size := dirSize(full)
		report.Buckets = append(report.Buckets, UsageBucket{Name: it.Name(), Bytes: size})
		report.Total += size
	}
	if rootFiles > 0 {
		report.Buckets = append(report.Buckets, UsageBucket{Name: "(root files)", Bytes: rootFiles})
		report.Total += rootFiles
	}
	sort.Slice(report.Buckets, func(i, j int) bool {
		return report.Buckets[i].Bytes > report.Buckets[j].Bytes
	})
	return report, nil
}

func dirSize(dir string) int64 {
	var total int64
	_ = filepath.WalkDir(dir, func(_ string, d os.DirEntry, err error) error {
		if err != nil {
			return nil // skip unreadable entries, keep walking
		}
		if !d.IsDir() {
			if info, err := d.Info(); err == nil {
				total += info.Size()
			}
		}
		return nil
	})
	return total
}

// CrashesPreview lists what ClearCrashes would remove, without touching anything.
func (m *Manager) CrashesPreview() (CleanupPreview, error) {
	m.mu.RLock()
	dir := m.resolved.CrashesPath()
	m.mu.RUnlock()
	return previewDir(dir)
}

// ClearCrashes deletes the contents of the Crashes folder (the dir itself is kept).
func (m *Manager) ClearCrashes() (CleanupPreview, error) {
	m.mu.RLock()
	root := m.resolved.Root
	dir := m.resolved.CrashesPath()
	m.mu.RUnlock()
	if root == "" {
		return CleanupPreview{}, fmt.Errorf("no active install configured")
	}
	preview, err := previewDir(dir)
	if err != nil {
		return CleanupPreview{}, err
	}
	entries, err := os.ReadDir(dir)
	if err != nil {
		return CleanupPreview{}, err
	}
	for _, e := range entries {
		_ = os.RemoveAll(filepath.Join(dir, e.Name()))
	}
	return preview, nil
}

func previewDir(dir string) (CleanupPreview, error) {
	var p CleanupPreview
	entries, err := os.ReadDir(dir)
	if err != nil {
		if os.IsNotExist(err) {
			return p, nil
		}
		return p, err
	}
	for _, e := range entries {
		full := filepath.Join(dir, e.Name())
		p.Files = append(p.Files, e.Name())
		if e.IsDir() {
			p.Bytes += dirSize(full)
		} else if info, err := e.Info(); err == nil {
			p.Bytes += info.Size()
		}
	}
	p.Count = len(p.Files)
	return p, nil
}

// BackupFolder zips a subdirectory into _archives and returns the zip's rel path.
func (m *Manager) BackupFolder(rel string) (string, error) {
	root, err := m.root()
	if err != nil {
		return "", err
	}
	src, err := SafeJoin(root, rel)
	if err != nil {
		return "", err
	}
	info, err := os.Stat(src)
	if err != nil {
		return "", err
	}
	if !info.IsDir() {
		return "", fmt.Errorf("%q is not a directory", rel)
	}
	name := fmt.Sprintf("%s-%s.zip", filepath.Base(src), time.Now().Format("20060102-150405"))
	destRel := filepath.ToSlash(filepath.Join(ArchiveDir, name))
	dest := filepath.Join(root, ArchiveDir, name)
	if err := ZipDir(dest, src); err != nil {
		return "", err
	}
	return destRel, nil
}

// Delete removes a single sandboxed file or directory.
func (m *Manager) Delete(rel string) error {
	root, err := m.root()
	if err != nil {
		return err
	}
	target, err := SafeJoin(root, rel)
	if err != nil {
		return err
	}
	if filepath.Clean(target) == filepath.Clean(root) {
		return fmt.Errorf("refusing to delete the install root")
	}
	return os.RemoveAll(target)
}

// OpenInExplorer opens a sandboxed path in Windows Explorer.
func (m *Manager) OpenInExplorer(rel string) error {
	root, err := m.root()
	if err != nil {
		return err
	}
	target, err := SafeJoin(root, rel)
	if err != nil {
		return err
	}
	return exec.Command("explorer", target).Start()
}
