// SPDX-License-Identifier: GPL-3.0-or-later
import { Database } from "bun:sqlite";
import {
	chmodSync,
	existsSync,
	mkdirSync,
	mkdtempSync,
	readdirSync,
	rmSync,
	utimesSync,
	writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { openDatabase } from "#lib/server/db/client.js";
import { runMigrations } from "#lib/server/db/migrate.js";
import { auditLog, staffUser } from "#lib/server/db/schema.js";
import { resetEnvCache } from "#lib/server/env.js";
import { heavyWork } from "#lib/server/runtime/limit.js";
import { eq } from "drizzle-orm";
import {
	backupNow,
	backupPath,
	backupsDir,
	backupsDirProblem,
	CATCH_UP_DELAY_MS,
	cancelCatchUpBackup,
	catchUpBackup,
	createBackup,
	installBackupSchedule,
	isBackupScheduled,
	listBackups,
	listBackupsMarked,
	missedBackupRun,
	newestDatabaseBackup,
	planCatchUpBackup,
	purgeBackups,
	readOffsiteStatus,
	runBackup,
	stopBackupSchedule,
	summarizeUploads,
	UPLOADS_MIRROR,
} from "./backup.js";

const dirs: string[] = [];
function tempDir(): string {
	const d = mkdtempSync(join(tmpdir(), "bv-backup-"));
	dirs.push(d);
	return d;
}

/** The backups folder of the test (`BACKUP_DIR`), never inside the data folder (9.35). */
let backupDir = "";
const savedBackupDir = process.env.BACKUP_DIR;
function useBackupDir(dir: string): string {
	process.env.BACKUP_DIR = dir;
	resetEnvCache();
	backupDir = dir;
	return dir;
}
beforeEach(() => {
	useBackupDir(tempDir());
});
afterEach(() => {
	if (savedBackupDir === undefined) {
		delete process.env.BACKUP_DIR;
	} else {
		process.env.BACKUP_DIR = savedBackupDir;
	}
	resetEnvCache();
	stopBackupSchedule();
	cancelCatchUpBackup();
	vi.useRealTimers();
	vi.restoreAllMocks();
	for (const d of dirs.splice(0)) {
		rmSync(d, { recursive: true, force: true });
	}
});

describe("backup service", () => {
	it("creates a consistent copy that reopens read-only, then applies retention", async () => {
		const dataDir = tempDir();
		mkdirSync(join(dataDir, "db"));
		const db = openDatabase(join(dataDir, "db", "biblioviva.db"));
		runMigrations(db);
		db.insert(staffUser)
			.values({ username: "admin", passwordHash: "x", roles: ["admin"] })
			.run();

		const now = new Date("2026-09-19T10:00:00Z");
		const first = createBackup(db, "Europe/Rome", now);
		expect(first.name).toBe("biblioviva-20260919-1200.db");
		expect(first.bytes).toBeGreaterThan(0);
		// same minute again → suffix instead of a failure
		const second = createBackup(db, "Europe/Rome", now);
		expect(second.name).toBe("biblioviva-20260919-1200-2.db");

		const copy = new Database(backupPath(first.name)!, { readonly: true });
		expect(copy.query("select count(*) as n from staff_user").get()).toEqual({ n: 1 });
		expect(copy.query("pragma journal_mode").get()).toEqual({ journal_mode: "delete" });
		copy.close();

		expect(backupPath("../db/biblioviva.db")).toBeNull();
		expect(backupPath("biblioviva-20990101-0000.db")).toBeNull();
		expect(listBackups().map((b) => b.name)).toEqual([second.name, first.name]);

		// retention: age the first file by 40 days; the newest is always kept
		const old = new Date(now.getTime() - 40 * 86_400_000);
		const older = new Date(old.getTime() - 1000);
		utimesSync(join(backupDir, first.name), older, older);
		utimesSync(join(backupDir, second.name), old, old);
		expect(purgeBackups(30, now)).toEqual([first.name]);
		expect(listBackups().map((b) => b.name)).toEqual([second.name]);

		const run = await runBackup(
			db,
			dataDir,
			{ timezone: "Europe/Rome", keepDays: 30 },
			new Date("2026-09-20T10:00:00Z"),
		);
		expect(run.backup.name).toBe("biblioviva-20260920-1200.db");
		expect(run.deleted).toEqual([second.name]);
		db.$client.close();
	});

	it("lists nothing for a missing folder and reads the off-site status", () => {
		const missing = useBackupDir(join(tempDir(), "missing"));
		expect(listBackups()).toEqual([]);
		expect(readOffsiteStatus()).toBeNull();
		mkdirSync(missing);
		const now = new Date("2026-09-19T10:00:00Z");
		writeFileSync(
			join(missing, "offsite.json"),
			JSON.stringify({ status: "ok", at: "2026-09-19T04:00:00+02:00" }),
		);
		expect(readOffsiteStatus(now)).toEqual({
			status: "ok",
			at: "2026-09-19T04:00:00+02:00",
			stale: false,
		});
		writeFileSync(
			join(missing, "offsite.json"),
			JSON.stringify({ status: "error", at: "2026-09-10T04:00:00+02:00" }),
		);
		expect(readOffsiteStatus(now)?.stale).toBe(true);
		writeFileSync(join(missing, "offsite.json"), "not json");
		expect(readOffsiteStatus(now)).toEqual({ status: "error", at: "", stale: true });
	});

	it("installs the schedule once, restarts it when the expression changes and stops it", () => {
		const stop = vi.fn();
		const unref = vi.fn();
		const factory = vi.fn(() => ({ stop, unref }));
		const job = vi.fn();
		expect(installBackupSchedule("0 3 * * *", "Europe/Rome", job, factory)).toBe(true);
		expect(installBackupSchedule("0 3 * * *", "Europe/Rome", job, factory)).toBe(false);
		expect(factory).toHaveBeenCalledTimes(1);
		expect(factory).toHaveBeenCalledWith("0 3 * * *", job, { tz: "Europe/Rome" });
		expect(unref).toHaveBeenCalledOnce();
		expect(installBackupSchedule("0 4 * * *", "Europe/Rome", job, factory)).toBe(true);
		expect(stop).toHaveBeenCalledOnce();
		expect(isBackupScheduled()).toBe(true);
		stopBackupSchedule();
		expect(stop).toHaveBeenCalledTimes(2);
		expect(isBackupScheduled()).toBe(false);
	});

	it("uses Bun.cron by default", () => {
		expect(installBackupSchedule("0 3 * * *", "Europe/Rome", () => undefined)).toBe(true);
		expect(isBackupScheduled()).toBe(true);
	});
});

describe("the backup at start when the scheduled one was missed (9.33)", () => {
	const TZ = "Europe/Rome";
	const DAILY = "0 3 * * *";
	const at = (iso: string): Date => new Date(iso);

	function database(): { db: ReturnType<typeof openDatabase>; dataDir: string } {
		const dataDir = tempDir();
		mkdirSync(join(dataDir, "db"));
		const db = openDatabase(join(dataDir, "db", "biblioviva.db"));
		runMigrations(db);
		return { db, dataDir };
	}

	/** A backup file of the folder dated `iso` (its modification time). */
	function oldBackup(name: string, iso: string): void {
		const path = join(backupDir, name);
		writeFileSync(path, "x");
		utimesSync(path, at(iso), at(iso));
	}

	it("finds the last run of a daily expression that has no backup", () => {
		// Monday 28 September 2026, 08:00 in Rome: the run of 03:00 that day
		const now = at("2026-09-28T06:00:00Z");
		expect(missedBackupRun(DAILY, TZ, null, now)?.toISOString()).toBe(
			"2026-09-28T01:00:00.000Z",
		);
		// the newest backup is from the night before: missed
		expect(missedBackupRun(DAILY, TZ, at("2026-09-27T01:02:00Z"), now)).not.toBeNull();
		// made at that run, or after it (a manual backup in the morning): nothing missed
		expect(missedBackupRun(DAILY, TZ, at("2026-09-28T01:00:30Z"), now)).toBeNull();
		expect(missedBackupRun(DAILY, TZ, at("2026-09-28T05:00:00Z"), now)).toBeNull();
		// before 3 in the morning the expected run is yesterday's
		expect(
			missedBackupRun(DAILY, TZ, at("2026-09-27T01:00:30Z"), at("2026-09-28T00:30:00Z")),
		).toBeNull();
		// an expression that is not valid never fires
		expect(missedBackupRun("nope", TZ, null, now)).toBeNull();
	});

	it("follows a weekly expression, the time zone and the change to winter time", () => {
		// Fridays at 18:00: on Monday 28 September the expected run is Friday 25
		const weekly = "0 18 * * 5";
		const monday = at("2026-09-28T06:00:00Z");
		expect(missedBackupRun(weekly, TZ, at("2026-09-25T16:05:00Z"), monday)).toBeNull();
		expect(missedBackupRun(weekly, TZ, at("2026-09-18T16:05:00Z"), monday)?.toISOString()).toBe(
			"2026-09-25T16:00:00.000Z",
		);
		// the same instant read in another zone: 03:00 in New York has not come yet
		expect(
			missedBackupRun(DAILY, "America/New_York", at("2026-09-27T07:01:00Z"), monday),
		).toBeNull();
		// Sunday 25 October 2026, winter time: 03:00 in Rome is 02:00 UTC; a backup at 01:30 UTC
		// (02:30 summer time) is before the run
		const sunday = at("2026-10-25T08:00:00Z");
		expect(missedBackupRun(DAILY, TZ, at("2026-10-25T01:30:00Z"), sunday)?.toISOString()).toBe(
			"2026-10-25T02:00:00.000Z",
		);
		expect(missedBackupRun(DAILY, TZ, at("2026-10-25T02:00:40Z"), sunday)).toBeNull();
	});

	it("makes one backup, through the shared run, after several days off", async () => {
		const { db, dataDir } = database();
		// the last backup on Thursday night; the computer off until Monday morning
		oldBackup("biblioviva-20260924-0300.db", "2026-09-24T01:00:20Z");
		// an archive of chosen parts is not a database copy and does not count
		oldBackup("biblioviva-20260927-1000.zip", "2026-09-27T08:00:00Z");
		expect(newestDatabaseBackup()?.toISOString()).toBe("2026-09-24T01:00:20.000Z");
		const heavy = vi.spyOn(heavyWork, "run");
		const now = at("2026-09-28T06:01:00Z");
		const options = { cron: DAILY, timezone: TZ, keepDays: 30, enabled: true };
		const run = await catchUpBackup(db, dataDir, options, now);
		expect(run?.backup.name).toBe("biblioviva-20260928-0801.db");
		// the limiter of heavy jobs (9.32) and the audit of backupNow, marked as made at start
		expect(heavy).toHaveBeenCalledOnce();
		const rows = db.select().from(auditLog).where(eq(auditLog.action, "backup.create")).all();
		expect(rows).toHaveLength(1);
		expect(rows[0]?.details).toMatchObject({ scheduled: true, catchUp: true });
		// one only: a second start the same morning finds it
		expect(await catchUpBackup(db, dataDir, options, at("2026-09-28T07:00:00Z"))).toBeNull();
		expect(listBackups().filter((b) => b.name.endsWith(".db"))).toHaveLength(2);
		db.$client.close();
	});

	it("makes one when there is no backup at all, none with the setting off or in the public demo", async () => {
		const { db, dataDir } = database();
		const now = at("2026-09-28T06:01:00Z");
		const options = { cron: DAILY, timezone: TZ, keepDays: 30, enabled: false };
		expect(await catchUpBackup(db, dataDir, options, now)).toBeNull();
		expect(listBackups()).toEqual([]);

		const saved = process.env.DEMO_PUBLIC;
		process.env.DEMO_PUBLIC = "1";
		resetEnvCache();
		try {
			// no error: the demo keeps no backups, the run is not even tried
			expect(await catchUpBackup(db, dataDir, { ...options, enabled: true }, now)).toBeNull();
		} finally {
			if (saved === undefined) {
				delete process.env.DEMO_PUBLIC;
			} else {
				process.env.DEMO_PUBLIC = saved;
			}
			resetEnvCache();
		}
		expect(listBackups()).toEqual([]);

		const run = await catchUpBackup(db, dataDir, { ...options, enabled: true }, now);
		expect(run?.backup.name).toBe("biblioviva-20260928-0801.db");
		db.$client.close();
	});

	it("waits a minute after the start, once, and can be cancelled", () => {
		vi.useFakeTimers();
		expect(CATCH_UP_DELAY_MS).toBe(60_000);
		const job = vi.fn();
		expect(planCatchUpBackup(job)).toBe(true);
		// a second start of the hooks while one waits: nothing more
		expect(planCatchUpBackup(job)).toBe(false);
		vi.advanceTimersByTime(CATCH_UP_DELAY_MS - 1);
		expect(job).not.toHaveBeenCalled();
		vi.advanceTimersByTime(1);
		expect(job).toHaveBeenCalledOnce();
		// cancelled before its time (the server stops): never runs
		const late = vi.fn();
		expect(planCatchUpBackup(late, 5000)).toBe(true);
		cancelCatchUpBackup();
		vi.advanceTimersByTime(10_000);
		expect(late).not.toHaveBeenCalled();
	});

	it("marks in the list the backups made at start", async () => {
		const { db, dataDir } = database();
		expect(listBackupsMarked(db)).toEqual([]);
		const options = { cron: DAILY, timezone: TZ, keepDays: 30, enabled: true };
		const first = await catchUpBackup(db, dataDir, options, at("2026-09-28T06:01:00Z"));
		const manual = createBackup(db, TZ, at("2026-09-28T09:00:00Z"));
		const list = listBackupsMarked(db);
		expect(list.map((b) => [b.name, b.catchUp])).toEqual(
			expect.arrayContaining([
				[first?.backup.name, true],
				[manual.name, false],
			]),
		);
		db.$client.close();
	});
});

describe("the backups folder is BACKUP_DIR, a volume of its own (9.35)", () => {
	function library(): { db: ReturnType<typeof openDatabase>; dataDir: string; admin: number } {
		const dataDir = tempDir();
		mkdirSync(join(dataDir, "db"));
		const db = openDatabase(join(dataDir, "db", "biblioviva.db"));
		runMigrations(db);
		const admin = db
			.insert(staffUser)
			.values({ username: "admin", passwordHash: "x", roles: ["admin"] })
			.returning({ id: staffUser.id })
			.get().id;
		const photo = join(dataDir, "uploads", "patrons", "01");
		mkdirSync(photo, { recursive: true });
		writeFileSync(join(photo, "1.jpg"), "a photo");
		return { db, dataDir, admin };
	}

	it("is the folder of the environment", () => {
		expect(backupsDir()).toBe(backupDir);
		useBackupDir("/backups");
		expect(backupsDir()).toBe("/backups");
	});

	it("receives the scheduled and the manual backups, the pictures, the retention and the list", async () => {
		const { db, dataDir, admin } = library();
		const options = { timezone: "Europe/Rome", keepDays: 30 };
		// the nightly run (no actor) and "Esegui backup ora" (an administrator)
		const scheduled = await backupNow(
			db,
			dataDir,
			options,
			null,
			new Date("2026-09-01T01:00:00Z"),
		);
		const manual = await backupNow(
			db,
			dataDir,
			options,
			{ id: admin },
			new Date("2026-10-26T08:00:00Z"),
		);
		expect(readdirSync(backupDir).sort()).toEqual([
			scheduled.backup.name,
			manual.backup.name,
			UPLOADS_MIRROR,
		]);
		// the copy of the pictures beside them
		expect(summarizeUploads(join(backupDir, UPLOADS_MIRROR)).photos).toBe(1);
		// listed, downloaded and restored from there; a name outside the pattern never reaches a file
		expect(listBackups().map((b) => b.name)).toEqual([
			manual.backup.name,
			scheduled.backup.name,
		]);
		expect(listBackupsMarked(db).map((b) => b.name)).toEqual([
			manual.backup.name,
			scheduled.backup.name,
		]);
		expect(backupPath(manual.backup.name)).toBe(join(backupDir, manual.backup.name));
		expect(backupPath("../data/db/biblioviva.db")).toBeNull();
		// retention removes the old copy from the folder
		utimesSync(
			join(backupDir, scheduled.backup.name),
			new Date("2026-09-01T01:00:00Z"),
			new Date("2026-09-01T01:00:00Z"),
		);
		expect(purgeBackups(30, new Date("2026-10-26T09:00:00Z"))).toEqual([scheduled.backup.name]);
		expect(existsSync(join(backupDir, scheduled.backup.name))).toBe(false);
		// nothing in the data volume
		expect(existsSync(join(dataDir, "backups"))).toBe(false);
		db.$client.close();
	});

	it("reads the off-site state there and finds the missed run there", async () => {
		const { db, dataDir } = library();
		writeFileSync(
			join(backupDir, "offsite.json"),
			JSON.stringify({ status: "ok", at: "2026-10-26T04:00:00+01:00" }),
		);
		expect(readOffsiteStatus(new Date("2026-10-26T08:00:00Z"))?.status).toBe("ok");
		// a database copy left in the data volume is not a backup: the catch-up still runs
		mkdirSync(join(dataDir, "backups"));
		writeFileSync(join(dataDir, "backups", "biblioviva-20261026-0300.db"), "x");
		const now = new Date("2026-10-26T08:00:00Z");
		const options = { cron: "0 3 * * *", timezone: "Europe/Rome", keepDays: 30, enabled: true };
		const run = await catchUpBackup(db, dataDir, options, now);
		expect(run?.backup.name).toBe("biblioviva-20261026-0900.db");
		expect(newestDatabaseBackup()?.getTime()).toBeGreaterThan(0);
		expect(existsSync(join(backupDir, "biblioviva-20261026-0900.db"))).toBe(true);
		expect(existsSync(join(backupDir, UPLOADS_MIRROR, "patrons", "01", "1.jpg"))).toBe(true);
		db.$client.close();
	});

	it("is made at start when missing, and a folder that cannot be written is told", () => {
		const fresh = useBackupDir(join(tempDir(), "backups"));
		expect(backupsDirProblem()).toBeNull();
		expect(existsSync(fresh)).toBe(true);
		const locked = useBackupDir(tempDir());
		chmodSync(locked, 0o500);
		try {
			const problem = backupsDirProblem();
			// root writes anywhere: the check only means something for another user
			if (process.getuid?.() !== 0) {
				expect(problem).toContain(`BACKUP_DIR=${locked} cannot be written`);
				expect(problem).toContain("chown -R 1000:1000");
			}
		} finally {
			chmodSync(locked, 0o700);
		}
	});
});
