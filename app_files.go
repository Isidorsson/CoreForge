package main

import "CoreForge/internal/files"

func (a *App) BrowseFiles(rel string) ([]files.Entry, error) { return a.Files.Browse(rel) }

func (a *App) DiskUsage() (files.UsageReport, error) { return a.Files.DiskUsage() }

// CrashesPreview lists what ClearCrashes would remove (for a confirm dialog).
func (a *App) CrashesPreview() (files.CleanupPreview, error) { return a.Files.CrashesPreview() }

func (a *App) ClearCrashes() (files.CleanupPreview, error) { return a.Files.ClearCrashes() }

func (a *App) BackupFolder(rel string) (string, error) { return a.Files.BackupFolder(rel) }

func (a *App) DeleteFile(rel string) error { return a.Files.Delete(rel) }

func (a *App) OpenInExplorer(rel string) error { return a.Files.OpenInExplorer(rel) }
