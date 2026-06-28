package metrics

import (
	"context"
	"database/sql"
	"fmt"
	"regexp"
	"sort"
	"time"
)

// Metrics is the full snapshot the metrics page renders in one round-trip.
type Metrics struct {
	Overview    Overview    `json:"overview"`
	Races       []Slice     `json:"races"`
	Classes     []Slice     `json:"classes"`
	Factions    []Slice     `json:"factions"`
	Genders     []Slice     `json:"genders"`
	Levels      []Bucket    `json:"levels"`
	Economy     Economy     `json:"economy"`
	TopPlaytime []CharRow   `json:"topPlaytime"`
	TopLevel    []CharRow   `json:"topLevel"`
	TopGuilds   []GuildRow  `json:"topGuilds"`
	Signups     []TimePoint `json:"signups"`
	GeneratedAt time.Time   `json:"generatedAt"`
}

// Overview holds the headline KPI numbers.
type Overview struct {
	Accounts       int64   `json:"accounts"`
	ActiveAccounts int64   `json:"activeAccounts"` // logged in within 30 days
	Characters     int64   `json:"characters"`
	OnlineNow      int64   `json:"onlineNow"`
	Guilds         int64   `json:"guilds"`
	BannedAccounts int64   `json:"bannedAccounts"`
	MaxLevelChars  int64   `json:"maxLevelChars"`
	AvgLevel       float64 `json:"avgLevel"`
}

// Slice is one wedge/bar in a categorical chart.
type Slice struct {
	Key   string `json:"key"`
	Label string `json:"label"`
	Count int64  `json:"count"`
}

// Bucket is one column in the level histogram.
type Bucket struct {
	Label string `json:"label"`
	Min   int    `json:"min"`
	Max   int    `json:"max"`
	Count int64  `json:"count"`
}

// Economy summarizes the gold supply across living characters.
type Economy struct {
	TotalCopper int64     `json:"totalCopper"`
	AvgGold     float64   `json:"avgGold"`
	Richest     []CharRow `json:"richest"`
}

// CharRow is a leaderboard entry; Value is the metric the board is ranked on
// (playtime seconds, gold copper, or level depending on the board).
type CharRow struct {
	Name  string `json:"name"`
	Race  string `json:"race"`
	Class string `json:"class"`
	Level int    `json:"level"`
	Value int64  `json:"value"`
}

// GuildRow is a guild-leaderboard entry.
type GuildRow struct {
	Name    string `json:"name"`
	Members int64  `json:"members"`
	Leader  string `json:"leader"`
}

// TimePoint is one day in the signups time series.
type TimePoint struct {
	Date  string `json:"date"`
	Count int64  `json:"count"`
}

// ── YOUR CALL ───────────────────────────────────────────────────────────────
// levelBrackets defines the buckets for the level-distribution histogram. The
// defaults below suit a WotLK (level-cap 80) realm with expansion-aligned bands.
// Tune them for YOUR server: a Classic 1–60 realm, a custom 1–255 realm, or
// plain 10-level steps each want different boundaries. Each entry is
// {label, minLevel, maxLevel}, inclusive; levels matching no bracket roll up
// into an "Other" column automatically.
var levelBrackets = []struct {
	label    string
	min, max int
}{
	{"1–9", 1, 9},
	{"10–19", 10, 19},
	{"20–29", 20, 29},
	{"30–39", 30, 39},
	{"40–49", 40, 49},
	{"50–59", 50, 59},
	{"60", 60, 60},
	{"61–69", 61, 69},
	{"70", 70, 70},
	{"71–79", 71, 79},
	{"80", 80, 80},
}

