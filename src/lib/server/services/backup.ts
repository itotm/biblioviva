// SPDX-License-Identifier: GPL-3.0-or-later
// Database backups (PLAN.md step 1.9): `VACUUM INTO` copies in the backups folder (`BACKUP_DIR`, a
// volume of its own, step 9.35), retention by `backup.keepDays`, an in-process cron schedule and
// the off-site status written by the rclone service. Step 1.9b adds the uploads mirror: photos and
// covers are copied incrementally into `BACKUP_DIR/uploads` so the off-site sync carries them too.
// Step 9.33: one backup at start when the scheduled one was missed (a computer switched off at
// night).
import {
	accessSync,
	constants,
	copyFileSync,
	existsSync,
	mkdirSync,
	readdirSync,
	readFileSync,
	rmSync,
	statSync,
	unlinkSync,
} from "node:fs";
import { dirname, join } from "node:path";
import { and, eq, sql } from "drizzle-orm";
import { permissionHint } from "#lib/server/config/permissions.js";
import type { Db } from "#lib/server/db/client.js";
import { auditLog } from "#lib/server/db/schema.js";
import { assertNotDemo, isDemoPublic } from "#lib/server/demo/public.js";
import { env } from "#lib/server/env.js";
import { audit, type AuditActor } from "./audit.js";
import { paintErasedFrames } from "./class-sheet-erasure.js";
import { UPLOAD_FOLDERS } from "./data-parts.js";
import { freeFileName, listFilesRecursive } from "#lib/server/runtime/fs.js";
import { heavyWork } from "#lib/server/runtime/limit.js";
import { previousCronRun } from "#lib/shared/cron.js";
import { fileStamp } from "#lib/shared/dates.js";

/** A database copy (`.db`, the nightly backup) or an archive of chosen parts (`.zip`, 11.12). */
export const BACKUP_NAME = /^biblioviva-\d{8}-\d{4}(-\d+)?\.(db|zip)$/;
export const OFFSITE_FILE = "offsite.json";
/** The off-site copy is considered stale after this many hours. */
export const OFFSITE_STALE_HOURS = 48;

export interface BackupInfo {
	name: string;
	bytes: number;
	/** ISO instant of the file's modification time. */
	createdAt: string;
}

export interface OffsiteStatus {
	/** `ok`, `error` or any word the offsite script reports. */
	status: string;
	at: string;
	stale: boolean;
}

/** The one place that knows where the backups are kept: `BACKUP_DIR` (`/backups` in the image). */
export function backupsDir(): string {
	return env().BACKUP_DIR;
}

/**
 * At start (9.35): the backups folder made if missing and checked for writing. Returns what to log
 * when it cannot be written (a bind mount of the wrong owner, a drive missing), or null. The app
 * keeps serving the desk either way: only the backups wait for the folder.
 */
export function backupsDirProblem(): string | null {
	const dir = backupsDir();
	try {
		mkdirSync(dir, { recursive: true });
		accessSync(dir, constants.W_OK);
		return null;
	} catch (e) {
		return (
			permissionHint(e, dir, "BACKUP_DIR") ??
			`[startup] BACKUP_DIR=${dir} cannot be used: ${(e as Error).message}`
		);
	}
}

/**
 * Consistent copy of the live database (WAL included) with `VACUUM INTO`, which also compacts it.
 * The file is `biblioviva-YYYYMMDD-HHmm.db` in the library time zone; the path is bound as a
 * parameter. Returns the new file's info.
 */
export function createBackup(db: Db, timezone: string, now = new Date()): BackupInfo {
	const dir = backupsDir();
	mkdirSync(dir, { recursive: true });
	// the class upgrade of the public demo needs its backup, but visitors must not fill the disk:
	// one copy at a time (9.17)
	if (isDemoPublic()) {
		for (const b of listBackups()) {
			rmSync(join(dir, b.name), { force: true });
		}
	}
	// two backups in the same minute: a counter instead of failing (VACUUM INTO needs a new file)
	const name = freeFileName(dir, `biblioviva-${fileStamp(now, timezone)}`, ".db");
	const path = join(dir, name);
	db.$client.run("VACUUM INTO ?", [path]);
	const stat = statSync(path);
	return { name, bytes: stat.size, createdAt: stat.mtime.toISOString() };
}

/** Backups newest first. Ignores anything that is not a backup file (e.g. offsite.json). */
export function listBackups(): BackupInfo[] {
	const dir = backupsDir();
	if (!existsSync(dir)) {
		return [];
	}
	return readdirSync(dir)
		.filter((name) => BACKUP_NAME.test(name))
		.map((name) => {
			const stat = statSync(join(dir, name));
			return { name, bytes: stat.size, createdAt: stat.mtime.toISOString() };
		})
		.sort((a, b) => b.createdAt.localeCompare(a.createdAt) || b.name.localeCompare(a.name));
}

/** Absolute path of a backup, or null when the name is not a backup file name (path traversal guard). */
export function backupPath(name: string): string | null {
	if (!BACKUP_NAME.test(name)) {
		return null;
	}
	const path = join(backupsDir(), name);
	return existsSync(path) ? path : null;
}

