package files

import "testing"

func TestSafeJoinAllowsInside(t *testing.T) {
	root := t.TempDir()
	for _, rel := range []string{"", ".", "Crashes", "configs/worldserver.conf", "a/b/c", "lua_scripts"} {
		if _, err := SafeJoin(root, rel); err != nil {
			t.Errorf("SafeJoin(%q) unexpected error: %v", rel, err)
		}
	}
}

func TestSafeJoinRejectsEscape(t *testing.T) {
	root := t.TempDir()
	// Windows-oriented escapes (the app targets Windows): parent traversal,
	// absolute drive paths, and volume-relative paths must all be rejected.
	for _, rel := range []string{"..", "../outside", `..\..\x`, `C:\Windows\System32`, "C:evil"} {
		if _, err := SafeJoin(root, rel); err == nil {
			t.Errorf("SafeJoin(%q) expected ErrEscape, got nil", rel)
		}
	}
}

func TestSafeJoinResultWithinRoot(t *testing.T) {
	root := t.TempDir()
	got, err := SafeJoin(root, "Crashes/dump.txt")
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if !isWithin(root, got) {
		t.Errorf("resolved path %q is not within root %q", got, root)
	}
}
