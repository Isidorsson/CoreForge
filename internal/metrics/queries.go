package metrics

import (
	"context"
	"database/sql"
	"fmt"
	"regexp"
	"sort"
	"strings"
	"time"
)

// Metrics is the full snapshot the metrics page renders in one round-trip.
type Metrics struct {
	Overview     Overview     `json:"overview"`
	Races        []Slice      `json:"races"`
	Classes      []Slice      `json:"classes"`
	Factions     []Slice      `json:"factions"`
	Genders      []Slice      `json:"genders"`
	Levels       []Bucket     `json:"levels"`
	Wealth       []Bucket     `json:"wealth"`
	PlaytimeDist []Bucket     `json:"playtimeDist"`
	ClassFaction []ClassSplit `json:"classFaction"`
	Economy      Economy      `json:"economy"`
	TopPlaytime  []CharRow    `json:"topPlaytime"`
	TopLevel     []CharRow    `json:"topLevel"`
	TopGuilds    []GuildRow   `json:"topGuilds"`
	Signups      []TimePoint  `json:"signups"`
	GeneratedAt  time.Time    `json:"generatedAt"`
}

// Filter narrows every character-scoped query. The zero value scans the whole
// realm; each set field adds one AND condition to the shared WHERE clause.
type Filter struct {
	Faction    string `json:"faction"`    // "", "Alliance", "Horde"
	MinLevel   int    `json:"minLevel"`   // 0 = no floor
	MaxLevel   int    `json:"maxLevel"`   // 0 = no ceiling
	Activity   string `json:"activity"`   // "", "online", "recent"
	RecentDays int    `json:"recentDays"` // window for activity=="recent" (default 14)
	Race       int    `json:"race"`       // race id, 0 = all
	Class      int    `json:"class"`      // class id, 0 = all
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

// Bucket is one column in a histogram (levels, wealth, playtime).
type Bucket struct {
	Label string `json:"label"`
	Min   int    `json:"min"`
	Max   int    `json:"max"`
	Count int64  `json:"count"`
}

// ClassSplit is one class's population split by faction (grouped-bar datum).
type ClassSplit struct {
	Class    string `json:"class"`
	Alliance int64  `json:"alliance"`
	Horde    int64  `json:"horde"`
}

// Economy summarizes the gold supply across the filtered character set.
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

// GuildRow is a guild-leaderboard entry with at-a-glance roster health.
type GuildRow struct {
	Name     string  `json:"name"`
	Members  int64   `json:"members"`
	Active   int64   `json:"active"` // members logged in within 14 days
	AvgLevel float64 `json:"avgLevel"`
	Leader   string  `json:"leader"`
	Created  string  `json:"created"` // YYYY-MM-DD, "" if unknown
}

// TimePoint is one day in the signups time series.
type TimePoint struct {
	Date  string `json:"date"`
	Count int64  `json:"count"`
}

// bracket is a half-open-ish [min,max] count band for a histogram helper.
type bracket struct {
	label    string
	min, max int64
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

// ── YOUR CALL ───────────────────────────────────────────────────────────────
// goldBrackets bins characters by wealth (values are COPPER; 1g = 10,000c).
// playtimeBrackets bins by /played seconds. Defaults assume a normal economy
// and casual playerbase — widen the top band for an inflated realm, or add
// finer low-end bands if most of your characters are fresh alts.
var goldBrackets = []bracket{
	{"<10g", 0, 100_000 - 1},
	{"10–100g", 100_000, 1_000_000 - 1},
	{"100g–1k", 1_000_000, 10_000_000 - 1},
	{"1k–10k", 10_000_000, 100_000_000 - 1},
	{"10k+", 100_000_000, 1 << 62},
}

var playtimeBrackets = []bracket{
	{"<1h", 0, 3_600 - 1},
	{"1–10h", 3_600, 36_000 - 1},
	{"10–50h", 36_000, 180_000 - 1},
	{"50–100h", 180_000, 360_000 - 1},
	{"100h+", 360_000, 1 << 62},
}

// Snapshot runs every metric query under the given filter. The characters
// overview must succeed (it proves the connection and core schema); every other
// section is best-effort so one odd table on a custom DB can't blank the page.
func (m *Manager) Snapshot(ctx context.Context, f Filter) (Metrics, error) {
	db, cfg, err := m.pool()
	if err != nil {
		return Metrics{}, err
	}
	cctx, cancel := context.WithTimeout(ctx, 25*time.Second)
	defer cancel()
	char, auth := ident(cfg.CharDB), ident(cfg.AuthDB)
	cond := charCond(f)

	out := Metrics{GeneratedAt: time.Now()}
	if out.Overview, err = overview(cctx, db, char, auth, cond); err != nil {
		return Metrics{}, err
	}

	races, _ := groupCount(cctx, db, grp(char, "race", cond))
	classes, _ := groupCount(cctx, db, grp(char, "class", cond))
	genders, _ := groupCount(cctx, db, grp(char, "gender", cond))
	levels, _ := groupCount(cctx, db, grp(char, "level", cond))
	out.Races = mapToSlices(races, raceName)
	out.Classes = mapToSlices(classes, className)
	out.Genders = mapToSlices(genders, genderName)
	out.Factions = factionsFromRaces(races)
	out.Levels = bucketLevels(levels)

	out.Wealth, _ = bracketCounts(cctx, db, char, cond, "money", goldBrackets)
	out.PlaytimeDist, _ = bracketCounts(cctx, db, char, cond, "totaltime", playtimeBrackets)
	out.ClassFaction, _ = classFaction(cctx, db, char, cond)

	out.Economy, _ = economy(cctx, db, char, cond)
	out.TopPlaytime, _ = charRows(cctx, db, topQuery(char, "totaltime", cond))
	out.TopLevel, _ = charRows(cctx, db, topLevelQuery(char, cond))
	out.TopGuilds, _ = guildRows(cctx, db, char) // guild board is realm-wide, not filtered
	if auth != "" {
		out.Signups, _ = signups(cctx, db, auth)
	}
	return out, nil
}

func overview(ctx context.Context, db *sql.DB, char, auth, cond string) (Overview, error) {
	var o Overview
	q := fmt.Sprintf(`SELECT
		(SELECT COUNT(*) FROM %[1]s.characters WHERE %[2]s),
		(SELECT COUNT(*) FROM %[1]s.characters WHERE %[2]s AND online=1),
		(SELECT COUNT(*) FROM %[1]s.guild),
		(SELECT COALESCE(AVG(level),0) FROM %[1]s.characters WHERE %[2]s),
		(SELECT COUNT(*) FROM %[1]s.characters WHERE %[2]s
			AND level=(SELECT MAX(level) FROM %[1]s.characters))`, char, cond)
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

func economy(ctx context.Context, db *sql.DB, char, cond string) (Economy, error) {
	var e Economy
	var total sql.NullInt64
	var avg sql.NullFloat64
	q := fmt.Sprintf("SELECT COALESCE(SUM(money),0), COALESCE(AVG(money),0) FROM %s.characters WHERE %s", char, cond)
	if err := db.QueryRowContext(ctx, q).Scan(&total, &avg); err != nil {
		return e, err
	}
	e.TotalCopper = total.Int64
	e.AvgGold = avg.Float64 / 10000.0
	e.Richest, _ = charRows(ctx, db, fmt.Sprintf(
		"SELECT name, race, class, level, money FROM %s.characters WHERE %s ORDER BY money DESC LIMIT 10", char, cond))
	return e, nil
}

func guildRows(ctx context.Context, db *sql.DB, char string) ([]GuildRow, error) {
	q := fmt.Sprintf(`SELECT g.name, COUNT(gm.guid) AS members,
			COALESCE(SUM(mc.logout_time > UNIX_TIMESTAMP(NOW() - INTERVAL 14 DAY)),0) AS active,
			COALESCE(AVG(mc.level),0) AS avglvl,
			COALESCE(lc.name,''),
			COALESCE(DATE_FORMAT(FROM_UNIXTIME(g.createdate),'%%Y-%%m-%%d'),'')
		FROM %[1]s.guild g
		LEFT JOIN %[1]s.guild_member gm ON gm.guildid = g.guildid
		LEFT JOIN %[1]s.characters mc ON mc.guid = gm.guid
		LEFT JOIN %[1]s.characters lc ON lc.guid = g.leaderguid
		GROUP BY g.guildid, g.name, lc.name, g.createdate
		ORDER BY members DESC LIMIT 10`, char)
	rows, err := db.QueryContext(ctx, q)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	out := []GuildRow{}
	for rows.Next() {
		var g GuildRow
		if err := rows.Scan(&g.Name, &g.Members, &g.Active, &g.AvgLevel, &g.Leader, &g.Created); err != nil {
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

// classFaction tallies each class split Alliance vs Horde for the grouped chart.
func classFaction(ctx context.Context, db *sql.DB, char, cond string) ([]ClassSplit, error) {
	q := fmt.Sprintf("SELECT class, race, COUNT(*) FROM %s.characters WHERE %s GROUP BY class, race", char, cond)
	rows, err := db.QueryContext(ctx, q)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	agg := map[int]*ClassSplit{}
	for rows.Next() {
		var cls, race int
		var n int64
		if err := rows.Scan(&cls, &race, &n); err != nil {
			return nil, err
		}
		cs := agg[cls]
		if cs == nil {
			cs = &ClassSplit{Class: className(cls)}
			agg[cls] = cs
		}
		if factionOf(race) == "Alliance" {
			cs.Alliance += n
		} else {
			cs.Horde += n
		}
	}
	if err := rows.Err(); err != nil {
		return nil, err
	}
	out := make([]ClassSplit, 0, len(agg))
	for _, cs := range agg {
		out = append(out, *cs)
	}
	sort.SliceStable(out, func(i, j int) bool {
		ti, tj := out[i].Alliance+out[i].Horde, out[j].Alliance+out[j].Horde
		if ti != tj {
			return ti > tj
		}
		return out[i].Class < out[j].Class
	})
	return out, nil
}

// bracketCounts buckets one numeric column into the given bands with a single
// SUM(CASE…) row, so a histogram costs one query regardless of band count.
func bracketCounts(ctx context.Context, db *sql.DB, char, cond, col string, bs []bracket) ([]Bucket, error) {
	sel := make([]string, len(bs))
	for i, b := range bs {
		sel[i] = fmt.Sprintf("COALESCE(SUM(CASE WHEN %[1]s>=%[2]d AND %[1]s<=%[3]d THEN 1 ELSE 0 END),0)", col, b.min, b.max)
	}
	q := fmt.Sprintf("SELECT %s FROM %s.characters WHERE %s", strings.Join(sel, ","), char, cond)
	vals := make([]int64, len(bs))
	dst := make([]any, len(bs))
	for i := range vals {
		dst[i] = &vals[i]
	}
	if err := db.QueryRowContext(ctx, q).Scan(dst...); err != nil {
		return nil, err
	}
	out := make([]Bucket, len(bs))
	for i, b := range bs {
		out[i] = Bucket{Label: b.label, Count: vals[i]}
	}
	return out, nil
}

/* ------------------------------- helpers ---------------------------------- */

var identRe = regexp.MustCompile(`[^a-zA-Z0-9_]`)

// ident strips a schema name to identifier-safe chars; schema names come from a
// config file and can't be passed as query parameters, so they are sanitized.
func ident(s string) string { return identRe.ReplaceAllString(s, "") }

// charCond builds the AND-joined WHERE conditions shared by every character
// query. All values are Go ints (or a fixed faction id list), so there is no
// injection surface even though they are formatted into the SQL string.
func charCond(f Filter) string {
	cond := []string{"(deleteDate IS NULL OR deleteDate=0)"}
	if f.MinLevel > 0 {
		cond = append(cond, fmt.Sprintf("level >= %d", f.MinLevel))
	}
	if f.MaxLevel > 0 {
		cond = append(cond, fmt.Sprintf("level <= %d", f.MaxLevel))
	}
	if f.Class > 0 {
		cond = append(cond, fmt.Sprintf("class = %d", f.Class))
	}
	if f.Race > 0 {
		cond = append(cond, fmt.Sprintf("race = %d", f.Race))
	}
	if fc := factionCond(f.Faction); fc != "" {
		cond = append(cond, fc)
	}
	switch f.Activity {
	case "online":
		cond = append(cond, "online = 1")
	case "recent":
		d := f.RecentDays
		if d <= 0 {
			d = 14
		}
		cond = append(cond, fmt.Sprintf("logout_time > UNIX_TIMESTAMP(NOW() - INTERVAL %d DAY)", d))
	}
	return strings.Join(cond, " AND ")
}

// factionCond restricts by faction using the Alliance race id set; Horde is
// "everything else" so custom races default Horde, matching factionOf.
func factionCond(faction string) string {
	if faction != "Alliance" && faction != "Horde" {
		return ""
	}
	ids := make([]int, 0, len(allianceRaces))
	for id := range allianceRaces {
		ids = append(ids, id)
	}
	sort.Ints(ids)
	parts := make([]string, len(ids))
	for i, id := range ids {
		parts[i] = fmt.Sprintf("%d", id)
	}
	set := strings.Join(parts, ",")
	if faction == "Alliance" {
		return "race IN (" + set + ")"
	}
	return "race NOT IN (" + set + ")"
}

func grp(char, col, cond string) string {
	return fmt.Sprintf("SELECT %[2]s, COUNT(*) FROM %[1]s.characters WHERE %[3]s GROUP BY %[2]s", char, col, cond)
}

func topQuery(char, col, cond string) string {
	return fmt.Sprintf("SELECT name, race, class, level, %[2]s FROM %[1]s.characters WHERE %[3]s ORDER BY %[2]s DESC LIMIT 10", char, col, cond)
}

func topLevelQuery(char, cond string) string {
	return fmt.Sprintf("SELECT name, race, class, level, level FROM %s.characters WHERE %s ORDER BY level DESC, totaltime DESC LIMIT 10", char, cond)
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
