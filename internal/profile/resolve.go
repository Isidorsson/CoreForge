package profile

import (
	"fmt"
	"os"
	"path/filepath"
	"strings"
)

// ResolvedProfile is a Profile bound to a concrete install directory. It is the
// type the managers consume; all path helpers return absolute paths inside Root.
type ResolvedProfile struct {
	Profile
	Root string `json:"root"`

	// dockerComposeAbs, when set, overrides the profile's relative compose path
	// (used when an install's DB lives outside its own tree, e.g. AC sharing TC's).
	dockerComposeAbs string
}

// Resolve binds a profile template to an install root, validating it exists.
func (p Profile) Resolve(root string) (ResolvedProfile, error) {
	if strings.TrimSpace(root) == "" {
		return ResolvedProfile{}, fmt.Errorf("install directory is not set")
	}
	abs, err := filepath.Abs(root)
	if err != nil {
		return ResolvedProfile{}, err
	}
	abs = filepath.Clean(abs)
	info, err := os.Stat(abs)
	if err != nil {
		return ResolvedProfile{}, fmt.Errorf("install directory %q is not accessible: %w", abs, err)
	}
	if !info.IsDir() {
		return ResolvedProfile{}, fmt.Errorf("install path %q is not a directory", abs)
	}
	return ResolvedProfile{Profile: p, Root: abs}, nil
}

// ApplyDockerOverrides folds per-install Settings overrides into the resolved profile.
func (r *ResolvedProfile) ApplyDockerOverrides(composeAbs, container string) {
	if strings.TrimSpace(composeAbs) != "" {
		r.dockerComposeAbs = filepath.Clean(composeAbs)
	}
	if strings.TrimSpace(container) != "" {
		r.DockerContainer = container
	}
}

func (r ResolvedProfile) join(rel string) string {
	return filepath.Join(r.Root, filepath.FromSlash(rel))
}

func (r ResolvedProfile) AuthServerPath() string  { return r.join(r.AuthServerExe) }
func (r ResolvedProfile) WorldServerPath() string { return r.join(r.WorldServerExe) }
func (r ResolvedProfile) AuthConfigPath() string  { return r.join(r.AuthConfigRel) }
func (r ResolvedProfile) WorldConfigPath() string { return r.join(r.WorldConfigRel) }
func (r ResolvedProfile) ConfigDirPath() string   { return r.join(r.ConfigDirRel) }
func (r ResolvedProfile) CrashesPath() string     { return r.join(r.CrashesDir) }
func (r ResolvedProfile) LuaScriptsPath() string  { return r.join(r.LuaScriptsDir) }

// ModuleConfigPath returns the absolute module-config dir, or "" if the core has none.
func (r ResolvedProfile) ModuleConfigPath() string {
	if r.ModuleConfigDir == "" {
		return ""
	}
	return r.join(r.ModuleConfigDir)
}

// LogPath returns the absolute path for a log kind, and whether the core defines it.
func (r ResolvedProfile) LogPath(k LogKind) (string, bool) {
	lf, ok := r.Logs[k]
	if !ok {
		return "", false
	}
	return r.join(lf.RelPath), true
}

// DockerComposePath returns the absolute compose-file path, or "" if not configured.
func (r ResolvedProfile) DockerComposePath() string {
	if r.dockerComposeAbs != "" {
		return r.dockerComposeAbs
	}
	if r.DockerComposeRel == "" {
		return ""
	}
	return r.join(r.DockerComposeRel)
}

// Within reports whether abs lies inside the install root (case-insensitive, Windows).
func (r ResolvedProfile) Within(abs string) bool {
	root := filepath.Clean(r.Root)
	target := filepath.Clean(abs)
	if strings.EqualFold(target, root) {
		return true
	}
	return strings.HasPrefix(strings.ToLower(target), strings.ToLower(root)+string(os.PathSeparator))
}

// IsConfigured reports whether the profile is bound to a real install root.
func (r ResolvedProfile) IsConfigured() bool { return r.Root != "" }
