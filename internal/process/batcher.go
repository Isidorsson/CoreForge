package process

import (
	"sync"
	"time"
)

// lineBatcher coalesces appended lines and flushes them on an interval, so the
// thousands of lines worldserver emits at startup become a handful of events
// instead of flooding the frontend one EventsEmit per line.
type lineBatcher struct {
	mu    sync.Mutex
	buf   []string
	timer *time.Timer
	delay time.Duration
	flush func([]string)
}

func newLineBatcher(delay time.Duration, flush func([]string)) *lineBatcher {
	return &lineBatcher{delay: delay, flush: flush}
}

func (b *lineBatcher) add(line string) {
	b.mu.Lock()
	b.buf = append(b.buf, line)
	if b.timer == nil {
		b.timer = time.AfterFunc(b.delay, b.fire)
	}
	b.mu.Unlock()
}

func (b *lineBatcher) fire() {
	b.mu.Lock()
	lines := b.buf
	b.buf = nil
	b.timer = nil
	b.mu.Unlock()
	if len(lines) > 0 {
		b.flush(lines)
	}
}

// flushNow drains any buffered lines immediately (used when a process exits).
func (b *lineBatcher) flushNow() {
	b.mu.Lock()
	if b.timer != nil {
		b.timer.Stop()
		b.timer = nil
	}
	lines := b.buf
	b.buf = nil
	b.mu.Unlock()
	if len(lines) > 0 {
		b.flush(lines)
	}
}
