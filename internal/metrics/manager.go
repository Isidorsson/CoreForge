package metrics

import (
	"context"
	"database/sql"
	"fmt"
	"sync"
	"time"

	"CoreForge/internal/profile"

	_ "github.com/go-sql-driver/mysql"
)

// Manager owns a lazily-opened, pooled, read-only connection to the active
// core's MySQL server and exposes the aggregate queries the metrics page needs.
type Manager struct {
	mu       sync.Mutex
	resolved profile.ResolvedProfile
	override *DBConfig // manual creds from Settings, when set

	db      *sql.DB
	openKey string // DSN the current pool was opened with (cache key)
}

func NewManager() *Manager { return &Manager{} }

// Rebind points the manager at a new install and drops any stale pool.
func (m *Manager) Rebind(r profile.ResolvedProfile) {
	m.mu.Lock()
	defer m.mu.Unlock()
	m.resolved = r
	m.closePool()
}

// SetOverride installs manual DB credentials (nil clears them).
func (m *Manager) SetOverride(c *DBConfig) {
	m.mu.Lock()
	defer m.mu.Unlock()
	m.override = c
	m.closePool()
}

// closePool drops the current pool. Caller holds the lock.
func (m *Manager) closePool() {
	if m.db != nil {
		_ = m.db.Close()
		m.db = nil
		m.openKey = ""
	}
}

// Config resolves the effective DB config: a valid manual override wins,
// otherwise the active core's worldserver.conf is parsed.
func (m *Manager) Config() (DBConfig, error) {
	m.mu.Lock()
	override, r := m.override, m.resolved
	m.mu.Unlock()
	if override != nil && override.Valid() {
		return *override, nil
	}
	if !r.IsConfigured() {
		return DBConfig{}, fmt.Errorf("no active install configured")
	}
	return ParseWorldConfigFile(r.WorldConfigPath())
}

// pool returns a ready *sql.DB for the effective config, (re)opening as needed.
func (m *Manager) pool() (*sql.DB, DBConfig, error) {
	cfg, err := m.Config()
	if err != nil {
		return nil, DBConfig{}, err
	}
	if !cfg.Valid() {
		return nil, cfg, fmt.Errorf("incomplete database configuration — set credentials in Settings")
	}
	key := cfg.DSN(cfg.CharDB)

	m.mu.Lock()
	defer m.mu.Unlock()
	if m.db != nil && m.openKey == key {
		return m.db, cfg, nil
	}
	m.closePool()
	db, err := sql.Open("mysql", key)
	if err != nil {
		return nil, cfg, err
	}
	db.SetMaxOpenConns(4)
	db.SetMaxIdleConns(2)
	db.SetConnMaxLifetime(5 * time.Minute)
	m.db, m.openKey = db, key
	return db, cfg, nil
}

// Ping verifies the DB is reachable with the effective config.
func (m *Manager) Ping(ctx context.Context) error {
	db, _, err := m.pool()
	if err != nil {
		return err
	}
	cctx, cancel := context.WithTimeout(ctx, 6*time.Second)
	defer cancel()
	return db.PingContext(cctx)
}
