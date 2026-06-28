package metrics

import "fmt"

// WoW 3.3.5a (WotLK) id spaces used by stock TrinityCore / AzerothCore. Ids
// outside these maps fall back to "#<id>" so a custom race/class never blanks out.

var raceNames = map[int]string{
	1: "Human", 2: "Orc", 3: "Dwarf", 4: "Night Elf", 5: "Undead",
	6: "Tauren", 7: "Gnome", 8: "Troll", 9: "Goblin", 10: "Blood Elf", 11: "Draenei",
}

var classNames = map[int]string{
	1: "Warrior", 2: "Paladin", 3: "Hunter", 4: "Rogue", 5: "Priest",
	6: "Death Knight", 7: "Shaman", 8: "Mage", 9: "Warlock", 10: "Monk", 11: "Druid",
}

// allianceRaces lists the Alliance race ids; everything else is Horde.
var allianceRaces = map[int]bool{1: true, 3: true, 4: true, 7: true, 11: true}

func raceName(id int) string {
	if n, ok := raceNames[id]; ok {
		return n
	}
	return fmt.Sprintf("#%d", id)
}

func className(id int) string {
	if n, ok := classNames[id]; ok {
		return n
	}
	return fmt.Sprintf("#%d", id)
}

func factionOf(raceID int) string {
	if allianceRaces[raceID] {
		return "Alliance"
	}
	return "Horde"
}

func genderName(id int) string {
	switch id {
	case 0:
		return "Male"
	case 1:
		return "Female"
	default:
		return "Unknown"
	}
}
