package process

import "sync"

// ringBuffer holds the most recent N output lines of a process so the UI can
// fetch a backlog when it (re)mounts the console pane.
type ringBuffer struct {
	mu    sync.Mutex
	lines []string
	max   int
}

func newRingBuffer(max int) *ringBuffer {
	if max <= 0 {
		max = 500
	}
	return &ringBuffer{max: max}
}

func (r *ringBuffer) append(line string) {
	r.mu.Lock()
	defer r.mu.Unlock()
	r.lines = append(r.lines, line)
	if len(r.lines) > r.max {
		r.lines = append([]string(nil), r.lines[len(r.lines)-r.max:]...)
	}
}

// resize changes the capacity, keeping the newest lines when shrinking.
func (r *ringBuffer) resize(max int) {
	if max <= 0 {
		return
	}
	r.mu.Lock()
	defer r.mu.Unlock()
	r.max = max
	if len(r.lines) > max {
		r.lines = append([]string(nil), r.lines[len(r.lines)-max:]...)
	}
}

func (r *ringBuffer) snapshot() []string {
	r.mu.Lock()
	defer r.mu.Unlock()
	out := make([]string, len(r.lines))
	copy(out, r.lines)
	return out
}

func (r *ringBuffer) clear() {
	r.mu.Lock()
	r.lines = nil
	r.mu.Unlock()
}
