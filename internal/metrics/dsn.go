// Package metrics reads aggregate player/server statistics from the active
// core's MySQL databases (auth + characters) and exposes them to the UI. It is
// strictly read-only: no query mutates data.
package metrics

import (
	"fmt"
	"net"
	"os"
	"regexp"
	"strings"
	"time"

	"github.com/go-sql-driver/mysql"
)

// DBConfig is everything needed to reach the emulator's MySQL server. The three
// databases share one host/user/password on stock installs, so we keep a single
// credential set plus the per-schema names. Pass is never serialized to the UI.
type DBConfig struct {
	Host    string `json:"host"`
	Port    string `json:"port"`
	User    string `json:"user"`
	Pass    string `json:"-"`
	AuthDB  string `json:"authDb"`
	WorldDB string `json:"worldDb"`
	CharDB  string `json:"charDb"`
	Source  string `json:"source"` // "config" | "manual"
}

// dbInfoLine matches the three connection-string directives in worldserver.conf,
// each shaped `Key = "host;port;user;pass;dbname"`.
var dbInfoLine = regexp.MustCompile(`(?mi)^\s*(LoginDatabaseInfo|WorldDatabaseInfo|CharacterDatabaseInfo)\s*=\s*"([^"]*)"`)

// ParseWorldConfig extracts the DB connection from a worldserver.conf body. The
// CharacterDatabaseInfo line supplies the primary credentials; every line
// supplies its own schema name.
func ParseWorldConfig(body string) (DBConfig, error) {
	cfg := DBConfig{Source: "config"}
	for _, m := range dbInfoLine.FindAllStringSubmatch(body, -1) {
		key, parts := strings.ToLower(m[1]), strings.Split(m[2], ";")
		if len(parts) < 5 {
			continue
		}
		host, port := strings.TrimSpace(parts[0]), strings.TrimSpace(parts[1])
		user, pass, db := strings.TrimSpace(parts[2]), parts[3], strings.TrimSpace(parts[4])
		switch key {
		case "logindatabaseinfo":
			cfg.AuthDB = db
		case "worlddatabaseinfo":
			cfg.WorldDB = db
		case "characterdatabaseinfo":
			cfg.CharDB = db
		}
		// Character line is authoritative for creds; otherwise first line seeds them.
		if key == "characterdatabaseinfo" || cfg.Host == "" {
			cfg.Host, cfg.Port, cfg.User, cfg.Pass = host, port, user, pass
		}
	}
	if cfg.Host == "" {
		return DBConfig{}, fmt.Errorf("no *DatabaseInfo lines found in worldserver.conf")
	}
	cfg.Host = normalizeHost(cfg.Host)
	if cfg.Port == "" {
		cfg.Port = "3306"
	}
	return cfg, nil
}

// ParseWorldConfigFile reads and parses a worldserver.conf at path.
func ParseWorldConfigFile(path string) (DBConfig, error) {
	b, err := os.ReadFile(path)
	if err != nil {
		return DBConfig{}, err
	}
	return ParseWorldConfig(string(b))
}

// normalizeHost remaps a docker-internal service name to localhost. CoreForge
// runs on the host, where the DB port is published; a bare service name like
// "ac-database" only resolves inside the compose network. Explicit IPs and FQDNs
// (anything with a dot) are trusted and passed through.
func normalizeHost(host string) string {
	host = strings.TrimSpace(host)
	switch host {
	case "", "localhost", "::1":
		return "127.0.0.1"
	}
	if net.ParseIP(host) != nil {
		return host
	}
	if !strings.Contains(host, ".") {
		return "127.0.0.1"
	}
	return host
}

// DSN builds a properly-escaped go-sql-driver DSN for the given schema.
func (c DBConfig) DSN(schema string) string {
	mc := mysql.NewConfig()
	mc.User = c.User
	mc.Passwd = c.Pass
	mc.Net = "tcp"
	mc.Addr = net.JoinHostPort(c.Host, c.Port)
	mc.DBName = schema
	mc.ParseTime = true
	mc.Timeout = 5 * time.Second
	mc.ReadTimeout = 20 * time.Second
	mc.Params = map[string]string{"charset": "utf8mb4"}
	return mc.FormatDSN()
}

// Valid reports whether the minimum fields to attempt a connection are present.
func (c DBConfig) Valid() bool {
	return c.Host != "" && c.Port != "" && c.User != "" && c.CharDB != ""
}
