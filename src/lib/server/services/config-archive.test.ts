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
import { strToU8, unzipSync, zipSync, type Zippable } from "fflate";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { createTestDb } from "../../../../tests/helpers/db.js";
import { getConfig, resetConfigCache } from "#lib/server/config/index.js";
import { loadConfig } from "#lib/server/config/load.js";
import type { ServerContext } from "#lib/server/context.js";
import type { Db } from "#lib/server/db/client.js";
import { patron, staffUser } from "#lib/server/db/schema.js";
import { resetEnvCache } from "#lib/server/env.js";
import { catalogRules, createBiblio } from "./catalog.js";
import { addItems } from "./catalog-items.js";
import { stagedDir } from "#lib/server/archive/staging.js";
import type { PartId } from "#lib/shared/archive-parts.js";
import { archiveFiles } from "./config-archive.js";
import { listConfigChanges } from "./config-edit.js";
import { revertConfigChange, setUiTheme } from "../../../../tests/helpers/config.js";
import { partsIn } from "./config-parts.js";
import {
	ArchiveReadError,
	configArchiveName,
	createExportStream,
	MANIFEST_NAME,
	MAX_UPLOAD_BYTES,
} from "./export-archive.js";
import {
	applyConfigArchive,
	ArchiveNotReadyError,
	checkConfigArchive,
	checkUploadedConfigArchive,
	discardConfigArchive,
	recheckConfigArchive,
} from "./full-restore.js";
import { createPatron } from "./patrons.js";
import { PATRON_RULES } from "../../../../tests/helpers/school.js";

let configDir = "";
let dataDir = "";
const previous = process.env.CONFIG_DIR;
beforeEach(() => {
	configDir = mkdtempSync(join(tmpdir(), "bv-archive-config-"));
	dataDir = mkdtempSync(join(tmpdir(), "bv-archive-data-"));
	process.env.CONFIG_DIR = configDir;
	resetEnvCache();
	resetConfigCache();
	setUiTheme(configDir, "ocean");
	mkdirSync(join(configDir, "classification", "images"), { recursive: true });
	writeFileSync(join(configDir, "classification", "images", "A.png"), new Uint8Array([1, 2, 3]));
	mkdirSync(join(configDir, "branding"), { recursive: true });
	writeFileSync(join(configDir, "branding", "logo.png"), new Uint8Array([4, 5, 6]));
	writeFileSync(
		join(configDir, "calendar.2026.json"),
		JSON.stringify({ holidays: ["2026-12-07"] }),
	);
});
afterEach(() => {
	process.env.CONFIG_DIR = previous;
	resetEnvCache();
	resetConfigCache();
	rmSync(configDir, { recursive: true, force: true });
	rmSync(dataDir, { recursive: true, force: true });
});

/** The context of a request over the test folders. */
const context = (db: Db): Pick<ServerContext, "db" | "configDir" | "dataDir"> => ({
	db,
	configDir,
	dataDir,
});
const NOW = new Date("2026-09-25T10:15:00Z");

function database(): { db: Db; actor: { id: number } } {
	const db = createTestDb();
	const actor = db
		.insert(staffUser)
		.values({ username: "admin", passwordHash: "x", roles: [] })
		.returning({ id: staffUser.id })
		.get();
	return { db, actor };
}

/** "Esporta configurazione": the archive of the configuration parts (all, or those given). */
async function exportNow(
	db: Db,
	parts: readonly PartId[] = partsIn(configDir),
): Promise<Uint8Array> {
	const { stream } = await createExportStream(db, dataDir, configDir, {
		timezone: "Europe/Rome",
		library: "Prova",
		now: NOW,
		parts,
	});
	return new Uint8Array(await new Response(stream).arrayBuffer());
}

const MANIFEST = strToU8(JSON.stringify({ app: "BiblioViva", version: "1", parts: [] }));

/** A zip made by hand, with a manifest unless told otherwise. */
function zip(
	files: Record<string, Uint8Array | [Uint8Array, { os?: number; attrs?: number }]>,
	manifest = true,
): Uint8Array {
	return zipSync({ ...(manifest ? { [MANIFEST_NAME]: MANIFEST } : {}), ...files });
}

/** "Importa configurazione" of an uploaded archive. */
const check = (
	db: Db,
	archive: Uint8Array,
	options?: Parameters<typeof checkUploadedConfigArchive>[2],
): ReturnType<typeof checkUploadedConfigArchive> =>
	checkUploadedConfigArchive(context(db), archive, options);

