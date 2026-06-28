export namespace config {
	
	export class Backup {
	    name: string;
	    size: number;
	    // Go type: time
	    modified: any;
	    kind: string;
	
	    static createFrom(source: any = {}) {
	        return new Backup(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.name = source["name"];
	        this.size = source["size"];
	        this.modified = this.convertValues(source["modified"], null);
	        this.kind = source["kind"];
	    }
	
		convertValues(a: any, classs: any, asMap: boolean = false): any {
		    if (!a) {
		        return a;
		    }
		    if (a.slice && a.map) {
		        return (a as any[]).map(elem => this.convertValues(elem, classs));
		    } else if ("object" === typeof a) {
		        if (asMap) {
		            for (const key of Object.keys(a)) {
		                a[key] = new classs(a[key]);
		            }
		            return a;
		        }
		        return new classs(a);
		    }
		    return a;
		}
	}
	export class ConfigFile {
	    id: string;
	    name: string;
	    kind: string;
	    relPath: string;
	    size: number;
	    // Go type: time
	    modified: any;
	
	    static createFrom(source: any = {}) {
	        return new ConfigFile(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.id = source["id"];
	        this.name = source["name"];
	        this.kind = source["kind"];
	        this.relPath = source["relPath"];
	        this.size = source["size"];
	        this.modified = this.convertValues(source["modified"], null);
	    }
	
		convertValues(a: any, classs: any, asMap: boolean = false): any {
		    if (!a) {
		        return a;
		    }
		    if (a.slice && a.map) {
		        return (a as any[]).map(elem => this.convertValues(elem, classs));
		    } else if ("object" === typeof a) {
		        if (asMap) {
		            for (const key of Object.keys(a)) {
		                a[key] = new classs(a[key]);
		            }
		            return a;
		        }
		        return new classs(a);
		    }
		    return a;
		}
	}
	export class Match {
	    line: number;
	    text: string;
	
	    static createFrom(source: any = {}) {
	        return new Match(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.line = source["line"];
	        this.text = source["text"];
	    }
	}

}

export namespace files {
	
	export class CleanupPreview {
	    files: string[];
	    count: number;
	    bytes: number;
	
	    static createFrom(source: any = {}) {
	        return new CleanupPreview(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.files = source["files"];
	        this.count = source["count"];
	        this.bytes = source["bytes"];
	    }
	}
	export class Entry {
	    name: string;
	    relPath: string;
	    isDir: boolean;
	    size: number;
	    // Go type: time
	    modified: any;
	
	    static createFrom(source: any = {}) {
	        return new Entry(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.name = source["name"];
	        this.relPath = source["relPath"];
	        this.isDir = source["isDir"];
	        this.size = source["size"];
	        this.modified = this.convertValues(source["modified"], null);
	    }
	
		convertValues(a: any, classs: any, asMap: boolean = false): any {
		    if (!a) {
		        return a;
		    }
		    if (a.slice && a.map) {
		        return (a as any[]).map(elem => this.convertValues(elem, classs));
		    } else if ("object" === typeof a) {
		        if (asMap) {
		            for (const key of Object.keys(a)) {
		                a[key] = new classs(a[key]);
		            }
		            return a;
		        }
		        return new classs(a);
		    }
		    return a;
		}
	}
	export class UsageBucket {
	    name: string;
	    bytes: number;
	
	    static createFrom(source: any = {}) {
	        return new UsageBucket(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.name = source["name"];
	        this.bytes = source["bytes"];
	    }
	}
	export class UsageReport {
	    total: number;
	    buckets: UsageBucket[];
	    // Go type: time
	    scannedAt: any;
	
	    static createFrom(source: any = {}) {
	        return new UsageReport(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.total = source["total"];
	        this.buckets = this.convertValues(source["buckets"], UsageBucket);
	        this.scannedAt = this.convertValues(source["scannedAt"], null);
	    }
	
		convertValues(a: any, classs: any, asMap: boolean = false): any {
		    if (!a) {
		        return a;
		    }
		    if (a.slice && a.map) {
		        return (a as any[]).map(elem => this.convertValues(elem, classs));
		    } else if ("object" === typeof a) {
		        if (asMap) {
		            for (const key of Object.keys(a)) {
		                a[key] = new classs(a[key]);
		            }
		            return a;
		        }
		        return new classs(a);
		    }
		    return a;
		}
	}

}

export namespace logs {
	
	export class LogEntry {
	    kind: string;
	    displayName: string;
	    relPath: string;
	    exists: boolean;
	    size: number;
	    // Go type: time
	    modified: any;
	    clearable: boolean;
	    archivable: boolean;
	
	    static createFrom(source: any = {}) {
	        return new LogEntry(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.kind = source["kind"];
	        this.displayName = source["displayName"];
	        this.relPath = source["relPath"];
	        this.exists = source["exists"];
	        this.size = source["size"];
	        this.modified = this.convertValues(source["modified"], null);
	        this.clearable = source["clearable"];
	        this.archivable = source["archivable"];
	    }
	
		convertValues(a: any, classs: any, asMap: boolean = false): any {
		    if (!a) {
		        return a;
		    }
		    if (a.slice && a.map) {
		        return (a as any[]).map(elem => this.convertValues(elem, classs));
		    } else if ("object" === typeof a) {
		        if (asMap) {
		            for (const key of Object.keys(a)) {
		                a[key] = new classs(a[key]);
		            }
		            return a;
		        }
		        return new classs(a);
		    }
		    return a;
		}
	}

}

export namespace main {
	
	export class CoreOption {
	    type: string;
	    displayName: string;
	    installDir: string;
	    configured: boolean;
	
	    static createFrom(source: any = {}) {
	        return new CoreOption(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.type = source["type"];
	        this.displayName = source["displayName"];
	        this.installDir = source["installDir"];
	        this.configured = source["configured"];
	    }
	}
	export class AppState {
	    settings: settings.Settings;
	    cores: CoreOption[];
	    activeCore: string;
	    configured: boolean;
	    installDir: string;
	    hasModules: boolean;
	
	    static createFrom(source: any = {}) {
	        return new AppState(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.settings = this.convertValues(source["settings"], settings.Settings);
	        this.cores = this.convertValues(source["cores"], CoreOption);
	        this.activeCore = source["activeCore"];
	        this.configured = source["configured"];
	        this.installDir = source["installDir"];
	        this.hasModules = source["hasModules"];
	    }
	
		convertValues(a: any, classs: any, asMap: boolean = false): any {
		    if (!a) {
		        return a;
		    }
		    if (a.slice && a.map) {
		        return (a as any[]).map(elem => this.convertValues(elem, classs));
		    } else if ("object" === typeof a) {
		        if (asMap) {
		            for (const key of Object.keys(a)) {
		                a[key] = new classs(a[key]);
		            }
		            return a;
		        }
		        return new classs(a);
		    }
		    return a;
		}
	}

	export class MetricsDBInfo {
	    host: string;
	    port: string;
	    user: string;
	    authDb: string;
	    worldDb: string;
	    charDb: string;
	    source: string;
	    hasPass: boolean;

	    static createFrom(source: any = {}) {
	        return new MetricsDBInfo(source);
	    }

	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.host = source["host"];
	        this.port = source["port"];
	        this.user = source["user"];
	        this.authDb = source["authDb"];
	        this.worldDb = source["worldDb"];
	        this.charDb = source["charDb"];
	        this.source = source["source"];
	        this.hasPass = source["hasPass"];
	    }
	}

}

export namespace metrics {

	export class Slice {
	    key: string;
	    label: string;
	    count: number;

	    static createFrom(source: any = {}) {
	        return new Slice(source);
	    }

	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.key = source["key"];
	        this.label = source["label"];
	        this.count = source["count"];
	    }
	}
	export class Bucket {
	    label: string;
	    min: number;
	    max: number;
	    count: number;

	    static createFrom(source: any = {}) {
	        return new Bucket(source);
	    }

	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.label = source["label"];
	        this.min = source["min"];
	        this.max = source["max"];
	        this.count = source["count"];
	    }
	}
	export class CharRow {
	    name: string;
	    race: string;
	    class: string;
	    level: number;
	    value: number;

	    static createFrom(source: any = {}) {
	        return new CharRow(source);
	    }

	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.name = source["name"];
	        this.race = source["race"];
	        this.class = source["class"];
	        this.level = source["level"];
	        this.value = source["value"];
	    }
	}
	export class GuildRow {
	    name: string;
	    members: number;
	    leader: string;

	    static createFrom(source: any = {}) {
	        return new GuildRow(source);
	    }

	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.name = source["name"];
	        this.members = source["members"];
	        this.leader = source["leader"];
	    }
	}
	export class TimePoint {
	    date: string;
	    count: number;

	    static createFrom(source: any = {}) {
	        return new TimePoint(source);
	    }

	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.date = source["date"];
	        this.count = source["count"];
	    }
	}
	export class Overview {
	    accounts: number;
	    activeAccounts: number;
	    characters: number;
	    onlineNow: number;
	    guilds: number;
	    bannedAccounts: number;
	    maxLevelChars: number;
	    avgLevel: number;

	    static createFrom(source: any = {}) {
	        return new Overview(source);
	    }

	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.accounts = source["accounts"];
	        this.activeAccounts = source["activeAccounts"];
	        this.characters = source["characters"];
	        this.onlineNow = source["onlineNow"];
	        this.guilds = source["guilds"];
	        this.bannedAccounts = source["bannedAccounts"];
	        this.maxLevelChars = source["maxLevelChars"];
	        this.avgLevel = source["avgLevel"];
	    }
	}
	export class Economy {
	    totalCopper: number;
	    avgGold: number;
	    richest: CharRow[];

	    static createFrom(source: any = {}) {
	        return new Economy(source);
	    }

	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.totalCopper = source["totalCopper"];
	        this.avgGold = source["avgGold"];
	        this.richest = this.convertValues(source["richest"], CharRow);
	    }

		convertValues(a: any, classs: any, asMap: boolean = false): any {
		    if (!a) {
		        return a;
		    }
		    if (a.slice && a.map) {
		        return (a as any[]).map(elem => this.convertValues(elem, classs));
		    } else if ("object" === typeof a) {
		        if (asMap) {
		            for (const key of Object.keys(a)) {
		                a[key] = new classs(a[key]);
		            }
		            return a;
		        }
		        return new classs(a);
		    }
		    return a;
		}
	}
	export class Metrics {
	    overview: Overview;
	    races: Slice[];
	    classes: Slice[];
	    factions: Slice[];
	    genders: Slice[];
	    levels: Bucket[];
	    economy: Economy;
	    topPlaytime: CharRow[];
	    topLevel: CharRow[];
	    topGuilds: GuildRow[];
	    signups: TimePoint[];
	    // Go type: time
	    generatedAt: any;

	    static createFrom(source: any = {}) {
	        return new Metrics(source);
	    }

	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.overview = this.convertValues(source["overview"], Overview);
	        this.races = this.convertValues(source["races"], Slice);
	        this.classes = this.convertValues(source["classes"], Slice);
	        this.factions = this.convertValues(source["factions"], Slice);
	        this.genders = this.convertValues(source["genders"], Slice);
	        this.levels = this.convertValues(source["levels"], Bucket);
	        this.economy = this.convertValues(source["economy"], Economy);
	        this.topPlaytime = this.convertValues(source["topPlaytime"], CharRow);
	        this.topLevel = this.convertValues(source["topLevel"], CharRow);
	        this.topGuilds = this.convertValues(source["topGuilds"], GuildRow);
	        this.signups = this.convertValues(source["signups"], TimePoint);
	        this.generatedAt = source["generatedAt"];
	    }

		convertValues(a: any, classs: any, asMap: boolean = false): any {
		    if (!a) {
		        return a;
		    }
		    if (a.slice && a.map) {
		        return (a as any[]).map(elem => this.convertValues(elem, classs));
		    } else if ("object" === typeof a) {
		        if (asMap) {
		            for (const key of Object.keys(a)) {
		                a[key] = new classs(a[key]);
		            }
		            return a;
		        }
		        return new classs(a);
		    }
		    return a;
		}
	}

}

export namespace process {
	
	export class ProcInfo {
	    target: string;
	    state: string;
	    pid: number;
	    startedAt: number;
	    external: boolean;
	
	    static createFrom(source: any = {}) {
	        return new ProcInfo(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.target = source["target"];
	        this.state = source["state"];
	        this.pid = source["pid"];
	        this.startedAt = source["startedAt"];
	        this.external = source["external"];
	    }
	}
	export class Status {
	    core: string;
	    db: string;
	    auth: ProcInfo;
	    world: ProcInfo;
	    updatedAt: number;
	
	    static createFrom(source: any = {}) {
	        return new Status(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.core = source["core"];
	        this.db = source["db"];
	        this.auth = this.convertValues(source["auth"], ProcInfo);
	        this.world = this.convertValues(source["world"], ProcInfo);
	        this.updatedAt = source["updatedAt"];
	    }
	
		convertValues(a: any, classs: any, asMap: boolean = false): any {
		    if (!a) {
		        return a;
		    }
		    if (a.slice && a.map) {
		        return (a as any[]).map(elem => this.convertValues(elem, classs));
		    } else if ("object" === typeof a) {
		        if (asMap) {
		            for (const key of Object.keys(a)) {
		                a[key] = new classs(a[key]);
		            }
		            return a;
		        }
		        return new classs(a);
		    }
		    return a;
		}
	}

}

export namespace profile {
	
	export class LogFile {
	    kind: string;
	    displayName: string;
	    relPath: string;
	    archivable: boolean;
	    clearable: boolean;
	
	    static createFrom(source: any = {}) {
	        return new LogFile(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.kind = source["kind"];
	        this.displayName = source["displayName"];
	        this.relPath = source["relPath"];
	        this.archivable = source["archivable"];
	        this.clearable = source["clearable"];
	    }
	}
	export class ResolvedProfile {
	    type: string;
	    displayName: string;
	    authServerExe: string;
	    worldServerExe: string;
	    authConfigRel: string;
	    worldConfigRel: string;
	    configDirRel: string;
	    moduleConfigDir: string;
	    logs: Record<string, LogFile>;
	    luaScriptsDir: string;
	    crashesDir: string;
	    dataDirs: string[];
	    dockerComposeRel: string;
	    dockerContainer: string;
	    dockerService: string;
	    root: string;
	
	    static createFrom(source: any = {}) {
	        return new ResolvedProfile(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.type = source["type"];
	        this.displayName = source["displayName"];
	        this.authServerExe = source["authServerExe"];
	        this.worldServerExe = source["worldServerExe"];
	        this.authConfigRel = source["authConfigRel"];
	        this.worldConfigRel = source["worldConfigRel"];
	        this.configDirRel = source["configDirRel"];
	        this.moduleConfigDir = source["moduleConfigDir"];
	        this.logs = this.convertValues(source["logs"], LogFile, true);
	        this.luaScriptsDir = source["luaScriptsDir"];
	        this.crashesDir = source["crashesDir"];
	        this.dataDirs = source["dataDirs"];
	        this.dockerComposeRel = source["dockerComposeRel"];
	        this.dockerContainer = source["dockerContainer"];
	        this.dockerService = source["dockerService"];
	        this.root = source["root"];
	    }
	
		convertValues(a: any, classs: any, asMap: boolean = false): any {
		    if (!a) {
		        return a;
		    }
		    if (a.slice && a.map) {
		        return (a as any[]).map(elem => this.convertValues(elem, classs));
		    } else if ("object" === typeof a) {
		        if (asMap) {
		            for (const key of Object.keys(a)) {
		                a[key] = new classs(a[key]);
		            }
		            return a;
		        }
		        return new classs(a);
		    }
		    return a;
		}
	}

}

export namespace settings {

	export class MetricsDBOverride {
	    host: string;
	    port: string;
	    user: string;
	    pass: string;
	    authDb: string;
	    worldDb: string;
	    charDb: string;

	    static createFrom(source: any = {}) {
	        return new MetricsDBOverride(source);
	    }

	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.host = source["host"];
	        this.port = source["port"];
	        this.user = source["user"];
	        this.pass = source["pass"];
	        this.authDb = source["authDb"];
	        this.worldDb = source["worldDb"];
	        this.charDb = source["charDb"];
	    }
	}
	export class CoreInstall {
	    type: string;
	    installDir: string;
	    dockerComposeOverride?: string;
	    dockerContainerOverride?: string;
	
	    static createFrom(source: any = {}) {
	        return new CoreInstall(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.type = source["type"];
	        this.installDir = source["installDir"];
	        this.dockerComposeOverride = source["dockerComposeOverride"];
	        this.dockerContainerOverride = source["dockerContainerOverride"];
	    }
	}
	export class Settings {
	    activeCore: string;
	    installs: Record<string, CoreInstall>;
	    logTailLines: number;
	    confirmDestructive: boolean;
	    stopServersOnExit: boolean;
	    metricsDb?: MetricsDBOverride;

	    static createFrom(source: any = {}) {
	        return new Settings(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.activeCore = source["activeCore"];
	        this.installs = this.convertValues(source["installs"], CoreInstall, true);
	        this.logTailLines = source["logTailLines"];
	        this.confirmDestructive = source["confirmDestructive"];
	        this.stopServersOnExit = source["stopServersOnExit"];
	        this.metricsDb = this.convertValues(source["metricsDb"], MetricsDBOverride);
	    }
	
		convertValues(a: any, classs: any, asMap: boolean = false): any {
		    if (!a) {
		        return a;
		    }
		    if (a.slice && a.map) {
		        return (a as any[]).map(elem => this.convertValues(elem, classs));
		    } else if ("object" === typeof a) {
		        if (asMap) {
		            for (const key of Object.keys(a)) {
		                a[key] = new classs(a[key]);
		            }
		            return a;
		        }
		        return new classs(a);
		    }
		    return a;
		}
	}

}

