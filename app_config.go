package main

import (
	"CoreForge/internal/config"
	"CoreForge/internal/events"
)

func (a *App) ListConfigs() ([]config.ConfigFile, error) { return a.Config.List() }

func (a *App) ReadConfig(id string) (string, error) { return a.Config.Read(id) }

// SaveConfig backs up + writes a config, then notifies the UI to refresh.
func (a *App) SaveConfig(id, content string) error {
	if err := a.Config.Save(id, content); err != nil {
		return err
	}
	a.emit.Emit(events.EvtConfigSaved, map[string]string{"id": id})
	return nil
}

func (a *App) SearchConfig(id, query string, useRegex bool) ([]config.Match, error) {
	return a.Config.Search(id, query, useRegex)
}

func (a *App) ListConfigBackups(id string) ([]config.Backup, error) {
	return a.Config.ListBackups(id)
}

func (a *App) RestoreConfig(id, backupName string) error {
	return a.Config.Restore(id, backupName)
}
