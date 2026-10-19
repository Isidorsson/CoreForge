//go:build !windows

package process

import (
	"fmt"
	"io"
	"os"
	"os/exec"
)

// pipeConsole runs a server on plain pipes. CoreForge targets Windows; this keeps
// the package building and testable on other platforms.
type pipeConsole struct {
	cmd *exec.Cmd
	in  io.WriteCloser
	out *os.File
}

func startConsole(exe, workDir string) (console, error) {
	outR, outW, err := os.Pipe()
	if err != nil {
		return nil, fmt.Errorf("console output pipe: %w", err)
	}
	cmd := exec.Command(exe)
	cmd.Dir = workDir
	cmd.Stdout, cmd.Stderr = outW, outW
	configureSysProcAttr(cmd)
	in, err := cmd.StdinPipe()
	if err != nil {
		_ = outR.Close()
		_ = outW.Close()
		return nil, err
	}
	err = cmd.Start()
	_ = outW.Close()
	if err != nil {
		_ = outR.Close()
		return nil, fmt.Errorf("failed to start %s: %w", exe, err)
	}
	return &pipeConsole{cmd: cmd, in: in, out: outR}, nil
}

func (c *pipeConsole) Output() io.ReadCloser { return c.out }
func (c *pipeConsole) Input() io.Writer      { return c.in }
func (c *pipeConsole) Pid() int              { return c.cmd.Process.Pid }
func (c *pipeConsole) Interrupt() error      { return c.cmd.Process.Signal(os.Interrupt) }
func (c *pipeConsole) Wait() error           { return c.cmd.Wait() }
func (c *pipeConsole) Close() error          { return c.in.Close() }
