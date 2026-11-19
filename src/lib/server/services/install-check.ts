// SPDX-License-Identifier: GPL-3.0-or-later
// The checklist of an installation (PLAN.md step 8.7, `/admin/setup`): the configuration file, the
// address the page was opened at, the hardware profile against the computer, the accounts'
// passwords and the backups. Only status — what to do about each finding is the page's links;
// nothing is edited or written here (the backups folder is made when missing, as at start). The
// printer, camera and scanner tests are done by hand on the page.
import { eq } from "drizzle-orm";
import { verifyPassword } from "#lib/server/auth/password.js";
import { ConfigError, loadConfig } from "#lib/server/config/load.js";
import type { ConfigIssue } from "#lib/server/config/validate.js";
import type { ServerContext } from "#lib/server/context.js";
import { staffUser } from "#lib/server/db/schema.js";
import { isDemoPublic } from "#lib/server/demo/public.js";
import { hostResources, type HostResources } from "#lib/server/runtime/host.js";
import {
	worstState,
	type CheckFinding,
	type CheckId,
	type CheckItem,
	type CheckState,
	type InstallCheck,
} from "#lib/shared/install-check.js";
import { nextCronRuns, parseCron } from "#lib/shared/cron.js";
import { PERFORMANCE_PROFILES, type PerformanceProfile } from "#lib/shared/performance.js";
import {
	backupsDirProblem,
	isBackupScheduled,
	listBackups,
	missedBackupRun,
	readOffsiteStatus,
} from "./backup.js";
import { checkFolder } from "./config-check.js";
import { DEMO_PASSWORD } from "./setup.js";

/** The password the shipped `config.example.json` gives its accounts. */
export const EXAMPLE_PASSWORD = "cambiami";
/** Passwords everyone can read in the documentation or the example: never a real one. */
export const KNOWN_PASSWORDS: readonly string[] = [EXAMPLE_PASSWORD, DEMO_PASSWORD];

/** How the page was reached, as the server sees the request. */
export interface CheckRequest {
	/** `http:` or `https:` (adapter-bun reads the proxy's `X-Forwarded-Proto`). */
	protocol: string;
	/** The name or address of the host, without the port. */
	hostname: string;
	/** With the port, for display. */
	host: string;
}

export interface InstallCheckInput {
	request: CheckRequest;
	/** The basic local-network mode of step 8.8 is running (`LAN_PORT`): plain HTTP is expected. */
	lanFront: boolean;
	/**
	 * The full check of the folder (templates, reports, language packs: `checkFolder`) instead of
	 * the schema alone (`loadConfig`): the page asks for it, the dashboard's reminder does not.
	 */
	deep?: boolean;
	/** Tests: the computer's memory and processors, the clock. */
	host?: HostResources;
	now?: Date;
}

type Context = Pick<ServerContext, "db" | "config" | "configDir" | "dataDir">;

const GB = 1024 ** 3;
/**
 * The least memory each profile is meant for. BiblioViva is light: the large profile (256 MB of
 * SQLite cache, four heavy jobs at once) runs well with 4 GB and two processors, which a computer
 * reports as a little less than 4.
 */
const PROFILE_MEMORY_GB: Record<PerformanceProfile, number> = {
	micro: 0.35,
	small: 1.5,
	medium: 1.5,
	large: 3,
};

const rank = (p: PerformanceProfile): number => PERFORMANCE_PROFILES.indexOf(p);

/**
 * The strongest profile the computer carries: the memory first, then one processor or an SD card
 * (a Raspberry Pi, whatever its memory) stays small, a spinning disk medium; with an SSD, or a disk
 * that cannot be seen, the memory decides.
 */
export function suggestedProfile(host: HostResources): PerformanceProfile {
	const gb = host.memoryBytes / GB;
	if (gb < PROFILE_MEMORY_GB.small) {
		return "micro";
	}
	if (host.cpus < 2 || host.disk === "sd") {
		return "small";
	}
	if (host.disk === "hdd" || gb < PROFILE_MEMORY_GB.large) {
		return "medium";
	}
	return "large";
}

const DISK_FINDING = {
	sd: "diskSd",
	hdd: "diskHdd",
	ssd: "diskSsd",
	unknown: "diskUnknown",
} as const satisfies Record<HostResources["disk"], string>;

/** Loopback names: the page is opened on the computer that serves it. */
export function isLoopbackHost(hostname: string): boolean {
	const h = hostname.toLowerCase().replace(/^\[|\]$/g, "");
	return (
		h === "localhost" || h.endsWith(".localhost") || h === "::1" || /^127(\.\d+){3}$/.test(h)
	);
}

