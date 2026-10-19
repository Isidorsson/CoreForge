//go:build windows

package process

import (
	"fmt"
	"io"
	"os"
	"sync"
	"unsafe"

	"golang.org/x/sys/windows"
)

// Pseudo console size. Wide so long log lines are not wrapped onto several rows;
// tall so a burst of output between renders does not scroll lines out unseen.
const (
	ptyCols = 1024
	ptyRows = 1000
)

var setConsoleCtrlHandler = windows.NewLazySystemDLL("kernel32.dll").NewProc("SetConsoleCtrlHandler")

// enableCtrlC clears the "ignore Ctrl+C" flag on CoreForge's own process. Children
// inherit that flag, and it is set whenever an ancestor was started in a new
// process group; left set, the Ctrl+C sent for a graceful stop is silently ignored.
var enableCtrlC = sync.OnceFunc(func() {
	// Best effort: if it fails, a stop falls back to the kill after the grace period.
	_, _, _ = setConsoleCtrlHandler.Call(0, 0)
})

type conPTY struct {
	hpc     windows.Handle
	in      *os.File
	out     *os.File
	process windows.Handle
	pid     int
	close   sync.Once
}

// startConsole launches exe in workDir attached to a new pseudo console.
func startConsole(exe, workDir string) (console, error) {
	var inR, inW, outR, outW windows.Handle
	if err := windows.CreatePipe(&inR, &inW, nil, 0); err != nil {
		return nil, fmt.Errorf("console input pipe: %w", err)
	}
	if err := windows.CreatePipe(&outR, &outW, nil, 0); err != nil {
		closeHandles(inR, inW)
		return nil, fmt.Errorf("console output pipe: %w", err)
	}
	var hpc windows.Handle
	err := windows.CreatePseudoConsole(windows.Coord{X: ptyCols, Y: ptyRows}, inR, outW, 0, &hpc)
	// The pseudo console keeps its own references to its ends of the pipes.
	closeHandles(inR, outW)
	if err != nil {
		closeHandles(inW, outR)
		return nil, fmt.Errorf("create pseudo console: %w", err)
	}

	pi, err := spawnAttached(hpc, exe, workDir)
	if err != nil {
		windows.ClosePseudoConsole(hpc)
		closeHandles(inW, outR)
		return nil, err
	}
	_ = windows.CloseHandle(pi.Thread)
	return &conPTY{
		hpc:     hpc,
		in:      os.NewFile(uintptr(inW), "conpty-in"),
		out:     os.NewFile(uintptr(outR), "conpty-out"),
		process: pi.Process,
		pid:     int(pi.ProcessId),
	}, nil
}

func spawnAttached(hpc windows.Handle, exe, workDir string) (*windows.ProcessInformation, error) {
	enableCtrlC()
	attrs, err := windows.NewProcThreadAttributeList(1)
	if err != nil {
		return nil, fmt.Errorf("attribute list: %w", err)
	}
	defer attrs.Delete()
	// The attribute value is the HPCON itself, not a pointer to it.
	if err := attrs.Update(windows.PROC_THREAD_ATTRIBUTE_PSEUDOCONSOLE, *(*unsafe.Pointer)(unsafe.Pointer(&hpc)), unsafe.Sizeof(hpc)); err != nil {
		return nil, fmt.Errorf("attach pseudo console: %w", err)
	}

	si := windows.StartupInfoEx{ProcThreadAttributeList: attrs.List()}
	si.Cb = uint32(unsafe.Sizeof(si))
	// Without this the child inherits CoreForge's own std handles (when it has any)
	// and writes there instead of to the pseudo console.
	si.Flags = windows.STARTF_USESTDHANDLES

	cmdLine, err := windows.UTF16PtrFromString(windows.EscapeArg(exe))
	if err != nil {
		return nil, err
	}
	dir, err := windows.UTF16PtrFromString(workDir)
	if err != nil {
		return nil, err
	}
	var pi windows.ProcessInformation
	if err := windows.CreateProcess(nil, cmdLine, nil, nil, false, windows.EXTENDED_STARTUPINFO_PRESENT, nil, dir, &si.StartupInfo, &pi); err != nil {
		return nil, fmt.Errorf("failed to start %s: %w", exe, err)
	}
	return &pi, nil
}

func (c *conPTY) Output() io.ReadCloser { return c.out }
func (c *conPTY) Input() io.Writer      { return c.in }
func (c *conPTY) Pid() int              { return c.pid }

func (c *conPTY) Interrupt() error {
	_, err := c.in.Write([]byte{0x03})
	return err
}

func (c *conPTY) Wait() error {
	if _, err := windows.WaitForSingleObject(c.process, windows.INFINITE); err != nil {
		return fmt.Errorf("wait for process: %w", err)
	}
	var code uint32
	if err := windows.GetExitCodeProcess(c.process, &code); err != nil {
		return fmt.Errorf("exit code: %w", err)
	}
	if code != 0 {
		return fmt.Errorf("exit status %d", code)
	}
	return nil
}

func (c *conPTY) Close() error {
	c.close.Do(func() {
		// Output must keep being read while this runs: closing flushes the final
		// frame, and the console blocks until it is written.
		windows.ClosePseudoConsole(c.hpc)
		_ = c.in.Close()
		_ = windows.CloseHandle(c.process)
	})
	return nil
}

func closeHandles(hs ...windows.Handle) {
	for _, h := range hs {
		_ = windows.CloseHandle(h)
	}
}