/** Deletes backups older than `keepDays`; the newest one is always kept. Returns the deleted names. */
export function purgeBackups(keepDays: number, now = new Date()): string[] {
	const cutoff = now.getTime() - keepDays * 24 * 60 * 60 * 1000;
	const all = listBackups();
	const deleted: string[] = [];
	for (const b of all.slice(1)) {
		if (new Date(b.createdAt).getTime() < cutoff) {
			unlinkSync(join(backupsDir(), b.name));
			deleted.push(b.name);
		}
	}
	return deleted;
}

/** Status written by the optional rclone `offsite` service (compose profile), null when absent. */
export function readOffsiteStatus(now = new Date()): OffsiteStatus | null {
	const path = join(backupsDir(), OFFSITE_FILE);
	if (!existsSync(path)) {
		return null;
	}
	try {
		const raw = JSON.parse(readFileSync(path, "utf8")) as { status?: unknown; at?: unknown };
		const at = typeof raw.at === "string" ? raw.at : "";
		const ageHours = (now.getTime() - new Date(at).getTime()) / 3_600_000;
		return {
			status: typeof raw.status === "string" ? raw.status : "error",
			at,
			stale: !at || Number.isNaN(ageHours) || ageHours > OFFSITE_STALE_HOURS,
		};
	} catch {
		return { status: "error", at: "", stale: true };
	}
}

export const UPLOADS_MIRROR = "uploads";

export interface MirrorResult {
	copied: number;
	removed: number;
	/** Files in the mirror after the run. */
	total: number;
	bytes: number;
}

/**
 * Mirrors `DATA_DIR/uploads` into `BACKUP_DIR/uploads`: copies new or changed files (size or
 * modification time differ), removes files that disappeared, leaves the rest untouched — cheap
 * enough to run every night on an SD card.
 */
export function mirrorUploads(dataDir: string): MirrorResult {
	const source = join(dataDir, "uploads");
	const target = join(backupsDir(), UPLOADS_MIRROR);
	mkdirSync(target, { recursive: true });
	const wanted = new Set(listFilesRecursive(source));
	let copied = 0;
	let removed = 0;
	let bytes = 0;
	for (const rel of wanted) {
		const from = join(source, rel);
		const to = join(target, rel);
		const src = statSync(from);
		const dst = existsSync(to) ? statSync(to) : null;
		const same = dst?.size === src.size && dst.mtimeMs >= src.mtimeMs;
		if (!same) {
			mkdirSync(dirname(to), { recursive: true });
			copyFileSync(from, to);
			copied++;
		}
		bytes += src.size;
	}
	for (const rel of listFilesRecursive(target)) {
		if (!wanted.has(rel)) {
			rmSync(join(target, rel), { force: true });
			removed++;
		}
	}
	return { copied, removed, total: wanted.size, bytes };
}

export interface UploadsSummary {
	photos: number;
	covers: number;
	other: number;
	bytes: number;
}

/** What the uploads folder (or its mirror) holds, for the backups page and the export manifest. */
export function summarizeUploads(root: string): UploadsSummary {
	const summary: UploadsSummary = { photos: 0, covers: 0, other: 0, bytes: 0 };
	for (const rel of listFilesRecursive(root)) {
		const part = UPLOAD_FOLDERS[rel.split("/")[0] ?? ""];
		if (part === "photos") {
			summary.photos++;
		} else if (part === "covers") {
			summary.covers++;
		} else {
			summary.other++;
		}
		summary.bytes += statSync(join(root, rel)).size;
	}
	return summary;
}

export interface BackupRunResult {
	backup: BackupInfo;
	deleted: string[];
	mirror: MirrorResult;
}

/**
 * One scheduled or manual run: the faces of removed pupils painted over in the class pictures
 * first (a backup never copies one, Q106), then the database backup, the uploads mirror and the
 * retention.
 */
export async function runBackup(
	db: Db,
	dataDir: string,
	options: { timezone: string; keepDays: number },
	now = new Date(),
): Promise<BackupRunResult> {
	assertNotDemo("backups");
	await paintErasedFrames(db, dataDir);
	const backup = createBackup(db, options.timezone, now);
	const mirror = mirrorUploads(dataDir);
	const deleted = purgeBackups(options.keepDays, now);
	return { backup, deleted, mirror };
}

/**
 * "Esegui backup ora", the nightly job and the backup at start: one run, audited, a heavy job that
 * waits its turn (9.32). `actor` is null for the scheduled run, which the audit marks as such; the
 * backup at start (9.33) is also marked `catchUp`, which the backups page shows.
 */
export async function backupNow(
	db: Db,
	dataDir: string,
	options: { timezone: string; keepDays: number; catchUp?: boolean },
	actor: AuditActor | null,
	now = new Date(),
): Promise<BackupRunResult> {
	const result = await heavyWork.run(() => runBackup(db, dataDir, options, now));
	audit(db, actor, "backup.create", "backup", result.backup.name, {
		bytes: result.backup.bytes,
		deleted: result.deleted.length,
		mirrored: result.mirror.total,
		copied: result.mirror.copied,
		...(actor === null ? { scheduled: true } : {}),
		...(options.catchUp === true ? { catchUp: true } : {}),
	});
	return result;
}