function item(id: CheckId, findings: CheckFinding[]): CheckItem {
	return { id, state: worstState(findings.map((f) => f.state)), findings };
}

const issueLine = (i: ConfigIssue): string =>
	`${i.path}${i.file ? ` (${i.file})` : ""}: ${i.message}`;

/** A plain password is the accounts item's business, not a line of the configuration's. */
const isPlainPasswordWarning = (i: ConfigIssue): boolean =>
	i.level === "warning" &&
	/^security\.users\[\d+\]$/.test(i.path) &&
	i.message.includes("plain password");

/** The configuration file as the disk holds it now: valid, with warnings, or refused. */
async function configItem(ctx: Context, deep: boolean): Promise<CheckItem> {
	let issues: ConfigIssue[];
	let source: "file" | "example" | null;
	if (deep) {
		const check = await checkFolder(ctx.configDir);
		issues = check.issues;
		source = check.loaded?.source ?? null;
	} else {
		try {
			const loaded = loadConfig(ctx.configDir);
			issues = loaded.warnings;
			source = loaded.source;
		} catch (e) {
			if (!(e instanceof ConfigError)) {
				throw e;
			}
			issues = e.issues;
			source = null;
		}
	}
	const errors = issues.filter((i) => i.level === "error");
	const warnings = issues.filter((i) => i.level === "warning" && !isPlainPasswordWarning(i));
	const findings: CheckFinding[] = [];
	if (errors.length > 0) {
		findings.push({
			state: "error",
			key: "invalid",
			params: { count: errors.length },
			lines: errors.map(issueLine),
		});
	} else if (source === "example") {
		findings.push({ state: "warning", key: "example" });
	} else {
		findings.push({ state: "ok", key: "valid" });
	}
	if (warnings.length > 0) {
		findings.push({
			state: "warning",
			key: "warnings",
			params: { count: warnings.length },
			lines: warnings.map(issueLine),
		});
	}
	return item("config", findings);
}

/** HTTPS and the name, as the request shows them. */
function addressItem(request: CheckRequest, lanFront: boolean): CheckItem {
	const params = { host: request.host };
	if (request.protocol === "https:") {
		return item("address", [{ state: "ok", key: "https", params }]);
	}
	if (isLoopbackHost(request.hostname)) {
		// the HTTPS check concerns the address the other devices use, not this computer's own
		return item("address", [{ state: "ok", key: "local", params }]);
	}
	return item("address", [
		lanFront
			? { state: "warning", key: "lan", params }
			: { state: "error", key: "plainHttp", params },
	]);
}

/** The profile in use against the computer: too much asked of it, or room left. */
function profileItem(ctx: Context, host: HostResources): CheckItem {
	const profile = ctx.config.performance.profile;
	const gb = Math.round((host.memoryBytes / GB) * 10) / 10;
	const params = { profile, memory: gb, cpus: host.cpus };
	const findings: CheckFinding[] = [];
	if (host.memoryBytes / GB < PROFILE_MEMORY_GB[profile]) {
		findings.push({
			state: "warning",
			key: "weaker",
			params: { ...params, needed: PROFILE_MEMORY_GB[profile] },
		});
	} else {
		findings.push({ state: "ok", key: "ok", params });
	}
	findings.push({
		state: "ok",
		key: DISK_FINDING[host.disk],
		params: { ...params, sdProfile: "small", hddProfile: "medium" },
	});
	const suggested = suggestedProfile(host);
	if (rank(suggested) > rank(profile)) {
		// only a hint: green, the profile in use works
		findings.push({ state: "ok", key: "stronger", params: { ...params, suggested } });
	}
	return item("profile", findings);
}

/** What `verifyPassword` found for a hash: the hashes rarely change, argon2 is slow. */
const knownHashes = new Map<string, boolean>();

async function hashIsKnownPassword(hash: string): Promise<boolean> {
	let known = knownHashes.get(hash);
	if (known === undefined) {
		known = false;
		for (const password of KNOWN_PASSWORDS) {
			if (await verifyPassword(password, hash)) {
				known = true;
				break;
			}
		}
		knownHashes.set(hash, known);
	}
	return known;
}