/** The staged folder of an import, or null once it is gone. */
const staged = (token: string): string | null => stagedDir(dataDir, "config-import", token);

/** The central directory entries of a zip: where each starts, to forge them in the tests. */
function centralOffsets(zip: Uint8Array): number[] {
	const view = new DataView(zip.buffer, zip.byteOffset, zip.byteLength);
	const end = zip.byteLength - 22; // no archive comment
	const offsets: number[] = [];
	let offset = view.getUint32(end + 16, true);
	for (let n = view.getUint16(end + 10, true); n > 0; n--) {
		offsets.push(offset);
		offset +=
			46 +
			view.getUint16(offset + 28, true) +
			view.getUint16(offset + 30, true) +
			view.getUint16(offset + 32, true);
	}
	return offsets;
}

/** One DVD copy in the catalogue, so the item type `dvd` is in use. */
function addDvd(db: Db, actor: { id: number }): void {
	const rules = catalogRules(getConfig());
	const id = createBiblio(
		db,
		{
			title: "Il gatto",
			subtitle: "",
			originalTitle: "",
			responsibility: "",
			author: "Perrault, Charles",
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
			itemType: "dvd",
			kind: "fiction",
			genreCode: "B",
			classCode: "",
			readingLevel: "",
			subjects: "",
			notes: "",
		},
		actor,
		rules,
	);
	addItems(
		db,
		id,
		{
			callNumber: "",
			readingLevel: "",
			enumeration: "",
			acquisitionDate: "2020-01-01",
			notes: "",
			notForLoan: false,
		},
		1,
		actor,
		rules,
	);
}

/** The exported archive without the item type `dvd`. */
async function withoutDvd(db: Db): Promise<Uint8Array> {
	const entries = unzipSync(await exportNow(db));
	const configJson = JSON.parse(new TextDecoder().decode(entries["config/config.json"])) as {
		library: { itemTypes: { code: string }[] };
		circulation: { itemTypeOverrides?: Record<string, unknown> };
	};
	configJson.library.itemTypes = configJson.library.itemTypes.filter((t) => t.code !== "dvd");
	delete configJson.circulation.itemTypeOverrides?.dvd;
	return zipSync({ ...entries, "config/config.json": strToU8(JSON.stringify(configJson)) });
}

const errorOf = async (fn: () => Promise<unknown>): Promise<string> => {
	try {
		await fn();
		return "ok";
	} catch (e) {
		return e instanceof ArchiveReadError
			? `${e.code}${e.detail ? `:${e.detail}` : ""}`
			: String(e);
	}
};

/** Every file under DATA_DIR (the staged archives and the uploads written aside included). */
const dataFiles = (): string[] =>
	readdirSync(dataDir, { recursive: true, withFileTypes: true })
		.filter((e) => e.isFile())
		.map((e) => e.name);

describe("export", () => {
	it("is the archive format with the configuration parts only, never the history", async () => {
		const { db } = database();
		const files = archiveFiles(configDir);
		expect(files).toContain("config.json");
		expect(files).toContain("classification.json");
		expect(files).toContain("calendar.2026.json");
		expect(files).toContain("labels/stocks/a4-70x48.json");
		expect(files).toContain("classification/images/A.png");
		expect(files).toContain("branding/logo.png");
		expect(files.some((f) => f.startsWith("cards/templates/default/"))).toBe(true);
		expect(files.some((f) => f.startsWith("history/"))).toBe(false);
		writeFileSync(join(configDir, "notes.txt"), "not configuration");
		expect(archiveFiles(configDir)).not.toContain("notes.txt");

		// the layout of every archive: the configuration under config/, no database, no uploads
		const entries = unzipSync(await exportNow(db));
		expect(Object.keys(entries).sort()).toEqual(
			[MANIFEST_NAME, ...files.map((f) => `config/${f}`)].sort(),
		);
		expect(JSON.parse(new TextDecoder().decode(entries[MANIFEST_NAME]))).toMatchObject({
			app: "BiblioViva",
			library: "Prova",
			createdAt: NOW.toISOString(),
			database: { bytes: 0 },
			uploads: { photos: 0, covers: 0 },
			config: { files: files.length },
			parts: partsIn(configDir),
		});
		expect(partsIn(configDir)).toEqual(
			expect.arrayContaining(["config:cardTemplates", "section:privacy"]),
		);
		expect(archiveFiles(join(configDir, "missing"))).toEqual([]);
		expect(configArchiveName(NOW, "Europe/Rome")).toBe(
			"biblioviva-configurazione-20260925-1215.zip",
		);
	});
});

