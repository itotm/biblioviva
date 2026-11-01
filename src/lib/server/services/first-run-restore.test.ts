// SPDX-License-Identifier: GPL-3.0-or-later
import { mkdirSync, mkdtempSync, readdirSync, rmSync, writeFileSync, existsSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { eq } from "drizzle-orm";
import { strFromU8, strToU8, unzipSync, zipSync } from "fflate";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { getConfig, resetConfigCache } from "#lib/server/config/index.js";
import { loadConfig } from "#lib/server/config/load.js";
import type { ServerContext } from "#lib/server/context.js";
import { openDatabase, type Db } from "#lib/server/db/client.js";
import { runMigrations } from "#lib/server/db/migrate.js";
import { auditLog, biblio, patron, staffUser } from "#lib/server/db/schema.js";
import { resetEnvCache } from "#lib/server/env.js";
import { APP_VERSION } from "#lib/shared/version.js";
import { PATRON_RULES } from "../../../../tests/helpers/school.js";
import { catalogRules, createBiblio } from "./catalog.js";
import { createExportStream, ArchiveReadError } from "./export-archive.js";
import {
	applyFirstRunRestore,
	checkFirstRunRestore,
	discardFirstRunRestore,
	FirstRunRestoreError,
	isNewerVersion,
} from "./first-run-restore.js";
import { RestoreNotReadyError } from "./full-restore.js";
import { createPatron } from "./patrons.js";
import { isSetupMode, WIZARD_ACCOUNTS, writeSetupConfig, type SetupInput } from "./setup.js";

const hashes = Object.fromEntries(
	WIZARD_ACCOUNTS.map((a, i) => [a, `$argon2id$v=19$m=65536,t=2,p=1$${i}$${i}`]),
) as SetupInput["passwordHashes"];

const wizardAnswers = (libraryName: string): SetupInput => ({
	locale: "it",
	theme: "sunset",
	libraryName,
	school: {
		preset: "it-secondaria-I",
		stages: [{ code: "secondaria-I", mode: "perLevel", names: ["A", "B"] }],
		teacherGroupName: "Professori",
		classLabel: "{level}{group}",
		readingLevels: false,
		schoolYearStart: "09-01",
		schoolYearLabel: "span",
	},
	codes: { item: "standard", card: "standard", check: "mod23", layout: "it" },
	features: { photos: true, covers: true },
	passwordHashes: hashes,
});

let root = "";
const saved = {
	config: process.env.CONFIG_DIR,
	backups: process.env.BACKUP_DIR,
};
/** The two installations: the old computer that wrote the archive, the new one that restores it. */
const old = (): { config: string; data: string } => ({
	config: join(root, "old", "config"),
	data: join(root, "old", "data"),
});
const fresh = (): { config: string; data: string } => ({
	config: join(root, "new", "config"),
	data: join(root, "new", "data"),
});

const useConfigDir = (dir: string): void => {
	process.env.CONFIG_DIR = dir;
	resetEnvCache();
	resetConfigCache();
};

beforeEach(() => {
	root = mkdtempSync(join(tmpdir(), "bv-first-run-restore-"));
	process.env.BACKUP_DIR = join(root, "backups");
	resetEnvCache();
});
afterEach(() => {
	for (const [key, value] of [
		["CONFIG_DIR", saved.config],
		["BACKUP_DIR", saved.backups],
	] as const) {
		if (value === undefined) {
			delete process.env[key];
		} else {
			process.env[key] = value;
		}
	}
	resetEnvCache();
	resetConfigCache();
	rmSync(root, { recursive: true, force: true });
});

function openAt(dataDir: string): Db {
	mkdirSync(join(dataDir, "db"), { recursive: true });
	const db = openDatabase(join(dataDir, "db", "biblioviva.db"));
	runMigrations(db);
	return db;
}

/** The archive of "Esporta tutto" (or of some parts) of a configured library with a book and a patron. */
async function libraryArchive(parts?: string[]): Promise<Uint8Array> {
	const { config, data } = old();
	useConfigDir(config);
	const db = openAt(data);
	writeSetupConfig(db, config, wizardAnswers("Biblioteca Rodari"));
	resetConfigCache();
	const actor = db
		.insert(staffUser)
		.values({ username: "admin", passwordHash: "x", roles: ["admin"] })
		.returning({ id: staffUser.id })
		.get();
	createBiblio(
		db,
		{
			title: "Nell'archivio",
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
	const { stream } = await createExportStream(db, data, config, {
		timezone: "Europe/Rome",
		library: "Biblioteca Rodari",
		parts: parts as never,
	});
	db.$client.close();
	return new Uint8Array(await new Response(stream).arrayBuffer());
}

/** The new computer: an empty database and a configuration folder with no configuration yet. */
function newComputer(): { db: Db; ctx: Pick<ServerContext, "db" | "configDir" | "dataDir"> } {
	const { config, data } = fresh();
	useConfigDir(config);
	const db = openAt(data);
	return { db, ctx: { db, configDir: config, dataDir: data } };
}

/** The same archive with its manifest rewritten. */
function withManifest(
	archive: Uint8Array,
	change: (m: Record<string, unknown>) => void,
): Uint8Array {
	const files = unzipSync(archive);
	const manifest = JSON.parse(strFromU8(files["manifest.json"] ?? new Uint8Array())) as Record<
		string,
		unknown
	>;
	change(manifest);
	return zipSync({ ...files, "manifest.json": strToU8(JSON.stringify(manifest)) });
}

const staged = (dataDir: string): string[] => {
	const dir = join(dataDir, "tmp", "restore");
	return existsSync(dir) ? readdirSync(dir) : [];
};
const titles = (db: Db): string[] =>
	db
		.select({ t: biblio.title })
		.from(biblio)
		.all()
		.map((r) => r.t);

describe("restore from the first-run wizard", () => {
	it("restores a whole library: data, configuration and accounts, and closes the wizard", async () => {
		const archive = await libraryArchive();
		const { db, ctx } = newComputer();
		expect(isSetupMode(loadConfig(ctx.configDir))).toBe(true);

		const check = await checkFirstRunRestore(ctx, archive);
		expect(check.source).toMatchObject({ library: "Biblioteca Rodari", version: APP_VERSION });
		expect(check.counts).toMatchObject({ catalog: 1, patrons: 1 });
		expect(check.accounts).toEqual([...WIZARD_ACCOUNTS]);
		// nothing is written before the operator confirms
		expect(titles(db)).toEqual([]);
		expect(isSetupMode(loadConfig(ctx.configDir))).toBe(true);

		const { accounts } = await applyFirstRunRestore(ctx, check.token);
		expect(accounts).toEqual([...WIZARD_ACCOUNTS]);
		expect(titles(db)).toEqual(["Nell'archivio"]);
		expect(db.select().from(patron).all()).toHaveLength(1);
		const loaded = loadConfig(ctx.configDir);
		expect(isSetupMode(loaded)).toBe(false);
		expect(loaded.config).toMatchObject({
			library: { name: "Biblioteca Rodari" },
			ui: { theme: "sunset", locale: "it", setupCompleted: true },
		});
		// the archive's accounts can log in: mirrored, active, with the hashes of the archive
		const rows = db.select().from(staffUser).where(eq(staffUser.active, 1)).all();
		expect(rows.map((r) => r.username).sort()).toEqual([...WIZARD_ACCOUNTS].sort());
		expect(rows.find((r) => r.username === "prestiti")?.passwordHash).toBe(hashes.prestiti);
		expect(
			db
				.select()
				.from(auditLog)
				.all()
				.map((r) => r.action),
		).toContain("backup.restore");
		// the staged archive is gone and the wizard is closed for a second restore
		expect(staged(ctx.dataDir)).toEqual([]);
		await expect(checkFirstRunRestore(ctx, archive)).rejects.toMatchObject({
			code: "not_setup",
		});
	});

	it("refuses a file that is not a BiblioViva archive, keeping nothing staged", async () => {
		const { ctx } = newComputer();
		await expect(
			checkFirstRunRestore(ctx, zipSync({ "notes.txt": strToU8("not ours") })),
		).rejects.toMatchObject({ code: "unknown_file" });
		await expect(
			checkFirstRunRestore(ctx, strToU8("this is not a zip file at all")),
		).rejects.toBeInstanceOf(ArchiveReadError);
		await expect(
			checkFirstRunRestore(
				ctx,
				zipSync({ "manifest.json": strToU8(JSON.stringify({ app: "Other", parts: [] })) }),
			),
		).rejects.toMatchObject({ code: "not_archive" });
		expect(staged(ctx.dataDir)).toEqual([]);
		expect(isSetupMode(loadConfig(ctx.configDir))).toBe(true);
	});

	it("refuses an archive written by a newer version", async () => {
		const archive = withManifest(await libraryArchive(), (m) => {
			m.version = "99.0.0";
		});
		const { db, ctx } = newComputer();
		const error = await checkFirstRunRestore(ctx, archive).catch((e: unknown) => e);
		expect(error).toBeInstanceOf(FirstRunRestoreError);
		expect(error).toMatchObject({ code: "newer_version", detail: "99.0.0" });
		expect(staged(ctx.dataDir)).toEqual([]);
		expect(titles(db)).toEqual([]);
	});

	it("compares versions by their numbers", () => {
		expect(isNewerVersion("0.9.1", "0.9.0")).toBe(true);
		expect(isNewerVersion("1.0.0", "0.9.9")).toBe(true);
		expect(isNewerVersion("0.10.0", "0.9.0")).toBe(true);
		expect(isNewerVersion("0.9.0", "0.9.0")).toBe(false);
		expect(isNewerVersion("0.8.9", "0.9.0")).toBe(false);
		expect(isNewerVersion("0.9.0-beta.1", "0.9.0")).toBe(false);
		expect(isNewerVersion(null, "0.9.0")).toBe(false);
		expect(isNewerVersion("nonsense", "0.9.0")).toBe(false);
	});

	it("refuses a partial archive and says which parts are missing", async () => {
		// the catalogue only: no settings of the library, no patrons
		const catalogOnly = await libraryArchive(["data:catalog"]);
		const { db, ctx } = newComputer();
		const error = await checkFirstRunRestore(ctx, catalogOnly).catch((e: unknown) => e);
		expect(error).toMatchObject({ code: "missing_parts" });
		const detail = (error as FirstRunRestoreError).detail;
		expect(detail).toContain("section:ui");
		expect(detail).toContain("section:security");
		expect(detail).toContain("data:patrons");
		expect(detail).not.toContain("data:catalog");
		expect(staged(ctx.dataDir)).toEqual([]);
		expect(titles(db)).toEqual([]);
	});

	it("refuses a configuration-only archive: it has no library to restore", async () => {
		const parts = [
			"section:ui",
			"section:security",
			"section:library",
			"section:school",
			"config:classification",
		];
		const archive = await libraryArchive(parts);
		const { ctx } = newComputer();
		await expect(checkFirstRunRestore(ctx, archive)).rejects.toMatchObject({
			code: "missing_parts",
			detail: "data:patrons, data:catalog",
		});
	});

	it("refuses an archive whose own wizard was never completed", async () => {
		const files = unzipSync(await libraryArchive());
		const config = JSON.parse(strFromU8(files["config/config.json"] ?? new Uint8Array())) as {
			ui: Record<string, unknown>;
		};
		config.ui.setupCompleted = false;
		const archive = zipSync({
			...files,
			"config/config.json": strToU8(JSON.stringify(config)),
		});
		const { ctx } = newComputer();
		await expect(checkFirstRunRestore(ctx, archive)).rejects.toMatchObject({
			code: "unfinished_setup",
		});
		expect(staged(ctx.dataDir)).toEqual([]);
	});

	it("is refused once the wizard has been completed, for the check and for the restore", async () => {
		const archive = await libraryArchive();
		const { db, ctx } = newComputer();
		const check = await checkFirstRunRestore(ctx, archive);
		// the wizard is completed meanwhile (another browser, a restart)
		writeSetupConfig(db, ctx.configDir, wizardAnswers("Altra biblioteca"));
		resetConfigCache();
		await expect(applyFirstRunRestore(ctx, check.token)).rejects.toMatchObject({
			code: "not_setup",
		});
		await expect(checkFirstRunRestore(ctx, archive)).rejects.toMatchObject({
			code: "not_setup",
		});
		expect(titles(db)).toEqual([]);
		expect(loadConfig(ctx.configDir).config.library.name).toBe("Altra biblioteca");
	});

	it("does not restore a staged archive that was discarded or never staged", async () => {
		const archive = await libraryArchive();
		const { ctx } = newComputer();
		const check = await checkFirstRunRestore(ctx, archive);
		discardFirstRunRestore(ctx.dataDir, check.token);
		expect(staged(ctx.dataDir)).toEqual([]);
		await expect(applyFirstRunRestore(ctx, check.token)).rejects.toBeInstanceOf(
			RestoreNotReadyError,
		);
		await expect(applyFirstRunRestore(ctx, "0".repeat(32))).rejects.toBeInstanceOf(
			RestoreNotReadyError,
		);
	});

	it("restores the pictures of the archive too", async () => {
		const { data } = old();
		mkdirSync(join(data, "uploads", "covers", "01"), { recursive: true });
		writeFileSync(join(data, "uploads", "covers", "01", "1-main-1.jpg"), "copertina");
		const archive = await libraryArchive();
		const { ctx } = newComputer();
		const check = await checkFirstRunRestore(ctx, archive);
		expect(check.covers).toBe(1);
		await applyFirstRunRestore(ctx, check.token);
		expect(existsSync(join(ctx.dataDir, "uploads", "covers", "01", "1-main-1.jpg"))).toBe(true);
	});
});
