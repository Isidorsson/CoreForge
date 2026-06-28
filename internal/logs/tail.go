package logs

import (
	"bufio"
	"context"
	"io"
	"os"
	"strings"
	"sync"
	"time"

	"CoreForge/internal/events"
	"CoreForge/internal/profile"
)

const pollInterval = 500 * time.Millisecond

// logPayload is the event payload streamed to the frontend for a log.
type logPayload struct {
	Kind  string   `json:"kind"`
	Lines []string `json:"lines,omitempty"`
	Reset bool     `json:"reset,omitempty"`
}

// tailer follows a single log file by polling its size and emitting new lines.
// Each poll emits at most one batch, which naturally coalesces a startup flood.
type tailer struct {
	kind   profile.LogKind
	path   string
	emit   events.Emitter
	cancel context.CancelFunc

	mu       sync.Mutex
	offset   int64
	leftover string
}

func (t *tailer) run(ctx context.Context) {
	tk := time.NewTicker(pollInterval)
	defer tk.Stop()
	for {
		select {
		case <-ctx.Done():
			return
		case <-tk.C:
			t.poll()
		}
	}
}

func (t *tailer) poll() {
	t.mu.Lock()
	defer t.mu.Unlock()

	info, err := os.Stat(t.path)
	if err != nil {
		return
	}
	size := info.Size()
	if size < t.offset { // truncated/rotated — restart and tell the UI to clear.
		t.offset = 0
		t.leftover = ""
		t.emit.Emit(events.EvtLogLine, logPayload{Kind: string(t.kind), Reset: true})
	}
	if size == t.offset {
		return
	}

	f, err := os.Open(t.path)
	if err != nil {
		return
	}
	defer f.Close()
	if _, err := f.Seek(t.offset, io.SeekStart); err != nil {
		return
	}
	buf := make([]byte, size-t.offset)
	n, _ := io.ReadFull(f, buf)
	t.offset += int64(n)

	chunk := t.leftover + string(buf[:n])
	parts := strings.Split(chunk, "\n")
	t.leftover = parts[len(parts)-1] // trailing partial line, retained for next poll
	complete := parts[:len(parts)-1]
	if len(complete) == 0 {
		return
	}
	out := make([]string, len(complete))
	for i, l := range complete {
		out[i] = strings.TrimSuffix(l, "\r")
	}
	t.emit.Emit(events.EvtLogLine, logPayload{Kind: string(t.kind), Lines: out})
}

// seekEnd positions the tailer at the current end of file (stream only new lines).
func (t *tailer) seekEnd() {
	t.mu.Lock()
	defer t.mu.Unlock()
	if info, err := os.Stat(t.path); err == nil {
		t.offset = info.Size()
	}
}

// reset rewinds the tailer to the start (used after a clear/truncate).
func (t *tailer) reset() {
	t.mu.Lock()
	defer t.mu.Unlock()
	t.offset = 0
	t.leftover = ""
}

// readTail returns the last maxLines lines from the tail of path, scanning at most
// capBytes from the end so a multi-MB log never loads fully into memory.
func readTail(path string, maxLines int, capBytes int64) ([]string, error) {
	f, err := os.Open(path)
	if err != nil {
		if os.IsNotExist(err) {
			return nil, nil
		}
		return nil, err
	}
	defer f.Close()

	info, err := f.Stat()
	if err != nil {
		return nil, err
	}
	start := int64(0)
	if info.Size() > capBytes {
		start = info.Size() - capBytes
	}
	if _, err := f.Seek(start, io.SeekStart); err != nil {
		return nil, err
	}

	sc := bufio.NewScanner(f)
	sc.Buffer(make([]byte, 0, 64*1024), 4*1024*1024)
	var lines []string
	first := true
	for sc.Scan() {
		if first && start > 0 {
			first = false // drop the partial first line produced by mid-file seek
			continue
		}
		first = false
		lines = append(lines, strings.TrimSuffix(sc.Text(), "\r"))
	}
	if maxLines > 0 && len(lines) > maxLines {
		lines = lines[len(lines)-maxLines:]
	}
	return lines, sc.Err()
}