describe("import", () => {
	it("brings the folder back byte for byte, as one change the history can undo", async () => {
		const { db, actor } = database();
		const original = Object.fromEntries(
			archiveFiles(configDir).map((f) => [f, readFileSync(join(configDir, f))]),
		);
		const archive = await exportNow(db);
		// then the folder changes: a value, a file removed, a file added
		setUiTheme(configDir, "grape");
		rmSync(join(configDir, "branding", "logo.png"));
		writeFileSync(join(configDir, "calendar.2027.json"), JSON.stringify({ holidays: [] }));

		const checked = await check(db, archive);
		expect(checked.ready).toBe(true);
		expect(checked.source).toMatchObject({ library: "Prova", createdAt: NOW.toISOString() });
		expect(checked.files).toMatchObject({
			added: ["branding/logo.png"],
			changed: ["config.json"],
			removed: ["calendar.2027.json"],
		});
		expect(checked.sections).toEqual(["ui"]);
		expect(checked.issues.filter((i) => i.level === "error")).toEqual([]);

		const change = await applyConfigArchive(context(db), checked.token, actor, { now: NOW });
		expect(change.action).toBe("config.import");
		expect(staged(checked.token)).toBeNull();
		expect(getConfig().ui.theme).toBe("ocean");
		const now = archiveFiles(configDir);
		expect(now.sort()).toEqual(Object.keys(original).sort());
		for (const [file, bytes] of Object.entries(original)) {
			expect(readFileSync(join(configDir, file)).equals(bytes), file).toBe(true);
		}
		// the history keeps the folder as it was before the import
		revertConfigChange(configDir, change.id);
		expect(loadConfig(configDir).config.ui.theme).toBe("grape");
		expect(existsSync(join(configDir, "calendar.2027.json"))).toBe(true);
		expect(listConfigChanges(configDir)[0]?.action).toBe(`revert ${change.id}`);
	});

	it("carries the codes, the school and the reading levels there and back (Phase 12)", async () => {
		const { db, actor } = database();
		const archive = await exportNow(db);
		const json = (file: string): Record<string, Record<string, unknown>> =>
			JSON.parse(readFileSync(join(configDir, file), "utf8")) as Record<
				string,
				Record<string, unknown>
			>;
		const config = json("config.json");
		const barcodes = config.barcodes as { item: { format: unknown } };
		barcodes.item.format = { pattern: "'L'-YYNNNNC", check: "damm" };
		(config.school as { classLabel: string }).classLabel = "{level}{group}";
		writeFileSync(join(configDir, "config.json"), JSON.stringify(config));
		const classification = json("classification.json");
		classification.readingLevels = [{ code: "A", label: "Primi lettori" }] as never;
		writeFileSync(join(configDir, "classification.json"), JSON.stringify(classification));
		resetConfigCache();
		expect(getConfig().school.classLabel).toBe("{level}{group}");

		const checked = await check(db, archive);
		expect(checked.ready).toBe(true);
		expect(checked.sections).toEqual(
			expect.arrayContaining(["barcodes", "school", "classification"]),
		);
		await applyConfigArchive(context(db), checked.token, actor, { now: NOW });
		const restored = getConfig();
		expect(restored.school.classLabel).toBe("{level} {group}");
		expect(restored.barcodes.item.format).toEqual({ pattern: "YYYY-CNNNN", check: "mod23" });
		expect(restored.classification.readingLevels.map((l) => l.code)).toEqual([
			"1",
			"2",
			"3",
			"4",
			"5",
		]);
	});

	it("refuses unsafe paths, links, unknown files, oversize, foreign and former archives", async () => {
		const { db } = database();
		const config = strToU8("{}");
		const refused = (archive: Uint8Array): Promise<string> => errorOf(() => check(db, archive));
		expect(await refused(zip({ "config/../evil.json": config }))).toBe(
			"unsafe_path:config/../evil.json",
		);
		expect(await refused(zip({ "config/cards/templates/../../x.json": config }))).toBe(
			"unsafe_path:config/cards/templates/../../x.json",
		);
		expect(await refused(zip({ "config/history/1/change.json": config }))).toBe(
			"unsafe_path:config/history/1/change.json",
		);
		expect(await refused(zip({ "config/notes.txt": config }))).toBe(
			"unknown_file:config/notes.txt",
		);
		expect(await refused(zip({ "uploads/other/x.webp": config }))).toBe(
			"unknown_file:uploads/other/x.webp",
		);
		expect(
			await refused(
				zip({
					"config/config.json": config,
					"config/branding/logo.png": [
						strToU8("/etc/passwd"),
						{ os: 3, attrs: 0o120777 << 16 },
					],
				}),
			),
		).toBe("link:config/branding/logo.png");
		expect(await refused(new Uint8Array(MAX_UPLOAD_BYTES + 1))).toBe("too_large");
		expect(await refused(strToU8("not a zip at all"))).toBe("not_zip");
		expect(await refused(zip({ "config/config.json": config }, false))).toBe("not_archive");
		expect(
			await refused(
				zipSync({
					[MANIFEST_NAME]: strToU8(JSON.stringify({ app: "Altro", parts: [] })),
					"config/config.json": config,
				}),
			),
		).toBe("not_archive");
		// the former configuration archive (files at the root, its own manifest) is not read
		expect(
			await refused(
				zipSync({
					[MANIFEST_NAME]: strToU8(
						JSON.stringify({ format: "biblioviva-config", version: "1", files: 1 }),
					),
					"config.json": config,
				}),
			),
		).toBe("unknown_file:config.json");
		// nothing of the refused archives was kept
		expect(dataFiles()).toEqual([]);
	});

	it("refuses an archive without configuration parts, with nothing kept", async () => {
		const { db } = database();
		const dataOnly: Zippable = {
			[MANIFEST_NAME]: strToU8(
				JSON.stringify({ app: "BiblioViva", version: "1", parts: ["data:covers"] }),
			),
			"uploads/covers/01/1-main-1.webp": new Uint8Array(10),
		};
		expect(await errorOf(() => check(db, zipSync(dataOnly)))).toBe("no_config");
		expect(dataFiles()).toEqual([]);
	});

	it("imports the configuration of a full backup, the data left as they are", async () => {
		const { db, actor } = database();
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
		mkdirSync(join(dataDir, "uploads", "covers", "01"), { recursive: true });
		writeFileSync(join(dataDir, "uploads", "covers", "01", "1-main-1.webp"), "copertina");
		// every part, data included: what "Esporta tutto" and a backup of every part write
		const { stream } = await createExportStream(db, dataDir, configDir, {
			timezone: "Europe/Rome",
			now: NOW,
		});
		const backup = join(dataDir, "biblioviva-20260925-1215.zip");
		writeFileSync(backup, new Uint8Array(await new Response(stream).arrayBuffer()));
		expect(Object.keys(unzipSync(new Uint8Array(readFileSync(backup))))).toEqual(
			expect.arrayContaining(["db/biblioviva.db", "uploads/covers/01/1-main-1.webp"]),
		);
		setUiTheme(configDir, "grape");

		const checked = await checkConfigArchive(context(db), backup, {
			name: "biblioviva-20260925-1215.zip",
		});
		// only the configuration parts are offered; the database and the uploads are not unpacked
		expect(checked.available).toEqual(partsIn(configDir));
		expect(checked.available.some((p) => p.startsWith("data:"))).toBe(false);
		expect(existsSync(join(staged(checked.token) ?? "", "data", "db"))).toBe(false);
		expect(existsSync(join(staged(checked.token) ?? "", "data", "uploads"))).toBe(false);
		expect(checked.sections).toEqual(["ui"]);
		expect(checked.ready).toBe(true);
		const change = await applyConfigArchive(context(db), checked.token, actor, { now: NOW });
		expect(change.action).toBe("config.import");
		expect(getConfig().ui.theme).toBe("ocean");
		expect(db.select().from(patron).all()).toHaveLength(1);
		expect(existsSync(join(dataDir, "uploads", "covers", "01", "1-main-1.webp"))).toBe(true);
	});

	it("reports an invalid configuration, template or report with its file, and imports nothing", async () => {
		const { db, actor } = database();
		const before = readFileSync(join(configDir, "config.json"), "utf8");
		const entries = unzipSync(await exportNow(db));
		const configJson = JSON.parse(
			new TextDecoder().decode(entries["config/config.json"]),
		) as Record<string, Record<string, unknown>>;
		(configJson.privacy ??= {}).auditRetentionMonths = 0;
		(configJson.labels ??= {}).spine = { template: "missing", stock: "a4-70x48" };
		const broken = zipSync({
			...entries,
			"config/config.json": strToU8(JSON.stringify(configJson)),
			"config/cards/templates/broken/template.json": strToU8('{"name": 3}'),
			"config/reports/bad.json": strToU8("{ nope"),
		});
		const checked = await check(db, broken);
		expect(checked.ready).toBe(false);
		expect(checked.issues).toEqual(
			expect.arrayContaining([
				expect.objectContaining({
					level: "error",
					path: "privacy.auditRetentionMonths",
					file: "config.json",
				}),
			]),
		);
		await expect(applyConfigArchive(context(db), checked.token, actor)).rejects.toThrow(
			ArchiveNotReadyError,
		);
		expect(readFileSync(join(configDir, "config.json"), "utf8")).toBe(before);

		// the same archive with a valid config: template and report problems remain
		(configJson.privacy ??= {}).auditRetentionMonths = 24;
		const templates = await check(
			db,
			zipSync({
				...entries,
				"config/config.json": strToU8(JSON.stringify(configJson)),
				"config/cards/templates/broken/template.json": strToU8('{"name": 3}'),
				"config/reports/bad.json": strToU8("{ nope"),
			}),
		);
		expect(templates.ready).toBe(false);
		const files = templates.issues.filter((i) => i.level === "error").map((i) => i.file);
		expect(files).toEqual(
			expect.arrayContaining(["cards/templates/broken/", "reports/bad.json", "config.json"]),
		);
		discardConfigArchive(dataDir, templates.token);
		expect(staged(templates.token)).toBeNull();
		expect(staged("nope")).toBeNull();
		await expect(applyConfigArchive(context(db), templates.token, actor)).rejects.toThrow(
			ArchiveNotReadyError,
		);
	});

	it("exports some parts and imports only the parts chosen, the others left as they are", async () => {
		const { db, actor } = database();
		const templatesOnly = await exportNow(db, [
			"config:cardTemplates",
			"config:slipTemplates",
			"section:privacy",
		]);
		const names = Object.keys(unzipSync(templatesOnly));
		expect(names.some((n) => n.startsWith("config/labels/"))).toBe(false);
		expect(names).toContain("config/cards/templates/default/front.html");

		// a template and two settings change afterwards
		const front = join(configDir, "cards/templates/default/front.html");
		const original = readFileSync(front, "utf8");
		writeFileSync(front, `${original}<!-- cambiato -->`);
		const raw = JSON.parse(readFileSync(join(configDir, "config.json"), "utf8")) as Record<
			string,
			Record<string, unknown>
		>;
		(raw.circulation ??= {}).receipts = true;
		(raw.privacy ??= {}).auditRetentionMonths = 30;
		writeFileSync(join(configDir, "config.json"), JSON.stringify(raw));
		resetConfigCache();
		const logo = readFileSync(join(configDir, "branding", "logo.png"));

		const checked = await check(db, templatesOnly, { parts: ["config:cardTemplates"] });
		expect(checked.available).toEqual([
			"config:cardTemplates",
			"config:slipTemplates",
			"section:privacy",
		]);
		expect(checked.selected).toEqual(["config:cardTemplates"]);
		expect(checked.files).toMatchObject({
			changed: ["cards/templates/default/front.html"],
			removed: [],
		});
		await applyConfigArchive(context(db), checked.token, actor, {
			parts: ["config:cardTemplates"],
			now: NOW,
		});
		expect(readFileSync(front, "utf8")).toBe(original);
		expect(getConfig().circulation.receipts).toBe(true);
		expect(getConfig().privacy.auditRetentionMonths).toBe(30);
		expect(readFileSync(join(configDir, "branding", "logo.png"))).toEqual(logo);
	});

	it("refuses an archive that takes away an item type still in use", async () => {
		const { db, actor } = database();
		addDvd(db, actor);
		const checked = await check(db, await withoutDvd(db));
		expect(checked.inUse).toEqual([{ kind: "itemType", code: "dvd", count: 1 }]);
		expect(checked.ready).toBe(false);
	});

	it("checks the item types again when importing: a copy added after the check stops it", async () => {
		const { db, actor } = database();
		const checked = await check(db, await withoutDvd(db));
		expect(checked.ready).toBe(true);
		addDvd(db, actor);
		const before = readFileSync(join(configDir, "config.json"), "utf8");
		const refused = await applyConfigArchive(context(db), checked.token, actor).catch(
			(e: unknown) => e,
		);
		expect(refused).toBeInstanceOf(ArchiveNotReadyError);
		expect((refused as ArchiveNotReadyError).check?.inUse).toEqual([
			{ kind: "itemType", code: "dvd", count: 1 },
		]);
		expect(readFileSync(join(configDir, "config.json"), "utf8")).toBe(before);
	});

	it("refuses damaged and forged zips before inflating anything", async () => {
		const { db } = database();
		const config = strToU8(JSON.stringify({ library: { name: "x".repeat(200) } }));
		const refused = (archive: Uint8Array): Promise<string> => errorOf(() => check(db, archive));
		// the central directory does not start where the end record says
		const lost = zip({ "config/config.json": config });
		const first = centralOffsets(lost)[0] ?? 0;
		new DataView(lost.buffer).setUint32(first, 0, true);
		expect(await refused(lost)).toBe("not_zip");

		// a manifest that is not JSON
		expect(
			await refused(
				zipSync({ [MANIFEST_NAME]: strToU8("{ nope"), "config/config.json": config }),
			),
		).toBe("not_archive");

		// sizes under the limit one by one, over it together (a zip bomb in many pieces)
		const bomb: Record<string, Uint8Array> = { "config/config.json": config };
		for (let i = 0; i < 11; i++) {
			bomb[`config/reports/r${i}.json`] = strToU8("{}");
		}
		const forged = zip(bomb);
		for (const offset of centralOffsets(forged)) {
			new DataView(forged.buffer).setUint32(offset + 24, 8_000_000, true);
		}
		expect(await refused(forged)).toBe("too_large");

		// a sound directory over damaged data
		const damaged = zip({ "config/config.json": config });
		const local = new DataView(damaged.buffer);
		const nameLength = local.getUint16(26 + 0, true);
		const name = new TextDecoder().decode(damaged.subarray(30, 30 + nameLength));
		const data = 30 + nameLength + local.getUint16(28, true);
		expect(name).toBe(MANIFEST_NAME);
		damaged[data] = 0xff; // a reserved deflate block type
		expect(await refused(damaged)).toBe("not_zip");
		expect(dataFiles()).toEqual([]);
	});

	it("keeps no staged files for a refused archive, drops stale ones, rechecks by token", async () => {
		const { db } = database();
		await expect(check(db, strToU8("not a zip"))).rejects.toThrow(ArchiveReadError);
		expect(dataFiles()).toEqual([]);

		const old = await check(db, await exportNow(db));
		expect(staged(old.token)).not.toBeNull();
		const again = await recheckConfigArchive(context(db), old.token, ["config:cardTemplates"]);
		expect(again.token).toBe(old.token);
		expect(again.selected).toEqual(["config:cardTemplates"]);
		// a day later the first staged archive is gone
		const fresh = await check(db, await exportNow(db), {
			now: Date.now() + 25 * 60 * 60 * 1000,
		});
		expect(staged(old.token)).toBeNull();
		expect(staged(fresh.token)).not.toBeNull();
		await expect(
			recheckConfigArchive(context(db), old.token, ["config:cardTemplates"]),
		).rejects.toThrow(ArchiveNotReadyError);
	});

	it("warns about missing pictograms and reports the problems of a language pack", async () => {
		const { db } = database();
		const entries = unzipSync(await exportNow(db));
		const kept = Object.fromEntries(
			Object.entries(entries).filter(
				([name]) => !name.startsWith("config/classification/images/"),
			),
		);
		const checked = await check(
			db,
			zipSync({ ...kept, "config/i18n/xx/common.json": strToU8('{ "app": { "name": 3 } }') }),
		);
		expect(checked.issues).toEqual(
			expect.arrayContaining([
				expect.objectContaining({
					level: "warning",
					path: "classification.A.image",
					file: "classification/images/",
				}),
				expect.objectContaining({ path: "i18n.xx", file: "i18n/xx/common.json" }),
			]),
		);
	});
});
