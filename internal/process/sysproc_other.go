//go:build !windows

package process

import "os/exec"

// configureSysProcAttr is a no-op off Windows (CoreForge targets Windows; this
// keeps the package building for tooling/CI on other platforms).
func configureSysProcAttr(cmd *exec.Cmd) {}
