package process

import (
	"testing"

	"CoreForge/internal/events"
	"CoreForge/internal/profile"
)

func resolvedAt(root string) profile.ResolvedProfile {
	return profile.ResolvedProfile{
		Profile: profile.Profile{AuthServerExe: "bin/authserver.exe", WorldServerExe: "bin/worldserver.exe"},
		Root:    root,
	}
}

func TestRebindSamePathsKeepsManagedProcs(t *testing.T) {
	m := NewManager(events.Nop{}, 100)
	m.Rebind(resolvedAt(`C:\cores\tc`))
	auth, world := m.procs()

	m.Rebind(resolvedAt(`C:\cores\tc`))
	auth2, world2 := m.procs()

	if auth2 != auth || world2 != world {
		t.Fatal("rebinding with unchanged paths replaced the managed processes, orphaning any running server")
	}
}

func TestRebindChangedRootReplacesManagedProcs(t *testing.T) {
	m := NewManager(events.Nop{}, 100)
	m.Rebind(resolvedAt(`C:\cores\tc`))
	auth, world := m.procs()

	m.Rebind(resolvedAt(`C:\cores\ac`))
	auth2, world2 := m.procs()

	if auth2 == auth || world2 == world {
		t.Fatal("rebinding to a new install root kept the old processes")
	}
	if auth2.exePath != `C:\cores\ac\bin\authserver.exe` {
		t.Fatalf("auth exe = %q", auth2.exePath)
	}
}

func TestSetTailLinesResizesExistingBacklog(t *testing.T) {
	m := NewManager(events.Nop{}, 5)
	m.Rebind(resolvedAt(`C:\cores\tc`))
	auth, _ := m.procs()
	for _, l := range []string{"a", "b", "c", "d", "e"} {
		auth.ring.append(l)
	}

	m.SetTailLines(2)

	got := auth.Backlog()
	if len(got) != 2 || got[0] != "d" || got[1] != "e" {
		t.Fatalf("backlog after shrink = %v, want [d e]", got)
	}
}
