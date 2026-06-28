package files

import (
	"errors"
	"os"
	"path/filepath"
	"strings"
)

// ErrEscape is returned when a requested path would leave the install directory.
var ErrEscape = errors.New("path escapes the install directory")

// SafeJoin resolves a user-supplied relative path against root, guaranteeing the
// result stays inside root. It rejects absolute paths, drive-relative paths,
// ".." traversal, and symlink/junction escapes. This is the single source of
// truth for path safety — every file operation must go through it.
func SafeJoin(root, rel string) (string, error) {
	rootClean := filepath.Clean(root)
	if rel == "" || rel == "." {
		return rootClean, nil
	}
	rel = filepath.FromSlash(rel)
	clean := filepath.Clean(rel)
	if filepath.IsAbs(clean) || filepath.VolumeName(clean) != "" {
		return "", ErrEscape
	}
	abs := filepath.Join(rootClean, clean)
	if !isWithin(rootClean, abs) {
		return "", ErrEscape
	}
	// Defeat symlink/junction escapes when the target already exists.
	if real, err := filepath.EvalSymlinks(abs); err == nil {
		if !isWithin(rootClean, real) {
			return "", ErrEscape
		}
	}
	return abs, nil
}

// isWithin reports whether abs is root or lives beneath it (case-insensitive, Windows-safe).
func isWithin(root, abs string) bool {
	if strings.EqualFold(abs, root) {
		return true
	}
	return strings.HasPrefix(strings.ToLower(abs), strings.ToLower(root)+string(os.PathSeparator))
}
