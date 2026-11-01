// SPDX-License-Identifier: GPL-3.0-or-later
import {
	existsSync,
	mkdirSync,
	mkdtempSync,
	readdirSync,
	readFileSync,
	rmSync,
	writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { sql } from "drizzle-orm";
import { strToU8, unzipSync, zipSync } from "fflate";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { getConfig, resetConfigCache } from "#lib/server/config/index.js";
import type { ServerContext } from "#lib/server/context.js";
import { openDatabase, type Db } from "#lib/server/db/client.js";
import { runMigrations } from "#lib/server/db/migrate.js";
import { biblio, patron, staffUser } from "#lib/server/db/schema.js";
import { resetEnvCache } from "#lib/server/env.js";
import { backupPath, createBackup } from "./backup.js";
import { catalogRules, createBiblio } from "./catalog.js";
import { setUiTheme } from "../../../../tests/helpers/config.js";
import { partsIn } from "./config-parts.js";
import { createExportStream } from "./export-archive.js";
import {
	applyRestore,
	checkRestore,
	discardRestore,
	RestoreNotReadyError,
	stageRestore,
	stageUploadedRestore,
} from "./full-restore.js";
import { createPatron } from "./patrons.js";
import { PATRON_RULES } from "../../../../tests/helpers/school.js";

let root = "";
let dataDir = "";
let configDir = "";
const previous = process.env.CONFIG_DIR;
const previousBackups = process.env.BACKUP_DIR;
beforeEach(() => {
	root = mkdtempSync(join(tmpdir(), "bv-full-restore-"));
	dataDir = join(root, "data");
	configDir = join(root, "config");
	process.env.CONFIG_DIR = configDir;
	// the backups volume (9.35), beside the data volume as in the container
	process.env.BACKUP_DIR = join(root, "backups");
	resetEnvCache();
	resetConfigCache();
	setUiTheme(configDir, "ocean");
});
afterEach(() => {
	process.env.CONFIG_DIR = previous;
	if (previousBackups === undefined) {
		delete process.env.BACKUP_DIR;
	} else {
		process.env.BACKUP_DIR = previousBackups;
	}
	resetEnvCache();
	resetConfigCache();
	rmSync(root, { recursive: true, force: true });
});

function database(): { db: Db; actor: { id: number } } {
	mkdirSync(join(dataDir, "db"), { recursive: true });
	const db = openDatabase(join(dataDir, "db", "biblioviva.db"));
	runMigrations(db);
	const actor = db
		.insert(staffUser)
		.values({ username: "admin", passwordHash: "x", roles: ["admin"] })
		.returning({ id: staffUser.id })
		.get();
	return { db, actor };
}

function addBook(db: Db, actor: { id: number }, title: string): void {
	createBiblio(
		db,
		{
			title,
			subtitle: "",
			originalTitle: "",
			responsibility: "",
			author: "Rossi, Anna",
			publisher: "Einaudi",
			publicationPlace: "",
			publicationYear: "",
			isbn: "",
			issn: "",
			ean: "",
			physicalDescription: "",
			series: "",
			seriesNumber: "",
			dewey: "",
			kind: "fiction",
			genreCode: "B",
			classCode: "",
			readingLevel: "",
			subjects: "",
			notes: "",
		},
		actor,
		catalogRules(getConfig()),
	);
}

async function exportTo(db: Db, parts?: string[]): Promise<string> {
	const { stream } = await createExportStream(db, dataDir, configDir, {
		timezone: "Europe/Rome",
		parts: parts as never,
	});
	const bytes = new Uint8Array(await new Response(stream).arrayBuffer());
	const path = join(root, `export-${Math.random().toString(16).slice(2)}.zip`);
	writeFileSync(path, bytes);
	return path;
}

const titles = (db: Db): string[] =>
	db
		.select({ t: biblio.title })
		.from(biblio)
		.all()
		.map((r) => r.t);
const patrons = (db: Db): number =>
	db
		.select({ n: sql<number>`count(*)` })
		.from(patron)
		.get()?.n ?? 0;
/** The context of a request over the test folders. */
const context = (db: Db): Pick<ServerContext, "db" | "configDir" | "dataDir"> => ({
	db,
	configDir,
	dataDir,
});

describe("full restore", () => {
	it("exports only the catalogue and restores it, patrons and settings untouched", async () => {
		const { db, actor } = database();
		addBook(db, actor, "Nell'archivio");
		mkdirSync(join(dataDir, "uploads", "covers", "01"), { recursive: true });
		writeFileSync(join(dataDir, "uploads", "covers", "01", "1-main-1.jpg"), "copertina");
		const archive = await exportTo(db, ["data:catalog", "data:covers", "config:cardTemplates"]);
		const names = Object.keys(unzipSync(new Uint8Array(readFileSync(archive))));
		expect(names.some((n) => n.startsWith("config/labels/"))).toBe(false);
		expect(names).toContain("uploads/covers/01/1-main-1.jpg");

		// afterwards: another book, a patron, a changed template and setting, the cover gone
		addBook(db, actor, "Dopo");
		createPatron(
			db,
			{
				patronType: "teacher",
				firstName: "Bruno",
				lastName: "Verdi",
				levelCode: "",
				groupId: "",
				groupName: "",
				cardNumber: "",
				externalId: "",
				email: "",
				circulationNote: "",
				notes: "",
			},
			actor,
			PATRON_RULES,
		);
		const front = join(configDir, "cards/templates/default/front.html");
		const original = readFileSync(front, "utf8");
		writeFileSync(front, '<div class="face front">cambiato</div>');
		rmSync(join(dataDir, "uploads", "covers"), { recursive: true, force: true });

		// an archive uploaded from another computer: staged the same way, the upload not kept
		const token = await stageUploadedRestore(
			dataDir,
			new Uint8Array(readFileSync(archive)),
			"export.zip",
		);
		expect(readdirSync(join(dataDir, "tmp")).filter((f) => f.startsWith("upload-"))).toEqual(
			[],
		);
		const check = await checkRestore(context(db), token);
		expect(check.available).toEqual(["data:catalog", "data:covers", "config:cardTemplates"]);
		expect(check.ready).toBe(true);
		expect(check.data.counts.catalog).toEqual({ live: 2, archive: 1 });
		const { change } = await applyRestore(context(db), token, check.selected, actor);
		expect(titles(db)).toEqual(["Nell'archivio"]);
		expect(patrons(db)).toBe(1);
		expect(readFileSync(front, "utf8")).toBe(original);
		expect(change?.action).toBe("config.restore");
		expect(existsSync(join(dataDir, "uploads", "covers", "01", "1-main-1.jpg"))).toBe(true);
	});

	it("restores a configuration-only archive: it offers only the configuration parts", async () => {
		const { db, actor } = database();
		addBook(db, actor, "Resta");
		// "Esporta configurazione": the configuration parts in the same format
		const archive = await exportTo(db, partsIn(configDir));
		expect(
			Object.keys(unzipSync(new Uint8Array(readFileSync(archive)))).some(
				(n) => n.startsWith("db/") || n.startsWith("uploads/"),
			),
		).toBe(false);
		setUiTheme(configDir, "grape");
		resetConfigCache();

		const token = await stageRestore(dataDir, archive, "biblioviva-configurazione.zip");
		const check = await checkRestore(context(db), token);
		expect(check.source).toMatchObject({ kind: "archive" });
		expect(check.available).toEqual(partsIn(configDir));
		expect(check.available.some((p) => p.startsWith("data:"))).toBe(false);
		expect(check.config?.sections).toEqual(["ui"]);
		expect(check.ready).toBe(true);
		const { change } = await applyRestore(context(db), token, check.selected, actor);
		expect(change?.action).toBe("config.restore");
		expect(getConfig().ui.theme).toBe("ocean");
		expect(titles(db)).toEqual(["Resta"]);
	});

	it("refuses an archive that is not BiblioViva's, keeping nothing staged", async () => {
		database();
		const path = join(root, "other.zip");
		writeFileSync(path, zipSync({ "notes.txt": strToU8("not ours") }));
		await expect(stageRestore(dataDir, path, "other.zip")).rejects.toMatchObject({
			code: "unknown_file",
		});
		expect(readdirSync(join(dataDir, "tmp", "restore"))).toEqual([]);
	});

	it("restores the data of a database backup and refuses what breaks references", async () => {
		const { db, actor } = database();
		addBook(db, actor, "Nel backup");
		const backup = join(root, "biblioviva-20260925-0300.db");
		db.$client.run("VACUUM INTO ?", [backup]);
		addBook(db, actor, "Dopo il backup");

		const token = await stageRestore(dataDir, backup, "biblioviva-20260925-0300.db");
		const check = await checkRestore(context(db), token, ["data:catalog"]);
		expect(check.source.kind).toBe("database");
		expect(check.available).toContain("data:loans");
		expect(check.available.some((p) => !p.startsWith("data:"))).toBe(false);
		await applyRestore(context(db), token, ["data:catalog"], actor);
		expect(titles(db)).toEqual(["Nel backup"]);

		// nothing chosen: not ready
		const again = await stageRestore(dataDir, backup, "biblioviva-20260925-0300.db");
		await expect(applyRestore(context(db), again, [], actor)).rejects.toThrow(
			RestoreNotReadyError,
		);
		discardRestore(dataDir, again);
		await expect(checkRestore(context(db), again)).rejects.toThrow(RestoreNotReadyError);
	});

	it("restores a backup of the backups folder (BACKUP_DIR, 9.35), as the backups page does", async () => {
		const { db, actor } = database();
		addBook(db, actor, "Nel backup");
		const backup = createBackup(db, "Europe/Rome", new Date("2026-10-26T08:00:00Z"));
		addBook(db, actor, "Dopo il backup");
		// the name of the list resolves in the backups volume, never in the data volume
		const path = backupPath(backup.name);
		expect(path).toBe(join(root, "backups", backup.name));
		expect(existsSync(join(dataDir, "backups"))).toBe(false);
		const token = await stageRestore(dataDir, path ?? "", backup.name);
		const check = await checkRestore(context(db), token, ["data:catalog"]);
		expect(check.source.kind).toBe("database");
		await applyRestore(context(db), token, ["data:catalog"], actor);
		expect(titles(db)).toEqual(["Nel backup"]);
		// the backup stays where it was
		expect(existsSync(join(root, "backups", backup.name))).toBe(true);
	});
});
