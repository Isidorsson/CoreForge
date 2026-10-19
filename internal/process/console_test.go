package process

import (
	"testing"
	"time"
)

func TestCleanTerminalLine(t *testing.T) {
	cases := map[string]string{
		"plain text":                              "plain text",
		"line\r":                                  "line",
		"\x1b[?25l\x1b[2J\x1b[m\x1b[Hhello":       "hello",
		"\x1b[1;31mERROR\x1b[0m db down":          "ERROR db down",
		"\x1b]0;C:\\srv\\worldserver.exe\x07TC> ": "TC> ",
		"\x1b]0;title\x1b\\after":                 "after",
		"\abeep\x00":                              "beep",
		"tab\tkept":                               "tab\tkept",
		"utf8 ✓ kept":                             "utf8 ✓ kept",
		"\x1b[38;2;255;0;0mrgb\x1b[39m \x1b[?9001hdone": "rgb done",
	}
	for in, want := range cases {
		if got := cleanTerminalLine(in); got != want {
			t.Errorf("cleanTerminalLine(%q) = %q, want %q", in, got, want)
		}
	}
}

func TestEchoFilterStripsPromptsFromLogLines(t *testing.T) {
	var f echoFilter
	got, keep := f.filter("TC> [NodeGraphLib.Triggers] OnItem registered")
	if !keep || got != "[NodeGraphLib.Triggers] OnItem registered" {
		t.Fatalf("got %q keep=%v", got, keep)
	}
	if _, keep := f.filter("TC> "); keep {
		t.Fatal("a bare prompt line should be dropped")
	}
	if _, keep := f.filter("AC> AC> "); keep {
		t.Fatal("stacked AzerothCore prompts should be dropped")
	}
}

func TestEchoFilterDropsTheConsoleEchoOfASentCommand(t *testing.T) {
	var f echoFilter
	f.expect("server info")

	if _, keep := f.filter("TC> server info"); keep {
		t.Fatal("the console's own echo should be dropped; CoreForge already logged the command")
	}
	got, keep := f.filter("TC> server info")
	if !keep || got != "server info" {
		t.Fatal("only one echo per sent command should be consumed")
	}
}

func TestEchoFilterDropsAnUnpromptedEcho(t *testing.T) {
	var f echoFilter
	f.expect("teleport")
	if _, keep := f.filter("teleport"); keep {
		t.Fatal("the echo lands on a fresh row without a prompt after a burst of log output; it should still be dropped")
	}
}

func TestEchoFilterKeepsMatchingOutputOnceTheEchoWindowPasses(t *testing.T) {
	now := time.Unix(0, 0)
	f := echoFilter{now: func() time.Time { return now }}
	f.expect("saveall")
	now = now.Add(echoWindow + time.Millisecond)
	if got, keep := f.filter("saveall"); !keep || got != "saveall" {
		t.Fatal("a line matching an old command is real output, not its echo")
	}
	if len(f.pending) != 0 {
		t.Fatal("expired echoes should be pruned")
	}
}

func TestEchoFilterBoundsPendingCommands(t *testing.T) {
	var f echoFilter
	for i := 0; i < maxPendingEchoes+5; i++ {
		f.expect("x")
	}
	if len(f.pending) != maxPendingEchoes {
		t.Fatalf("pending = %d, want %d", len(f.pending), maxPendingEchoes)
	}
}

func TestEchoFilterDropsAPromptWithItsSpaceTrimmed(t *testing.T) {
	var f echoFilter
	if _, keep := f.filter("TC>"); keep {
		t.Fatal("a prompt whose trailing space was trimmed should still be dropped")
	}
}

func TestTerminalLineDropsControlOnlyLinesButKeepsBlankOnes(t *testing.T) {
	if _, keep := terminalLine("\x1b[?9001l\x1b[?1004l"); keep {
		t.Fatal("a line of only terminal control codes should be dropped")
	}
	if got, keep := terminalLine("\r"); !keep || got != "" {
		t.Fatal("a blank line the server printed should be kept")
	}
	if got, keep := terminalLine("\x1b[32mok\x1b[0m\r"); !keep || got != "ok" {
		t.Fatalf("got %q keep=%v", got, keep)
	}
}
