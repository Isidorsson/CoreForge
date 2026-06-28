package main

import "CoreForge/internal/logs"

func (a *App) ListLogs() []logs.LogEntry { return a.Logs.List() }

func (a *App) ReadLog(kind string) ([]string, error) { return a.Logs.Read(kind) }

func (a *App) StartLogTail(kind string) error { return a.Logs.StartTail(kind) }
func (a *App) StopLogTail(kind string) error  { return a.Logs.StopTail(kind) }

func (a *App) ClearLog(kind string) error { return a.Logs.Clear(kind) }

// ArchiveLogs zips the named logs (or all archivable logs when kinds is empty)
// and returns the archive path relative to the install root.
func (a *App) ArchiveLogs(kinds []string) (string, error) {
	if len(kinds) == 0 {
		return a.Logs.ArchiveAll()
	}
	return a.Logs.Archive(kinds)
}