/** The active accounts whose password is in clear in the file, or is one anyone can read. */
async function accountsItem(ctx: Context): Promise<CheckItem> {
	const inConfig = new Map(ctx.config.security.users.map((u) => [u.username, u]));
	const rows = ctx.db
		.select({
			username: staffUser.username,
			passwordHash: staffUser.passwordHash,
			active: staffUser.active,
		})
		.from(staffUser)
		.where(eq(staffUser.active, 1))
		.all();
	const example: string[] = [];
	const plain: string[] = [];
	for (const row of rows) {
		const cfg = inConfig.get(row.username);
		const inClear = Boolean(cfg && !cfg.passwordHash && cfg.password);
		const known = inClear
			? KNOWN_PASSWORDS.includes(cfg?.password ?? "")
			: await hashIsKnownPassword(row.passwordHash);
		if (known) {
			example.push(row.username);
		} else if (inClear) {
			plain.push(row.username);
		}
	}
	const findings: CheckFinding[] = [];
	if (example.length > 0) {
		findings.push({
			state: "error",
			key: "example",
			params: { count: example.length, names: example.join(", ") },
		});
	}
	if (plain.length > 0) {
		findings.push({
			state: "warning",
			key: "plain",
			params: { count: plain.length, names: plain.join(", ") },
		});
	}
	if (findings.length === 0) {
		findings.push({ state: "ok", key: "ok", params: { count: rows.length } });
	}
	return item("accounts", findings);
}

/** A newest database copy older than this is a red check, not an amber one. */
const STALE_BACKUP_DAYS = 7;

/** The backups folder, the schedule, the newest copy (one made at start counts) and the off-site copy. */
function backupItem(ctx: Context, now: Date): CheckItem {
	if (isDemoPublic()) {
		return item("backup", [{ state: "ok", key: "demo" }]);
	}
	const { cron, offsite } = ctx.config.backup;
	const timezone = ctx.config.library.timezone;
	const findings: CheckFinding[] = [];
	const problem = backupsDirProblem();
	if (problem) {
		findings.push({ state: "error", key: "folder", lines: [problem] });
	}
	const next = nextCronRuns(cron, now, timezone, 1)?.[0];
	if (!parseCron(cron) || !next) {
		findings.push({ state: "error", key: "scheduleInvalid", params: { cron } });
	} else if (!isBackupScheduled()) {
		findings.push({ state: "warning", key: "notScheduled", params: { cron } });
	} else {
		findings.push({
			state: "ok",
			key: "schedule",
			params: { cron, nextAt: next.toISOString() },
		});
	}
	const newest = listBackups().find((b) => b.name.endsWith(".db"));
	if (!newest) {
		findings.push({ state: "warning", key: "none" });
	} else {
		const at = new Date(newest.createdAt);
		if (missedBackupRun(cron, timezone, at, now)) {
			const days = Math.floor((now.getTime() - at.getTime()) / 86_400_000);
			const stale = days >= STALE_BACKUP_DAYS;
			findings.push({
				state: stale ? "error" : "warning",
				key: stale ? "stale" : "late",
				params: { name: newest.name, lastAt: newest.createdAt, days },
			});
		} else {
			findings.push({
				state: "ok",
				key: "last",
				params: { name: newest.name, lastAt: newest.createdAt },
			});
		}
	}
	if (offsite.enabled) {
		const status = readOffsiteStatus(now);
		if (!status) {
			findings.push({ state: "warning", key: "offsiteNone" });
		} else if (status.status !== "ok") {
			findings.push({
				state: "warning",
				key: "offsiteError",
				params: { status: status.status },
			});
		} else if (status.stale) {
			findings.push({ state: "warning", key: "offsiteStale", params: { lastAt: status.at } });
		} else {
			findings.push({ state: "ok", key: "offsiteOk", params: { lastAt: status.at } });
		}
	}
	return item("backup", findings);
}

/**
 * The checklist: every item with its findings and the worst state overall. Read-only; the
 * permission (`admin`) is the caller's to check.
 */
export async function installCheck(ctx: Context, input: InstallCheckInput): Promise<InstallCheck> {
	const now = input.now ?? new Date();
	const host = input.host ?? hostResources(ctx.dataDir);
	const items = [
		await configItem(ctx, input.deep ?? false),
		addressItem(input.request, input.lanFront),
		profileItem(ctx, host),
		await accountsItem(ctx),
		backupItem(ctx, now),
	];
	const state: CheckState = worstState(items.map((i) => i.state));
	const request = input.request;
	return {
		state,
		items,
		cameraAvailable: request.protocol === "https:" || isLoopbackHost(request.hostname),
		lanMode:
			request.protocol !== "https:" && !isLoopbackHost(request.hostname) && input.lanFront,
	};
}