// Snapshot runs every metric query. The characters overview must succeed (it
// proves the connection and core schema); every other section is best-effort so
// one odd table on a custom DB can't blank the whole page.
func (m *Manager) Snapshot(ctx context.Context) (Metrics, error) {
	db, cfg, err := m.pool()
	if err != nil {
		return Metrics{}, err
	}
	cctx, cancel := context.WithTimeout(ctx, 25*time.Second)
	defer cancel()
	char, auth := ident(cfg.CharDB), ident(cfg.AuthDB)

	out := Metrics{GeneratedAt: time.Now()}
	if out.Overview, err = overview(cctx, db, char, auth); err != nil {
		return Metrics{}, err
	}

	races, _ := groupCount(cctx, db, grp(char, "race"))
	classes, _ := groupCount(cctx, db, grp(char, "class"))
	genders, _ := groupCount(cctx, db, grp(char, "gender"))
	levels, _ := groupCount(cctx, db, grp(char, "level"))
	out.Races = mapToSlices(races, raceName)
	out.Classes = mapToSlices(classes, className)
	out.Genders = mapToSlices(genders, genderName)
	out.Factions = factionsFromRaces(races)
	out.Levels = bucketLevels(levels)

	out.Economy, _ = economy(cctx, db, char)
	out.TopPlaytime, _ = charRows(cctx, db, topQuery(char, "totaltime"))
	out.TopLevel, _ = charRows(cctx, db, topLevelQuery(char))
	out.TopGuilds, _ = guildRows(cctx, db, char)
	if auth != "" {
		out.Signups, _ = signups(cctx, db, auth)
	}
	return out, nil
}

func overview(ctx context.Context, db *sql.DB, char, auth string) (Overview, error) {
	var o Overview
	q := fmt.Sprintf(`SELECT
		(SELECT COUNT(*) FROM %[1]s.characters WHERE deleteDate IS NULL OR deleteDate=0),
		(SELECT COUNT(*) FROM %[1]s.characters WHERE online=1),
		(SELECT COUNT(*) FROM %[1]s.guild),
		(SELECT COALESCE(AVG(level),0) FROM %[1]s.characters WHERE deleteDate IS NULL OR deleteDate=0),
		(SELECT COUNT(*) FROM %[1]s.characters WHERE (deleteDate IS NULL OR deleteDate=0)
			AND level=(SELECT MAX(level) FROM %[1]s.characters))`, char)
	if err := db.QueryRowContext(ctx, q).Scan(
		&o.Characters, &o.OnlineNow, &o.Guilds, &o.AvgLevel, &o.MaxLevelChars); err != nil {
		return o, err
	}
	if auth != "" { // auth schema is best-effort — custom splits may differ
		_ = db.QueryRowContext(ctx, fmt.Sprintf("SELECT COUNT(*) FROM %s.account", auth)).Scan(&o.Accounts)
		_ = db.QueryRowContext(ctx, fmt.Sprintf(
			"SELECT COUNT(*) FROM %s.account WHERE last_login > NOW() - INTERVAL 30 DAY", auth)).Scan(&o.ActiveAccounts)
		_ = db.QueryRowContext(ctx, fmt.Sprintf(
			"SELECT COUNT(DISTINCT id) FROM %s.account_banned WHERE active=1", auth)).Scan(&o.BannedAccounts)
	}
	return o, nil
}

func economy(ctx context.Context, db *sql.DB, char string) (Economy, error) {
	var e Economy
	var total sql.NullInt64
	var avg sql.NullFloat64
	q := fmt.Sprintf("SELECT COALESCE(SUM(money),0), COALESCE(AVG(money),0) FROM %s.characters WHERE deleteDate IS NULL OR deleteDate=0", char)
	if err := db.QueryRowContext(ctx, q).Scan(&total, &avg); err != nil {
		return e, err
	}
	e.TotalCopper = total.Int64
	e.AvgGold = avg.Float64 / 10000.0
	e.Richest, _ = charRows(ctx, db, fmt.Sprintf(
		"SELECT name, race, class, level, money FROM %s.characters WHERE deleteDate IS NULL OR deleteDate=0 ORDER BY money DESC LIMIT 10", char))
	return e, nil
}

func guildRows(ctx context.Context, db *sql.DB, char string) ([]GuildRow, error) {
	q := fmt.Sprintf(`SELECT g.name, COUNT(gm.guid) AS members, COALESCE(lc.name,'')
		FROM %[1]s.guild g
		LEFT JOIN %[1]s.guild_member gm ON gm.guildid = g.guildid
		LEFT JOIN %[1]s.characters lc ON lc.guid = g.leaderguid
		GROUP BY g.guildid, g.name, lc.name
		ORDER BY members DESC LIMIT 10`, char)
	rows, err := db.QueryContext(ctx, q)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	out := []GuildRow{}
	for rows.Next() {
		var g GuildRow
		if err := rows.Scan(&g.Name, &g.Members, &g.Leader); err != nil {
			return nil, err
		}
		out = append(out, g)
	}
	return out, rows.Err()
}

