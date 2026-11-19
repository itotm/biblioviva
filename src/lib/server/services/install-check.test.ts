// SPDX-License-Identifier: GPL-3.0-or-later
import { mkdirSync, mkdtempSync, rmSync, utimesSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { mirrorConfigUsers } from "#lib/server/auth/config-users.js";
import { hashPassword } from "#lib/server/auth/password.js";
import { resetConfigCache } from "#lib/server/config/index.js";
import { exampleRaw, parseConfig } from "#lib/server/config/load.js";
import type { AppConfig } from "#lib/server/config/schema.js";
import type { Db } from "#lib/server/db/client.js";
import { resetEnvCache } from "#lib/server/env.js";
import type { HostResources } from "#lib/server/runtime/host.js";
import {
	PROBLEM_FINDINGS,
	type CheckFinding,
	type CheckId,
	type InstallCheck,
} from "#lib/shared/install-check.js";
import { createTestDb } from "../../../../tests/helpers/db.js";
import { setUiTheme } from "../../../../tests/helpers/config.js";
import { DEMO_PASSWORD } from "./setup.js";
import { createBackup, installBackupSchedule, stopBackupSchedule } from "./backup.js";
import {
	EXAMPLE_PASSWORD,
	installCheck,
	isLoopbackHost,
	suggestedProfile,
	type CheckRequest,
} from "./install-check.js";

const GB = 1024 ** 3;
const PI: HostResources = { memoryBytes: 1.9 * GB, cpus: 4, disk: "sd" };
const PC: HostResources = { memoryBytes: 16 * GB, cpus: 8, disk: "ssd" };
const NOW = new Date("2026-11-19T10:00:00Z");
/** A backup of last night's schedule (03:00 in Rome is 02:00 UTC). */
const LAST_NIGHT = new Date("2026-11-19T02:00:30Z");

const HTTPS: CheckRequest = {
	protocol: "https:",
	hostname: "biblioviva.example.ts.net",
	host: "biblioviva.example.ts.net",
};
const LOCAL: CheckRequest = { protocol: "http:", hostname: "localhost", host: "localhost:3000" };
const LAN: CheckRequest = {
	protocol: "http:",
	hostname: "biblioviva.local",
	host: "biblioviva.local:8080",
};

let dir = "";
let backups = "";
let db: Db;
const saved = process.env.BACKUP_DIR;

beforeEach(() => {
	dir = mkdtempSync(join(tmpdir(), "bv-install-check-"));
	backups = join(dir, "backups");
	mkdirSync(backups);
	process.env.BACKUP_DIR = backups;
	resetEnvCache();
	setUiTheme(join(dir, "config"), "ocean");
	db = createTestDb();
	// the schedule runs, as it does in the server
	installBackupSchedule(
		"0 3 * * *",
		"Europe/Rome",
		() => undefined,
		() => ({ stop: () => 0 }),
	);
});
afterEach(() => {
	stopBackupSchedule();
	resetConfigCache();
	if (saved === undefined) {
		delete process.env.BACKUP_DIR;
	} else {
		process.env.BACKUP_DIR = saved;
	}
	resetEnvCache();
	rmSync(dir, { recursive: true, force: true });
});

/** The example configuration with its accounts and changes of the test. */
function configWith(change: (raw: Record<string, any>) => void = () => undefined): AppConfig {
	const raw = exampleRaw() as Record<string, any>;
	raw.library.timezone = "Europe/Rome";
	change(raw);
	return parseConfig(raw, "test").config;
}

/** A hashed account, as the wizard writes them. */
async function admin(password = "una-password-vera-1"): Promise<Record<string, unknown>> {
	return {
		username: "admin",
		roles: ["admin"],
		active: true,
		passwordHash: await hashPassword(password),
	};
}

async function run(
	config: AppConfig,
	over: {
		request?: CheckRequest;
		lanFront?: boolean;
		host?: HostResources;
		deep?: boolean;
		configDir?: string;
	} = {},
): Promise<InstallCheck> {
	await mirrorConfigUsers(db, config);
	const check = await installCheck(
		{
			db,
			config,
			configDir: over.configDir ?? join(dir, "config"),
			dataDir: join(dir, "data"),
		},
		{
			request: over.request ?? HTTPS,
			lanFront: over.lanFront ?? false,
			host: over.host ?? PI,
			deep: over.deep,
			now: NOW,
		},
	);
	for (const item of check.items) {
		for (const f of item.findings) {
			if (f.state !== "ok") {
				reported.add(`${item.id}.${f.key}`);
			}
		}
	}
	return check;
}

/** Every finding that was not green in the tests of this file. */
const reported = new Set<string>();

function finding(check: InstallCheck, id: CheckId, key: string): CheckFinding | undefined {
	return check.items.find((i) => i.id === id)?.findings.find((f) => f.key === key);
}
const stateOf = (check: InstallCheck, id: CheckId): string | undefined =>
	check.items.find((i) => i.id === id)?.state;

/** A database copy made at `at`, as the schedule or the backup at start would. */
function backupMadeAt(at: Date): string {
	const b = createBackup(db, "Europe/Rome", at);
	utimesSync(join(backups, b.name), at, at);
	return b.name;
}

/** The accounts of a green installation: one administrator with a hash of its own. */
async function goodConfig(): Promise<AppConfig> {
	const account = await admin();
	return configWith((raw) => {
		raw.security.users = [account];
	});
}

describe("the checklist of an installation", () => {
	it("is green when every item is: a valid file, HTTPS, a fitting profile, a hashed password, a recent backup", async () => {
		backupMadeAt(LAST_NIGHT);
		const check = await run(await goodConfig());
		expect(check.items.map((i) => i.id)).toEqual([
			"config",
			"address",
			"profile",
			"accounts",
			"backup",
		]);
		expect(check.items.map((i) => i.state)).toEqual(["ok", "ok", "ok", "ok", "ok"]);
		expect(check.state).toBe("ok");
		expect(check.cameraAvailable).toBe(true);
		expect(check.lanMode).toBe(false);
	});

	it("takes the worst state of its items", async () => {
		const check = await run(await goodConfig()); // no backup yet: amber
		expect(stateOf(check, "backup")).toBe("warning");
		expect(check.state).toBe("warning");
		const red = await run(await goodConfig(), { request: { ...LAN } });
		expect(red.state).toBe("error");
	});
});

describe("the configuration file", () => {
	it("is valid, or says it is the shipped example when config.json does not exist", async () => {
		const check = await run(await goodConfig());
		expect(finding(check, "config", "valid")?.state).toBe("ok");
		// a folder without config.json starts from the shipped example
		const bare = join(dir, "bare");
		mkdirSync(bare);
		const bareCheck = await run(await goodConfig(), { configDir: bare });
		expect(finding(bareCheck, "config", "example")?.state).toBe("warning");
	});

	it("is red with the loader's messages when the file on disk is refused", async () => {
		writeFileSync(join(dir, "config", "ui.json"), JSON.stringify({ theme: "no-such-theme" }));
		const check = await run(await goodConfig());
		const bad = finding(check, "config", "invalid");
		expect(bad?.state).toBe("error");
		expect(bad?.lines?.[0]).toContain("ui.theme");
		expect(stateOf(check, "config")).toBe("error");
	});

	it("is amber with the loader's warnings, but not for a plain password (the accounts item says it)", async () => {
		const file = join(dir, "config", "config.json");
		const raw = JSON.parse((await Bun.file(file).text()) || "{}") as Record<string, any>;
		raw.metadata = { ...raw.metadata, googleBooksApiKey: "secret" };
		raw.security = {
			...raw.security,
			users: [
				{
					username: "admin",
					roles: ["admin"],
					password: "una-password-vera-1",
					active: true,
				},
			],
		};
		writeFileSync(file, JSON.stringify(raw));
		const check = await run(await goodConfig());
		const warnings = finding(check, "config", "warnings");
		expect(warnings?.state).toBe("warning");
		expect(warnings?.params?.count).toBe(1);
		expect(warnings?.lines?.[0]).toContain("metadata.googleBooksApiKey");
	});

	it("runs the whole check of the folder when asked (a broken report is red)", async () => {
		mkdirSync(join(dir, "config", "reports"), { recursive: true });
		writeFileSync(join(dir, "config", "reports", "broken.json"), "{ not json");
		const light = await run(await goodConfig());
		expect(finding(light, "config", "valid")?.state).toBe("ok");
		const deep = await run(await goodConfig(), { deep: true });
		expect(finding(deep, "config", "invalid")?.lines?.[0]).toContain("reports/broken.json");
	});
});

describe("HTTPS and the host name", () => {
	it("is green over HTTPS", async () => {
		const check = await run(await goodConfig(), { request: HTTPS });
		expect(finding(check, "address", "https")).toMatchObject({
			state: "ok",
			params: { host: "biblioviva.example.ts.net" },
		});
		expect(check.cameraAvailable).toBe(true);
	});

	it.each(["localhost", "127.0.0.1", "127.1.2.3", "[::1]", "app.localhost"])(
		"is not red over plain HTTP on %s: that is this computer itself",
		async (hostname) => {
			expect(isLoopbackHost(hostname)).toBe(true);
			const check = await run(await goodConfig(), {
				request: { protocol: "http:", hostname, host: hostname },
			});
			expect(finding(check, "address", "local")?.state).toBe("ok");
			expect(check.cameraAvailable).toBe(true);
		},
	);

	it("is amber in the local-network mode: plain HTTP is expected, the camera does not work", async () => {
		const check = await run(await goodConfig(), { request: LAN, lanFront: true });
		expect(finding(check, "address", "lan")?.state).toBe("warning");
		expect(check.cameraAvailable).toBe(false);
		expect(check.lanMode).toBe(true);
	});

	it("is red over plain HTTP on a network name outside that mode", async () => {
		const check = await run(await goodConfig(), { request: LAN, lanFront: false });
		expect(finding(check, "address", "plainHttp")?.state).toBe("error");
		expect(stateOf(check, "address")).toBe("error");
		expect(check.cameraAvailable).toBe(false);
		expect(check.lanMode).toBe(false);
		expect(isLoopbackHost("192.168.1.50")).toBe(false);
		expect(isLoopbackHost("biblioviva.local")).toBe(false);
	});

	it("keeps plain HTTP on this computer green in the local-network mode too", async () => {
		const check = await run(await goodConfig(), { request: LOCAL, lanFront: true });
		expect(finding(check, "address", "local")?.state).toBe("ok");
		expect(check.lanMode).toBe(false);
	});
});

describe("the hardware profile", () => {
	it("suggests the strongest profile the computer carries: memory, processors and disk", () => {
		const host = (gb: number, cpus: number, disk: HostResources["disk"]): HostResources => ({
			memoryBytes: gb * GB,
			cpus,
			disk,
		});
		expect(suggestedProfile(host(0.4, 4, "ssd"))).toBe("micro");
		expect(suggestedProfile(PI)).toBe("small");
		// a Raspberry Pi with more memory still reads and writes an SD card
		expect(suggestedProfile(host(7.6, 4, "sd"))).toBe("small");
		expect(suggestedProfile(host(3.8, 1, "ssd"))).toBe("small");
		// an old PC with a spinning disk
		expect(suggestedProfile(host(7.7, 4, "hdd"))).toBe("medium");
		expect(suggestedProfile(host(1.9, 2, "ssd"))).toBe("medium");
		// two processors and 4 GB with an SSD are plenty: BiblioViva is light
		expect(suggestedProfile(host(3.8, 2, "ssd"))).toBe("large");
		expect(suggestedProfile(host(3.8, 2, "unknown"))).toBe("large");
		expect(suggestedProfile(PC)).toBe("large");
	});

	it("names the disk of the data", async () => {
		const sd = await run(await goodConfig(), { host: PI });
		expect(finding(sd, "profile", "diskSd")?.state).toBe("ok");
		const unknown = await run(await goodConfig(), { host: { ...PC, disk: "unknown" } });
		expect(finding(unknown, "profile", "diskUnknown")?.state).toBe("ok");
	});

	it("is green for a profile that fits, with no hint", async () => {
		const check = await run(await goodConfig(), { host: PI });
		expect(finding(check, "profile", "ok")).toMatchObject({
			state: "ok",
			params: { profile: "small", memory: 1.9, cpus: 4 },
		});
		expect(finding(check, "profile", "stronger")).toBeUndefined();
	});

	it("hints, without turning amber, that a stronger computer could use a stronger profile", async () => {
		const check = await run(await goodConfig(), { host: PC });
		expect(finding(check, "profile", "stronger")).toMatchObject({
			state: "ok",
			params: { suggested: "large", memory: 16, cpus: 8 },
		});
		expect(stateOf(check, "profile")).toBe("ok");
		// no hint when the chosen profile is the strongest, or already the suggested one
		const large = await run(
			configWith((raw) => {
				raw.performance.profile = "large";
			}),
			{ host: PC },
		);
		expect(finding(large, "profile", "stronger")).toBeUndefined();
	});

	it("is amber when the profile asks for more memory than the computer has", async () => {
		const config = configWith((raw) => {
			raw.performance.profile = "large";
		});
		const check = await run(config, { host: PI });
		expect(finding(check, "profile", "weaker")).toMatchObject({
			state: "warning",
			params: { profile: "large", needed: 3 },
		});
		expect(stateOf(check, "profile")).toBe("warning");
	});
});

describe("the accounts' passwords", () => {
	it("is green with hashed passwords of their own", async () => {
		const check = await run(await goodConfig());
		expect(finding(check, "accounts", "ok")?.params?.count).toBe(1);
	});

	it("is amber for a password written in clear in the file", async () => {
		const config = configWith((raw) => {
			raw.security.users = [
				{
					username: "admin",
					roles: ["admin"],
					active: true,
					password: "una-password-vera-1",
				},
				{ username: "old", roles: ["circulation"], active: false, password: "non-conta-1" },
			];
		});
		const check = await run(config);
		expect(finding(check, "accounts", "plain")).toMatchObject({
			state: "warning",
			params: { count: 1, names: "admin" },
		});
		expect(finding(check, "accounts", "example")).toBeUndefined();
	});

	it("is red for the example password in clear, amber for another clear one", async () => {
		const config = configWith((raw) => {
			raw.security.users = [
				{ username: "admin", roles: ["admin"], active: true, password: EXAMPLE_PASSWORD },
				{
					username: "prestiti",
					roles: ["circulation"],
					active: true,
					password: "una-password-vera-2",
				},
			];
		});
		const check = await run(config);
		expect(finding(check, "accounts", "example")).toMatchObject({
			state: "error",
			params: { count: 1, names: "admin" },
		});
		expect(finding(check, "accounts", "plain")?.params?.names).toBe("prestiti");
		expect(stateOf(check, "accounts")).toBe("error");
	});

	it.each([EXAMPLE_PASSWORD, DEMO_PASSWORD])(
		"is red for a hash of the published password %s",
		async (password) => {
			const account = await admin(password);
			const config = configWith((raw) => {
				raw.security.users = [account];
			});
			const check = await run(config);
			expect(finding(check, "accounts", "example")?.state).toBe("error");
			expect(finding(check, "accounts", "plain")).toBeUndefined();
		},
	);

	it("does not count an account that is switched off", async () => {
		const config = configWith((raw) => {
			raw.security.users = [
				{
					username: "admin",
					roles: ["admin"],
					active: true,
					password: "una-password-vera-1",
				},
				{
					username: "old",
					roles: ["circulation"],
					active: false,
					password: EXAMPLE_PASSWORD,
				},
			];
		});
		const check = await run(config);
		expect(finding(check, "accounts", "example")).toBeUndefined();
	});
});

describe("the backups", () => {
	it("is green with the schedule and a copy of last night", async () => {
		const name = backupMadeAt(LAST_NIGHT);
		const check = await run(await goodConfig());
		expect(finding(check, "backup", "schedule")).toMatchObject({
			state: "ok",
			params: { cron: "0 3 * * *" },
		});
		expect(finding(check, "backup", "last")).toMatchObject({
			state: "ok",
			params: { name, lastAt: LAST_NIGHT.toISOString() },
		});
	});

	it("counts a backup made at start like any other: the file is all that matters", async () => {
		// the catch-up marks it in the audit log only; the folder holds a plain copy
		backupMadeAt(new Date("2026-11-19T08:01:00Z"));
		const check = await run(await goodConfig());
		expect(finding(check, "backup", "last")?.state).toBe("ok");
	});

	it("is amber until the first backup", async () => {
		const check = await run(await goodConfig());
		expect(finding(check, "backup", "none")?.state).toBe("warning");
	});

	it("is amber for a copy older than the last scheduled run, red after a week", async () => {
		backupMadeAt(new Date("2026-11-17T02:00:30Z"));
		const late = await run(await goodConfig());
		expect(finding(late, "backup", "late")).toMatchObject({
			state: "warning",
			params: { days: 2 },
		});
		// an older copy does not change it: only the newest one counts
		backupMadeAt(new Date("2026-11-01T02:00:30Z"));
		expect(finding(await run(await goodConfig()), "backup", "late")?.params?.days).toBe(2);
	});

	it("is red when the newest copy is a week old or more", async () => {
		backupMadeAt(new Date("2026-11-10T02:00:30Z"));
		const check = await run(await goodConfig());
		expect(finding(check, "backup", "stale")).toMatchObject({
			state: "error",
			params: { days: 9 },
		});
		expect(stateOf(check, "backup")).toBe("error");
	});

	it("does not take an archive of chosen parts for a copy of the database", async () => {
		writeFileSync(join(backups, "biblioviva-20261119-0300.zip"), "x");
		const check = await run(await goodConfig());
		expect(finding(check, "backup", "none")?.state).toBe("warning");
	});

	it("is red when the backups folder cannot be written", async () => {
		const file = join(dir, "not-a-folder");
		writeFileSync(file, "x");
		process.env.BACKUP_DIR = join(file, "backups");
		resetEnvCache();
		const check = await run(await goodConfig());
		expect(finding(check, "backup", "folder")?.state).toBe("error");
		expect(finding(check, "backup", "folder")?.lines?.[0]).toContain("BACKUP_DIR");
	});

	it("is amber when the schedule is not running and red when the expression is not valid", async () => {
		stopBackupSchedule();
		const idle = await run(await goodConfig());
		expect(finding(idle, "backup", "notScheduled")?.state).toBe("warning");
		const config = await goodConfig();
		const invalid = {
			...config,
			backup: { ...config.backup, cron: "not a cron" },
		} as AppConfig;
		expect(finding(await run(invalid), "backup", "scheduleInvalid")?.state).toBe("error");
	});

	it("reports the off-site copy only when it is switched on", async () => {
		backupMadeAt(LAST_NIGHT);
		const off = await run(await goodConfig());
		expect(off.items.find((i) => i.id === "backup")?.findings.map((f) => f.key)).not.toContain(
			"offsiteNone",
		);
		const config = configWith((raw) => {
			raw.security.users = [];
			raw.backup.offsite = { enabled: true, remote: "gdrive:x" };
		});
		expect(finding(await run(config), "backup", "offsiteNone")?.state).toBe("warning");
		const status = (s: string, at: Date): void =>
			writeFileSync(
				join(backups, "offsite.json"),
				JSON.stringify({ status: s, at: at.toISOString() }),
			);
		status("error", NOW);
		expect(finding(await run(config), "backup", "offsiteError")?.state).toBe("warning");
		status("ok", new Date("2026-11-10T00:00:00Z"));
		expect(finding(await run(config), "backup", "offsiteStale")?.state).toBe("warning");
		status("ok", new Date("2026-11-19T01:00:00Z"));
		expect(finding(await run(config), "backup", "offsiteOk")?.state).toBe("ok");
	});
});

describe("the public demo", () => {
	it("keeps no backups, so there is nothing to check", async () => {
		process.env.DEMO_PUBLIC = "1";
		resetEnvCache();
		try {
			const check = await run(await goodConfig());
			expect(check.items.find((i) => i.id === "backup")?.findings).toEqual([
				{ state: "ok", key: "demo" },
			]);
		} finally {
			delete process.env.DEMO_PUBLIC;
			resetEnvCache();
		}
	});
});

describe("the findings that are not green", () => {
	it("are the ones PROBLEM_FINDINGS lists, so each has its guide (the last test of this file)", () => {
		expect([...reported].sort()).toEqual([...PROBLEM_FINDINGS].sort());
	});
});
