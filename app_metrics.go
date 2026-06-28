package main

import (
	"strings"

	"CoreForge/internal/events"
	"CoreForge/internal/metrics"
	"CoreForge/internal/settings"
)

// MetricsDBInfo is the password-stripped view of the effective DB config, so the
// UI can show where metrics are read from without exposing the credential.
type MetricsDBInfo struct {
	Host    string `json:"host"`
	Port    string `json:"port"`
	User    string `json:"user"`
	AuthDB  string `json:"authDb"`
	WorldDB string `json:"worldDb"`
	CharDB  string `json:"charDb"`
	Source  string `json:"source"`  // "config" | "manual"
	HasPass bool   `json:"hasPass"` // whether a password is set
}

// GetServerMetrics returns a full metrics snapshot from the active core's DB.
func (a *App) GetServerMetrics() (metrics.Metrics, error) {
	return a.Metrics.Snapshot(a.ctx)
}

// GetMetricsDBInfo returns the effective DB config (password stripped).
func (a *App) GetMetricsDBInfo() (MetricsDBInfo, error) {
	cfg, err := a.Metrics.Config()
	if err != nil {
		return MetricsDBInfo{}, err
	}
	return MetricsDBInfo{
		Host:    cfg.Host,
		Port:    cfg.Port,
		User:    cfg.User,
		AuthDB:  cfg.AuthDB,
		WorldDB: cfg.WorldDB,
		CharDB:  cfg.CharDB,
		Source:  cfg.Source,
		HasPass: cfg.Pass != "",
	}, nil
}

// TestMetricsConnection pings the effective DB config, returning its info on success.
func (a *App) TestMetricsConnection() (MetricsDBInfo, error) {
	if err := a.Metrics.Ping(a.ctx); err != nil {
		return MetricsDBInfo{}, err
	}
	return a.GetMetricsDBInfo()
}

// SetMetricsDBOverride stores manual DB credentials. An all-blank value clears
// the override and reverts to auto-discovery from worldserver.conf.
func (a *App) SetMetricsDBOverride(in settings.MetricsDBOverride) error {
	blank := strings.TrimSpace(in.Host+in.Port+in.User+in.Pass+in.AuthDB+in.WorldDB+in.CharDB) == ""
	var ov *settings.MetricsDBOverride
	if !blank {
		ov = &in
	}
	if err := a.store.Update(func(s *settings.Settings) { s.MetricsDB = ov }); err != nil {
		return err
	}
	a.applyMetricsOverride()
	a.emit.Emit(events.EvtStateChanged)
	return nil
}

// applyMetricsOverride pushes the stored manual override (if any) into the manager.
func (a *App) applyMetricsOverride() {
	o := a.store.Get().MetricsDB
	if o == nil {
		a.Metrics.SetOverride(nil)
		return
	}
	a.Metrics.SetOverride(&metrics.DBConfig{
		Host:    o.Host,
		Port:    o.Port,
		User:    o.User,
		Pass:    o.Pass,
		AuthDB:  o.AuthDB,
		WorldDB: o.WorldDB,
		CharDB:  o.CharDB,
		Source:  "manual",
	})
}