func signups(ctx context.Context, db *sql.DB, auth string) ([]TimePoint, error) {
	q := fmt.Sprintf(`SELECT DATE_FORMAT(joindate,'%%Y-%%m-%%d') d, COUNT(*)
		FROM %s.account WHERE joindate > NOW() - INTERVAL 30 DAY
		GROUP BY d ORDER BY d`, auth)
	rows, err := db.QueryContext(ctx, q)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	out := []TimePoint{}
	for rows.Next() {
		var t TimePoint
		if err := rows.Scan(&t.Date, &t.Count); err != nil {
			return nil, err
		}
		out = append(out, t)
	}
	return out, rows.Err()
}

/* ------------------------------- helpers ---------------------------------- */

var identRe = regexp.MustCompile(`[^a-zA-Z0-9_]`)

// ident strips a schema name to identifier-safe chars; schema names come from a
// config file and can't be passed as query parameters, so they are sanitized.
func ident(s string) string { return identRe.ReplaceAllString(s, "") }

func grp(char, col string) string {
	return fmt.Sprintf("SELECT %[2]s, COUNT(*) FROM %[1]s.characters WHERE deleteDate IS NULL OR deleteDate=0 GROUP BY %[2]s", char, col)
}

func topQuery(char, col string) string {
	return fmt.Sprintf("SELECT name, race, class, level, %[2]s FROM %[1]s.characters WHERE deleteDate IS NULL OR deleteDate=0 ORDER BY %[2]s DESC LIMIT 10", char, col)
}

func topLevelQuery(char string) string {
	return fmt.Sprintf("SELECT name, race, class, level, level FROM %s.characters WHERE deleteDate IS NULL OR deleteDate=0 ORDER BY level DESC, totaltime DESC LIMIT 10", char)
}

func groupCount(ctx context.Context, db *sql.DB, query string) (map[int]int64, error) {
	rows, err := db.QueryContext(ctx, query)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	out := map[int]int64{}
	for rows.Next() {
		var id int
		var n int64
		if err := rows.Scan(&id, &n); err != nil {
			return nil, err
		}
		out[id] = n
	}
	return out, rows.Err()
}

func charRows(ctx context.Context, db *sql.DB, query string) ([]CharRow, error) {
	rows, err := db.QueryContext(ctx, query)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	out := []CharRow{}
	for rows.Next() {
		var r CharRow
		var race, class int
		if err := rows.Scan(&r.Name, &race, &class, &r.Level, &r.Value); err != nil {
			return nil, err
		}
		r.Race, r.Class = raceName(race), className(class)
		out = append(out, r)
	}
	return out, rows.Err()
}

func mapToSlices(counts map[int]int64, name func(int) string) []Slice {
	out := make([]Slice, 0, len(counts))
	for id, n := range counts {
		out = append(out, Slice{Key: name(id), Label: name(id), Count: n})
	}
	sortSlices(out)
	return out
}

func factionsFromRaces(races map[int]int64) []Slice {
	tally := map[string]int64{}
	for id, n := range races {
		tally[factionOf(id)] += n
	}
	return []Slice{
		{Key: "Alliance", Label: "Alliance", Count: tally["Alliance"]},
		{Key: "Horde", Label: "Horde", Count: tally["Horde"]},
	}
}

func bucketLevels(counts map[int]int64) []Bucket {
	out := make([]Bucket, len(levelBrackets))
	for i, b := range levelBrackets {
		out[i] = Bucket{Label: b.label, Min: b.min, Max: b.max}
	}
	var other int64
	for lvl, n := range counts {
		if i := bracketIndex(lvl); i >= 0 {
			out[i].Count += n
		} else {
			other += n
		}
	}
	if other > 0 {
		out = append(out, Bucket{Label: "Other", Count: other})
	}
	return out
}

func bracketIndex(level int) int {
	for i, b := range levelBrackets {
		if level >= b.min && level <= b.max {
			return i
		}
	}
	return -1
}

// sortSlices orders by count desc, then label asc for stable chart ordering.
func sortSlices(s []Slice) {
	sort.SliceStable(s, func(i, j int) bool {
		if s[i].Count != s[j].Count {
			return s[i].Count > s[j].Count
		}
		return s[i].Label < s[j].Label
	})
}