export interface ListedBackup extends BackupInfo {
	/** Made at start because the scheduled one was missed (9.33). */
	catchUp: boolean;
}

/** The backups of the folder, newest first, each marked when it was made at start (9.33). */
export function listBackupsMarked(db: Db): ListedBackup[] {
	const backups = listBackups();
	if (backups.length === 0) {
		return [];
	}
	const atStart = new Set(
		db
			.select({ name: auditLog.entityId })
			.from(auditLog)
			.where(
				and(
					eq(auditLog.action, "backup.create"),
					eq(auditLog.entity, "backup"),
					sql`json_extract(${auditLog.details}, '$.catchUp') = 1`,
				),
			)
			.all()
			.map((r) => r.name),
	);
	return backups.map((b) => ({ ...b, catchUp: atStart.has(b.name) }));
}

/** How long the backup at start waits after the start of the server, so the first pages are not slowed. */
export const CATCH_UP_DELAY_MS = 60_000;

/**
 * The scheduled run that has no backup (9.33): the last time `cron` fired before `now` in
 * `timezone`, when the newest database copy is older than it or there is none; null when that run
 * has its backup or the expression never fired. However many runs were missed, it is one.
 */
export function missedBackupRun(
	cron: string,
	timezone: string,
	newest: Date | null,
	now: Date,
): Date | null {
	const last = previousCronRun(cron, now, timezone);
	if (!last) {
		return null;
	}
	return newest && newest.getTime() >= last.getTime() ? null : last;
}

/** The time of the newest database copy (`.db`, scheduled or manual) of the folder, or null. */
export function newestDatabaseBackup(): Date | null {
	const newest = listBackups().find((b) => b.name.endsWith(".db"));
	return newest ? new Date(newest.createdAt) : null;
}

export interface CatchUpOptions {
	cron: string;
	timezone: string;
	keepDays: number;
	/** `backup.catchUp`. */
	enabled: boolean;
}

/**
 * The backup at start (9.33): one backup through `backupNow` when the last scheduled run was missed;
 * nothing with the setting off or in the public demo, which keeps no backups. Returns the run, or
 * null when none was needed.
 */
export async function catchUpBackup(
	db: Db,
	dataDir: string,
	options: CatchUpOptions,
	now = new Date(),
): Promise<BackupRunResult | null> {
	if (!options.enabled || isDemoPublic()) {
		return null;
	}
	const missed = missedBackupRun(options.cron, options.timezone, newestDatabaseBackup(), now);
	if (!missed) {
		return null;
	}
	return backupNow(
		db,
		dataDir,
		{ timezone: options.timezone, keepDays: options.keepDays, catchUp: true },
		null,
		now,
	);
}

let catchUpTimer: ReturnType<typeof setTimeout> | null = null;

/**
 * Runs `job` once, `delayMs` after the start (the timer never keeps the process alive); a second
 * call while one is waiting does nothing (dev-server re-inits). Returns whether a run was planned.
 */
export function planCatchUpBackup(job: () => unknown, delayMs = CATCH_UP_DELAY_MS): boolean {
	if (catchUpTimer) {
		return false;
	}
	catchUpTimer = setTimeout(() => {
		catchUpTimer = null;
		void job();
	}, delayMs);
	catchUpTimer.unref?.();
	return true;
}

/** Cancels the backup at start still waiting (called on `sveltekit:shutdown`). */
export function cancelCatchUpBackup(): void {
	if (catchUpTimer) {
		clearTimeout(catchUpTimer);
		catchUpTimer = null;
	}
}

interface CronHandle {
	stop(): unknown;
	unref?(): unknown;
}
type CronFactory = (
	schedule: string,
	handler: () => unknown,
	options?: { tz?: string },
) => CronHandle;

let scheduled: { handle: CronHandle; key: string } | null = null;

/**
 * Starts (or restarts, when the expression/zone changed) the in-process daily job. Idempotent, so
 * dev-server re-inits and config reloads never stack jobs. Returns whether a new job was created.
 */
export function installBackupSchedule(
	cron: string,
	timezone: string,
	job: () => unknown,
	factory: CronFactory = (s, h, o) => Bun.cron(s, h, o),
): boolean {
	const key = `${cron}@${timezone}`;
	if (scheduled?.key === key) {
		return false;
	}
	scheduled?.handle.stop();
	const handle = factory(cron, job, { tz: timezone });
	handle.unref?.();
	scheduled = { handle, key };
	return true;
}

/** Stops the scheduled job (called on `sveltekit:shutdown`). */
export function stopBackupSchedule(): void {
	scheduled?.handle.stop();
	scheduled = null;
}

export function isBackupScheduled(): boolean {
	return scheduled !== null;
}
