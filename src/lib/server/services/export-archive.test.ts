// SPDX-License-Identifier: GPL-3.0-or-later
import { Database } from "bun:sqlite";
import {
	existsSync,
	mkdirSync,
	mkdtempSync,
	readFileSync,
	rmSync,
	utimesSync,
	writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { strFromU8, strToU8, unzipSync, zipSync } from "fflate";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { openDatabase } from "#lib/server/db/client.js";
import { resetEnvCache } from "#lib/server/env.js";
import { runMigrations } from "#lib/server/db/migrate.js";
import { auditLog, staffUser } from "#lib/server/db/schema.js";
import { listFilesRecursive } from "#lib/server/runtime/fs.js";
import { heavyResponse } from "#lib/server/runtime/heavy.js";
import { heavyWork, imageWork } from "#lib/server/runtime/limit.js";
import { backupNow, mirrorUploads, runBackup, summarizeUploads } from "./backup.js";
import {
	createExportStream,
	DB_ENTRY,
	exportArchiveName,
	knownEntry,
	MANIFEST_NAME,
	unpackArchive,
	restoreTarget,
	archiveBackupNow,
	writeArchiveBackup,
	type ExportManifest,
} from "./export-archive.js";
import type { Db } from "#lib/server/db/client.js";

const dirs: string[] = [];
function tempDir(): string {
	const d = mkdtempSync(join(tmpdir(), "bv-export-"));
	dirs.push(d);
	return d;
}
/** The backups folder of each test (`BACKUP_DIR`, a volume of its own, 9.35). */
let backupDir = "";
const savedBackupDir = process.env.BACKUP_DIR;
beforeEach(() => {
	backupDir = tempDir();
	process.env.BACKUP_DIR = backupDir;
	resetEnvCache();
});
afterEach(() => {
	if (savedBackupDir === undefined) {
		delete process.env.BACKUP_DIR;
	} else {
		process.env.BACKUP_DIR = savedBackupDir;
	}
	resetEnvCache();
	for (const d of dirs.splice(0)) {
		rmSync(d, { recursive: true, force: true });
	}
});

function seedData(dataDir: string): Db {
	mkdirSync(join(dataDir, "db"), { recursive: true });
	const db = openDatabase(join(dataDir, "db", "biblioviva.db"));
	runMigrations(db);
	db.insert(staffUser).values({ username: "exported", passwordHash: "x", roles: [] }).run();
	const uploads = join(dataDir, "uploads");
	mkdirSync(join(uploads, "patrons", "01"), { recursive: true });
	mkdirSync(join(uploads, "covers", "02"), { recursive: true });
	writeFileSync(join(uploads, "patrons", "01", "1-main-1.webp"), new Uint8Array(5000).fill(1));
	writeFileSync(join(uploads, "patrons", "01", "1-thumb-1.webp"), new Uint8Array(300).fill(2));
	writeFileSync(join(uploads, "covers", "02", "2-main-1.webp"), new Uint8Array(7000).fill(3));
	writeFileSync(join(uploads, "patrons", "01", "leftover.tmp"), "ignored");
	// a class picture of the census travels with the photos (Phase 13)
	mkdirSync(join(uploads, "class-sheets", "1"), { recursive: true });
	writeFileSync(join(uploads, "class-sheets", "1", "picture-1.jpg"), new Uint8Array(900).fill(4));
	return db;
}

function seedConfig(configDir: string): void {
	mkdirSync(join(configDir, "cards", "templates", "default"), { recursive: true });
	writeFileSync(join(configDir, "config.json"), '{ "library": { "name": "Test" } }\n');
	writeFileSync(
		join(configDir, "cards", "templates", "default", "front.html"),
		"<p>{{name}}</p>",
	);
	writeFileSync(
		join(configDir, "cards", "templates", "default", "logo.png"),
		new Uint8Array(100).fill(9),
	);
}

async function collect(stream: ReadableStream<Uint8Array>): Promise<Uint8Array> {
	const chunks: Uint8Array[] = [];
	let total = 0;
	for await (const chunk of stream) {
		chunks.push(chunk);
		total += chunk.byteLength;
	}
	const out = new Uint8Array(total);
	let offset = 0;
	for (const c of chunks) {
		out.set(c, offset);
		offset += c.byteLength;
	}
	return out;
}

describe("uploads mirror", () => {
	it("copies new and changed files, removes vanished ones, skips temp files", async () => {
		const dataDir = tempDir();
		const db = seedData(dataDir);
		const first = mirrorUploads(dataDir);
		expect(first).toMatchObject({ copied: 4, removed: 0, total: 4, bytes: 13200 });
		const mirror = join(backupDir, "uploads");
		expect(listFilesRecursive(mirror)).toEqual([
			"class-sheets/1/picture-1.jpg",
			"covers/02/2-main-1.webp",
			"patrons/01/1-main-1.webp",
			"patrons/01/1-thumb-1.webp",
		]);
		// unchanged: nothing copied
		expect(mirrorUploads(dataDir)).toMatchObject({ copied: 0, removed: 0, total: 4 });
		// a newer file with the same size is copied again; a removed one disappears from the mirror
		const photo = join(dataDir, "uploads", "patrons", "01", "1-main-1.webp");
		writeFileSync(photo, new Uint8Array(5000).fill(7));
		utimesSync(photo, new Date(), new Date(Date.now() + 5000));
		rmSync(join(dataDir, "uploads", "covers", "02", "2-main-1.webp"));
		expect(mirrorUploads(dataDir)).toMatchObject({ copied: 1, removed: 1, total: 3 });
		expect(readFileSync(join(mirror, "patrons", "01", "1-main-1.webp"))[0]).toBe(7);
		expect(existsSync(join(mirror, "covers", "02", "2-main-1.webp"))).toBe(false);
		expect(summarizeUploads(join(dataDir, "uploads"))).toEqual({
			photos: 3,
			covers: 0,
			other: 0,
			bytes: 6200,
		});
		// the nightly run reports the mirror next to the database copy
		const run = await runBackup(db, dataDir, { timezone: "Europe/Rome", keepDays: 30 });
		expect(run.mirror.total).toBe(3);
		expect(run.backup.name).toMatch(/^biblioviva-\d{8}-\d{4}\.db$/);
		expect(summarizeUploads(join(dataDir, "nope"))).toEqual({
			photos: 0,
			covers: 0,
			other: 0,
			bytes: 0,
		});
	});
});

describe("full export archive", () => {
	it("streams manifest, snapshot, configuration and uploads, and restores them", async () => {
		const dataDir = tempDir();
		const configDir = tempDir();
		const db = seedData(dataDir);
		seedConfig(configDir);
		const now = new Date("2026-09-20T10:05:00Z");
		expect(exportArchiveName(now, "Europe/Rome")).toBe("biblioviva-export-20260920-1205.zip");
		const { stream, manifest } = await createExportStream(db, dataDir, configDir, {
			timezone: "Europe/Rome",
			now,
		});
		expect(manifest).toMatchObject({
			app: "BiblioViva",
			uploads: { photos: 3, covers: 1, other: 0 },
			config: { files: 3 },
		});
		expect(manifest.database.bytes).toBeGreaterThan(0);
		const bytes = await collect(stream);
		// the snapshot is gone once the stream has been sent
		expect(listFilesRecursive(join(dataDir, "tmp"))).toEqual([]);
		const entries = unzipSync(bytes);
		expect(Object.keys(entries).sort()).toEqual([
			"config/cards/templates/default/front.html",
			"config/cards/templates/default/logo.png",
			"config/config.json",
			DB_ENTRY,
			MANIFEST_NAME,
			"uploads/class-sheets/1/picture-1.jpg",
			"uploads/covers/02/2-main-1.webp",
			"uploads/patrons/01/1-main-1.webp",
			"uploads/patrons/01/1-thumb-1.webp",
		]);
		const parsed = JSON.parse(
			strFromU8(entries[MANIFEST_NAME] ?? new Uint8Array()),
		) as ExportManifest;
		expect(parsed.createdAt).toBe(now.toISOString());
		expect(entries["uploads/covers/02/2-main-1.webp"]).toHaveLength(7000);
		// the snapshot is a working database with the data
		const snapshotPath = join(tempDir(), "snap.db");
		writeFileSync(snapshotPath, entries[DB_ENTRY] ?? new Uint8Array());
		const snap = new Database(snapshotPath, { readonly: true });
		expect(snap.query("select username from staff_user").all()).toEqual([
			{ username: "exported" },
		]);
		snap.close();

		// restore into fresh folders
		const zipPath = join(tempDir(), "export.zip");
		writeFileSync(zipPath, bytes);
		const newData = tempDir();
		const newConfig = tempDir();
		mkdirSync(join(newData, "db"), { recursive: true });
		writeFileSync(join(newData, "db", "biblioviva.db-wal"), "stale");
		const result = await unpackArchive(zipPath, newData, newConfig);
		expect(result.files).toBe(8);
		expect(result.manifest.version).toBe(manifest.version);
		expect(listFilesRecursive(newData).sort()).toEqual([
			"db/biblioviva.db",
			"uploads/class-sheets/1/picture-1.jpg",
			"uploads/covers/02/2-main-1.webp",
			"uploads/patrons/01/1-main-1.webp",
			"uploads/patrons/01/1-thumb-1.webp",
		]);
		expect(listFilesRecursive(newConfig).sort()).toEqual([
			"cards/templates/default/front.html",
			"cards/templates/default/logo.png",
			"config.json",
		]);
		expect(readFileSync(join(newConfig, "config.json"), "utf8")).toContain('"Test"');
		const restored = new Database(join(newData, "db", "biblioviva.db"), { readonly: true });
		expect(restored.query("select count(*) as n from staff_user").get()).toEqual({ n: 1 });
		restored.close();

		// the configuration alone (the configuration import): database and uploads left in the zip
		const onlyData = tempDir();
		const onlyConfig = tempDir();
		const config = await unpackArchive(zipPath, onlyData, onlyConfig, { configOnly: true });
		expect(config.files).toBe(3);
		expect(listFilesRecursive(onlyData)).toEqual([]);
		expect(listFilesRecursive(onlyConfig)).toHaveLength(3);
	});

	it("maps entries to their folders and refuses anything else", () => {
		expect(restoreTarget("db/biblioviva.db", "/d", "/c")).toBe("/d/db/biblioviva.db");
		expect(restoreTarget("uploads/covers/02/x.webp", "/d", "/c")).toBe(
			"/d/uploads/covers/02/x.webp",
		);
		expect(restoreTarget("config/cards/default/front.html", "/d", "/c")).toBe(
			"/c/cards/default/front.html",
		);
		expect(restoreTarget(MANIFEST_NAME, "/d", "/c")).toBeNull();
		expect(restoreTarget("../etc/passwd", "/d", "/c")).toBeNull();
		expect(restoreTarget("uploads/../../x", "/d", "/c")).toBeNull();
		expect(restoreTarget("/uploads/x", "/d", "/c")).toBeNull();
		expect(restoreTarget("other/x", "/d", "/c")).toBeNull();
		expect(knownEntry(DB_ENTRY)).toBe(true);
		expect(knownEntry("db/other.db")).toBe(false);
		expect(knownEntry("uploads/covers/02/x.webp")).toBe(true);
		expect(knownEntry("uploads/covers")).toBe(false);
		expect(knownEntry("uploads/tmp/x")).toBe(false);
		expect(knownEntry("config/config.json")).toBe(true);
		expect(knownEntry("config/notes.txt")).toBe(false);
		expect(knownEntry("config.json")).toBe(false);
		expect(restoreTarget("uploads/", "/d", "/c")).toBeNull();
	});

	it("streams a large uploads folder without holding it in memory", async () => {
		const dataDir = tempDir();
		const configDir = tempDir();
		const db = seedData(dataDir);
		seedConfig(configDir);
		const dir = join(dataDir, "uploads", "covers", "99");
		mkdirSync(dir, { recursive: true });
		for (let i = 0; i < 1000; i++) {
			writeFileSync(join(dir, `${i}-main-1.webp`), new Uint8Array(2048).fill(i % 256));
		}
		const before = process.memoryUsage().heapUsed;
		const { stream, manifest } = await createExportStream(db, dataDir, configDir, {
			timezone: "Europe/Rome",
		});
		expect(manifest.uploads.covers).toBe(1001);
		let total = 0;
		let peak = 0;
		for await (const chunk of stream) {
			total += chunk.byteLength;
			peak = Math.max(peak, process.memoryUsage().heapUsed - before);
		}
		expect(total).toBeGreaterThan(1000 * 2048);
		// far below the 2 MB of image data plus the database: chunks are released as they go
		expect(peak).toBeLessThan(64 * 1024 * 1024);
	});
});

/** Makes the deflated data of one entry invalid (a reserved block type), like a damaged download. */
function damage(zip: Uint8Array, name: string): Uint8Array {
	const out = zip.slice();
	const view = new DataView(out.buffer);
	for (let i = 0; i + 30 < out.byteLength; i++) {
		if (view.getUint32(i, true) !== 0x04034b50) {
			continue;
		}
		const nameLength = view.getUint16(i + 26, true);
		const extraLength = view.getUint16(i + 28, true);
		if (strFromU8(out.subarray(i + 30, i + 30 + nameLength)) === name) {
			out[i + 30 + nameLength + extraLength] = 0xff;
			return out;
		}
	}
	throw new Error(`no entry ${name}`);
}

/** Rewrites the unpacked size an entry declares, in its local header and in the directory. */
function declareSize(zip: Uint8Array, size: number): Uint8Array {
	const out = zip.slice();
	const view = new DataView(out.buffer);
	for (let i = 0; i + 4 < out.byteLength; i++) {
		if (view.getUint32(i, true) === 0x04034b50) {
			view.setUint32(i + 22, size, true);
		} else if (view.getUint32(i, true) === 0x02014b50) {
			view.setUint32(i + 24, size, true);
		}
	}
	return out;
}

describe("the full archive is unpacked within limits", () => {
	const write = (bytes: Uint8Array): string => {
		const path = join(tempDir(), "archive.zip");
		writeFileSync(path, bytes);
		return path;
	};
	const manifest = strToU8(JSON.stringify({ app: "BiblioViva", version: "0.9.0", parts: [] }));

	it("refuses an entry declaring gigabytes from a tiny archive before writing anything", async () => {
		const zip = declareSize(
			zipSync({ "uploads/covers/01/a.webp": new Uint8Array(4096) }, { level: 9 }),
			3_000_000_000,
		);
		const dataDir = tempDir();
		const configDir = tempDir();
		await expect(unpackArchive(write(zip), dataDir, configDir)).rejects.toMatchObject({
			code: "too_large",
		});
		expect([...listFilesRecursive(dataDir), ...listFilesRecursive(configDir)]).toEqual([]);
	});

	it("stops an entry that inflates beyond the size it declares, and leaves no part of it", async () => {
		const zip = declareSize(
			zipSync({ "uploads/covers/01/a.webp": new Uint8Array(2_000_000) }, { level: 9 }),
			100,
		);
		const dataDir = tempDir();
		await expect(unpackArchive(write(zip), dataDir, tempDir())).rejects.toMatchObject({
			code: "too_large",
		});
		expect(listFilesRecursive(dataDir)).toEqual([]);
	});

	it("refuses too many entries, links and unsafe paths before writing anything", async () => {
		const many = zipSync({
			[MANIFEST_NAME]: manifest,
			"config/reports/a.json": strToU8("{}"),
			"config/reports/b.json": strToU8("{}"),
		});
		const dataDir = tempDir();
		const configDir = tempDir();
		const limits = {
			maxArchiveBytes: 1e6,
			maxEntries: 2,
			maxFileBytes: 1e6,
			maxTotalBytes: 1e6,
		};
		await expect(
			unpackArchive(write(many), dataDir, configDir, { limits }),
		).rejects.toMatchObject({ code: "too_many_files" });
		const unsafe = zipSync({ "config/../../evil.json": strToU8("{}") });
		await expect(unpackArchive(write(unsafe), dataDir, configDir)).rejects.toMatchObject({
			code: "unsafe_path",
		});
		expect([...listFilesRecursive(dataDir), ...listFilesRecursive(configDir)]).toEqual([]);
	});
});

describe("archive backups, interrupted streams and damaged archives", () => {
	it("writes an archive of the chosen parts into the backups folder, never over another", async () => {
		const dataDir = tempDir();
		const configDir = tempDir();
		const db = seedData(dataDir);
		seedConfig(configDir);
		const options = {
			timezone: "Europe/Rome",
			now: new Date("2026-09-20T10:05:00Z"),
			parts: ["data:covers" as const],
		};
		const first = await writeArchiveBackup(db, dataDir, configDir, options);
		// the button of the backups page: the same archive, audited
		const actor = db
			.insert(staffUser)
			.values({ username: "admin", passwordHash: "x", roles: [] })
			.returning({ id: staffUser.id })
			.get();
		const second = await archiveBackupNow({ db, dataDir, configDir }, options, actor);
		expect(
			db
				.select()
				.from(auditLog)
				.all()
				.filter((r) => r.action === "backup.create")
				.map((r) => [r.entityId, r.details]),
		).toEqual([[second.name, { bytes: second.bytes, parts: ["data:covers"] }]]);
		expect(first.name).toBe("biblioviva-20260920-1205.zip");
		expect(second.name).toBe("biblioviva-20260920-1205-2.zip");
		// no partial file left behind
		expect(listFilesRecursive(backupDir).sort()).toEqual([first.name, second.name].sort());
		// in BACKUP_DIR, nothing in the data volume
		expect(existsSync(join(dataDir, "backups"))).toBe(false);
		const bytes = readFileSync(join(backupDir, first.name));
		expect(first.bytes).toBe(bytes.byteLength);
		expect(first.manifest.parts).toEqual(["data:covers"]);
		expect(second.bytes).toBeGreaterThan(0);
		expect(Object.keys(unzipSync(bytes)).sort()).toEqual([
			MANIFEST_NAME,
			"uploads/covers/02/2-main-1.webp",
		]);
	});

	it("streams an archive in a heavy slot while image work runs, never waiting for a second one", async () => {
		// step 9.32: one heavy job at once on the test configuration (`small`), one image job too
		const dataDir = tempDir();
		const configDir = tempDir();
		const db = seedData(dataDir);
		seedConfig(configDir);
		let finishImage = (): void => undefined;
		const image = imageWork.run(
			() =>
				new Promise<void>((resolve) => {
					finishImage = resolve;
				}),
		);
		expect(imageWork.active).toBe(1);
		// "Esporta tutto" as the server hook answers it: the slot held until the last byte
		const response = await heavyResponse("GET", async () => {
			const { stream } = await createExportStream(db, dataDir, configDir, {
				timezone: "Europe/Rome",
			});
			return new Response(stream);
		});
		expect(heavyWork.active).toBe(1);
		const entries = Object.keys(unzipSync(new Uint8Array(await response.arrayBuffer())));
		expect(entries).toContain(MANIFEST_NAME);
		expect(entries).toContain(DB_ENTRY);
		expect(heavyWork.active).toBe(0);
		// the backups take the slot themselves; the archive they write asks for none
		const actor = db
			.insert(staffUser)
			.values({ username: "admin", passwordHash: "x", roles: [] })
			.returning({ id: staffUser.id })
			.get();
		const archive = await archiveBackupNow(
			{ db, dataDir, configDir },
			{ timezone: "Europe/Rome", parts: ["data:covers"] },
			actor,
		);
		expect(archive.bytes).toBeGreaterThan(0);
		const nightly = await backupNow(
			db,
			dataDir,
			{ timezone: "Europe/Rome", keepDays: 30 },
			null,
		);
		expect(nightly.backup.bytes).toBeGreaterThan(0);
		expect(heavyWork.active).toBe(0);
		// all of it while the image job was still running
		expect(imageWork.active).toBe(1);
		finishImage();
		await image;
		expect(imageWork.active).toBe(0);
	});

	it("removes the database snapshot when the download is cancelled or a file disappears", async () => {
		const dataDir = tempDir();
		const configDir = tempDir();
		const db = seedData(dataDir);
		seedConfig(configDir);
		const options = { timezone: "Europe/Rome" };

		const cancelled = (
			await createExportStream(db, dataDir, configDir, options)
		).stream.getReader();
		expect(listFilesRecursive(join(dataDir, "tmp"))).toHaveLength(1);
		await cancelled.read();
		await cancelled.cancel();
		expect(listFilesRecursive(join(dataDir, "tmp"))).toEqual([]);

		const { stream } = await createExportStream(db, dataDir, configDir, options);
		rmSync(join(dataDir, "uploads", "covers", "02", "2-main-1.webp"));
		await expect(collect(stream)).rejects.toThrow();
		expect(listFilesRecursive(join(dataDir, "tmp"))).toEqual([]);
	});

	it("refuses unknown entries and archives without the manifest, stops at a damaged entry", async () => {
		const manifest = strToU8(
			JSON.stringify({ app: "BiblioViva", version: "0.9.0", parts: [] }),
		);
		const config = strToU8(`{ "library": { "name": "${"Biblioteca ".repeat(50)}" } }`);
		const write = (bytes: Uint8Array): string => {
			const path = join(tempDir(), "archive.zip");
			writeFileSync(path, bytes);
			return path;
		};
		const archive = zipSync(
			{ [MANIFEST_NAME]: manifest, "config/config.json": config },
			{ level: 6 },
		);
		const dataDir = tempDir();
		const configDir = tempDir();
		const result = await unpackArchive(write(archive), dataDir, configDir);
		expect(result).toMatchObject({ files: 1, manifest: { version: "0.9.0" } });
		expect(listFilesRecursive(configDir)).toEqual(["config.json"]);
		expect(listFilesRecursive(dataDir)).toEqual([]);

		const foreign = zipSync({ ...unzipSync(archive), "other/notes.txt": strToU8("not ours") });
		await expect(unpackArchive(write(foreign), tempDir(), tempDir())).rejects.toMatchObject({
			code: "unknown_file",
			detail: "other/notes.txt",
		});
		const noManifest = zipSync({ "config/config.json": config });
		await expect(unpackArchive(write(noManifest), tempDir(), tempDir())).rejects.toMatchObject({
			code: "not_archive",
		});
		await expect(
			unpackArchive(write(damage(archive, "config/config.json")), tempDir(), tempDir()),
		).rejects.toMatchObject({ code: "not_zip" });
		await expect(
			unpackArchive(write(damage(archive, MANIFEST_NAME)), tempDir(), tempDir()),
		).rejects.toThrow();
	});
});
