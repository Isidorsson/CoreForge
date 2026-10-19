package process

import (
	"io"
	"regexp"
	"strings"
	"sync"
	"time"
)

// console is a running server attached to a terminal CoreForge controls. On
// Windows that is a pseudo console (ConPTY): TrinityCore reads commands with
// ReadConsoleW and prints replies with WriteConsoleW, which both fail on pipes.
type console interface {
	// Output streams the terminal's output. The reader owns it and closes it once
	// drained; it reaches EOF only after Close.
	Output() io.ReadCloser
	Input() io.Writer
	Pid() int
	// Interrupt delivers Ctrl+C, which TrinityCore/AzerothCore treat as a clean
	// shutdown (players are saved and kicked).
	Interrupt() error
	// Wait blocks until the process exits; a non-zero exit code is an error.
	Wait() error
	// Close releases the terminal so Output drains and reaches EOF. A terminal does
	// not end on its own when the process exits, so call it after Wait.
	Close() error
}

// commandEchoMarker prefixes backlog lines that record a command sent from
// CoreForge, so the UI can style them apart from server output. It is a control
// character, which cleanTerminalLine strips from real output, so it never collides.
// The frontend mirrors this value in ConsolePane.
const commandEchoMarker = "\x1e"

// Terminal escape sequences: CSI (colors, cursor moves, modes), OSC (window
// title) and the remaining two-byte ESC forms.
var escapeSeq = regexp.MustCompile(`\x1b\[[0-?]*[ -/]*[@-~]|\x1b\][^\x07\x1b]*(?:\x07|\x1b\\)|\x1b[@-Z\\-_]`)

// cleanTerminalLine turns one line of terminal output into plain text: escape
// sequences and control characters (except tab) are removed.
func cleanTerminalLine(s string) string {
	s = escapeSeq.ReplaceAllString(s, "")
	return strings.Map(func(r rune) rune {
		if r == '\t' || (r >= 0x20 && r != 0x7f) {
			return r
		}
		return -1
	}, s)
}

// terminalLine cleans one raw output line. It drops lines that held only
// terminal control codes (the console emits some on lines of their own), while
// keeping blank lines the server itself printed.
func terminalLine(raw string) (string, bool) {
	text := cleanTerminalLine(raw)
	if text == "" && strings.TrimRight(raw, "\r") != "" {
		return "", false
	}
	return text, true
}

// cliPrompts are the console prompts the cores print while waiting for input.
// Log lines written while a prompt is showing land on the same row as it.
var cliPrompts = []string{"TC> ", "AC> "}

const (
	maxPendingEchoes = 8
	// echoWindow bounds how long after sending a matching line counts as the
	// console's echo rather than real output.
	echoWindow = 2 * time.Second
)

// echoFilter strips console prompts from output and drops the console's own echo
// of commands CoreForge sent (CoreForge records its own echo line instead).
type echoFilter struct {
	mu      sync.Mutex
	pending []pendingEcho
	now     func() time.Time // nil means time.Now; tests inject a clock
}

type pendingEcho struct {
	cmd    string
	sentAt time.Time
}

func (f *echoFilter) clock() time.Time {
	if f.now == nil {
		return time.Now()
	}
	return f.now()
}

// expect registers a sent command whose console echo should be dropped.
func (f *echoFilter) expect(cmd string) {
	f.mu.Lock()
	defer f.mu.Unlock()
	f.pending = append(f.pending, pendingEcho{cmd: cmd, sentAt: f.clock()})
	if len(f.pending) > maxPendingEchoes {
		f.pending = f.pending[len(f.pending)-maxPendingEchoes:]
	}
}

// filter returns the line to keep, or false when it is a bare prompt or an echo.
// The echo may or may not follow a prompt: after a burst of log output the cursor
// sits on a fresh row, so the typed command appears there without one.
func (f *echoFilter) filter(line string) (string, bool) {
	text, prompted := stripPrompts(line)
	if text == "" && prompted {
		return "", false
	}
	f.mu.Lock()
	defer f.mu.Unlock()
	now := f.clock()
	for len(f.pending) > 0 && now.Sub(f.pending[0].sentAt) > echoWindow {
		f.pending = f.pending[1:]
	}
	if len(f.pending) > 0 && f.pending[0].cmd == text {
		f.pending = f.pending[1:]
		return "", false
	}
	return text, true
}

func stripPrompts(line string) (string, bool) {
	prompted := false
	for {
		trimmed := false
		for _, p := range cliPrompts {
			if rest, ok := strings.CutPrefix(line, p); ok {
				line, prompted, trimmed = rest, true, true
			}
		}
		if !trimmed {
			break
		}
	}
	// The terminal may trim the prompt's trailing space at the end of a row.
	for _, p := range cliPrompts {
		if line == strings.TrimSpace(p) {
			return "", true
		}
	}
	return line, prompted
}
