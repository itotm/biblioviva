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
import { eq } from "drizzle-orm";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { createTestDb } from "../../../../tests/helpers/db.js";
import { solidImage } from "../../../../tests/helpers/images.js";
import { getConfig, resetConfigCache } from "#lib/server/config/index.js";
import { loadConfig } from "#lib/server/config/load.js";
import type { AppConfig } from "#lib/server/config/schema.js";
import type { ServerContext } from "#lib/server/context.js";
import { callNumberScheme } from "#lib/shared/classification.js";
import type { Db } from "#lib/server/db/client.js";
import { auditLog, biblio, item, staffUser } from "#lib/server/db/schema.js";
import { resetEnvCache } from "#lib/server/env.js";
import { catalogRules, createBiblio } from "./catalog.js";
import { addItems } from "./catalog-items.js";
import { listConfigChanges } from "./config-edit.js";
import { revertConfigChange, setUiTheme } from "../../../../tests/helpers/config.js";
import { markLabelsPrinted } from "./label-items.js";
import {
	classPerItemConflicts,
	moveClassesToRecords,
	orphanCodes,
	planTaxonomy,
	previewTaxonomyBand,
	saveTaxonomy,
	taxonomyOf,
	taxonomyUsage,
	TaxonomyNodeNotFoundError,
	TaxonomyNotReadyError,
	type TaxonomyDraft,
} from "./taxonomy.js";
import { listPictogramFiles, stagedPictogramPath, stagePictogram } from "./taxonomy-pictograms.js";

let configDir = "";
let dataDir = "";
const previous = process.env.CONFIG_DIR;
beforeEach(() => {
	configDir = mkdtempSync(join(tmpdir(), "bv-taxonomy-config-"));
	dataDir = mkdtempSync(join(tmpdir(), "bv-taxonomy-data-"));
	process.env.CONFIG_DIR = configDir;
	resetEnvCache();
	resetConfigCache();
	// config.json plus the shipped fragments, classification.json included
	setUiTheme(configDir, "ocean");
});
afterEach(() => {
	process.env.CONFIG_DIR = previous;
	resetEnvCache();
	resetConfigCache();
	rmSync(configDir, { recursive: true, force: true });
	rmSync(dataDir, { recursive: true, force: true });
});

/** The context of a request over the test folders. */
const context = (db: Db, config: AppConfig): ServerContext => ({ db, config, configDir, dataDir });
const NOW = new Date("2026-09-25T10:15:00Z");
const copy = {
	itemType: "libro",
	readingLevel: "",
	enumeration: "",
	acquisitionDate: "2020-01-01",
	notes: "",
	notForLoan: false,
};

interface Fixture {
	db: Db;
	config: AppConfig;
	actor: { id: number };
	fiction: number;
	nonfiction: number;
	/** Two copies with the suggested call number, one with a hand-written one. */
	fictionItems: number[];
}

function fixture(): Fixture {
	const config = loadConfig(configDir).config;
	const rules = catalogRules(config);
	const db = createTestDb();
	const actor = db
		.insert(staffUser)
		.values({ username: "u", passwordHash: "x", roles: [] })
		.returning({ id: staffUser.id })
		.get();
	const record = {
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
		kind: "fiction" as const,
		genreCode: "B",
		classCode: "",
		readingLevel: "3",
		subjects: "",
		notes: "",
	};
	const fiction = createBiblio(db, record, actor, rules);
	const nonfiction = createBiblio(
		db,
		{
			...record,
			title: "Animali",
			kind: "nonfiction",
			genreCode: "",
			classCode: "590",
			readingLevel: "",
		},
		actor,
		rules,
	);
	const fictionItems = addItems(db, fiction, copy, 3, actor, rules).ids;
	const other = addItems(db, nonfiction, copy, 1, actor, rules).ids;
	markLabelsPrinted(db, "pair", [...fictionItems, ...other], NOW);
	return { db, config, actor, fiction, nonfiction, fictionItems };
}

const withoutGenre = (draft: TaxonomyDraft, code: string): TaxonomyDraft => ({
	...draft,
	genres: draft.genres.filter((g) => g.code !== code),
});

const itemsOf = (db: Db, biblioId: number): (typeof item.$inferSelect)[] =>
	db.select().from(item).where(eq(item.biblioId, biblioId)).orderBy(item.id).all();

describe("usage", () => {
	it("counts records and copies per code and finds the codes the taxonomy lacks", () => {
		const { db, config } = fixture();
		const usage = taxonomyUsage(db);
		expect(usage.fiction.B).toEqual({ records: 1, copies: 3 });
		expect(usage.nonfiction["590"]).toEqual({ records: 1, copies: 1 });
		expect(orphanCodes(usage, taxonomyOf(config))).toEqual([]);
		db.update(biblio).set({ genreCode: "Q" }).where(eq(biblio.kind, "fiction")).run();
		expect(orphanCodes(taxonomyUsage(db), taxonomyOf(config))).toEqual([
			{ kind: "fiction", code: "Q", records: 1, copies: 3 },
		]);
	});
});

describe("plan", () => {
	it("has nothing to save for the saved taxonomy", () => {
		const { db, config } = fixture();
		const plan = planTaxonomy(context(db, config), taxonomyOf(config));
		expect(plan).toMatchObject({ changed: false, ready: false, removed: [], restyled: [] });
		expect(plan.issues.filter((i) => i.level === "error")).toEqual([]);
	});

	it("asks where the books of a removed code go, and counts the call numbers that change", () => {
		const { db, config } = fixture();
		const draft = withoutGenre(taxonomyOf(config), "B");
		const plan = planTaxonomy(context(db, config), draft);
		expect(plan.removed).toEqual([
			expect.objectContaining({ kind: "fiction", code: "B", records: 1, copies: 3 }),
		]);
		expect(plan.removed[0]?.replacement).toBeNull();
		expect(plan).toMatchObject({ ready: false, callNumbers: 3 });
		const ready = planTaxonomy(context(db, config), draft, { B: "A" });
		expect(ready).toMatchObject({ ready: true, callNumbers: 3 });
		// a class is no place for a genre's books
		const wrong = planTaxonomy(context(db, config), draft, { B: "590" });
		expect(wrong.ready).toBe(false);
		expect(wrong.issues.some((i) => i.message.includes('"B" cannot move to "590"'))).toBe(true);
	});

	it("reports a renamed code as removed with its new name, and restyled codes in use", () => {
		const { db, config } = fixture();
		const draft = taxonomyOf(config);
		draft.genres = draft.genres.map((g) =>
			g.code === "B" ? { ...g, code: "B2" } : g.code === "A" ? { ...g, color: "#000000" } : g,
		);
		draft.nonfiction = draft.nonfiction.map((n) => ({ ...n, color: "#123456" }));
		const plan = planTaxonomy(context(db, config), draft, { B: "B2" });
		expect(plan.removed).toEqual([expect.objectContaining({ code: "B", replacement: "B2" })]);
		// A is not used; 590 inherits the colour of its parent
		expect(plan.restyled).toEqual([{ kind: "nonfiction", code: "590", records: 1, copies: 1 }]);
		expect(plan.ready).toBe(true);
	});

	it("reports schema problems, codes shared by a genre and a class, and expired uploads", () => {
		const { db, config } = fixture();
		const draft = taxonomyOf(config);
		const first = draft.genres[0];
		if (!first) {
			throw new Error("no genre");
		}
		draft.genres[0] = { ...first, label: "", image: `draft:${"a".repeat(32)}` };
		draft.genres.push({ code: "590", label: "Doppio", image: "missing.png", color: null });
		const plan = planTaxonomy(context(db, config), draft);
		const errors = plan.issues.filter((i) => i.level === "error");
		expect(errors.some((i) => i.path === "classification.genres.0.label")).toBe(true);
		expect(errors.some((i) => i.message.includes('"590" is used by a genre too'))).toBe(true);
		expect(errors.some((i) => i.message.includes("expired"))).toBe(true);
		// a missing file is only a warning: the labels print the placeholder
		expect(
			plan.issues.some(
				(i) => i.level === "warning" && i.message.includes('"missing.png" not found'),
			),
		).toBe(true);
		expect(plan.ready).toBe(false);
	});
});

describe("save", () => {
	it("writes the file, moves the books, computes the call numbers again and sends bands to print", () => {
		const { db, config, actor, fiction, fictionItems } = fixture();
		const draft = withoutGenre(taxonomyOf(config), "B");
		const result = saveTaxonomy(
			context(db, config),
			draft,
			{ replacements: { B: "A" } },
			actor,
			NOW,
		);
		expect(result).toMatchObject({ records: 1, callNumbers: 3, bands: 3, moved: 0 });
		expect(db.select().from(biblio).where(eq(biblio.id, fiction)).get()?.genreCode).toBe("A");
		const items = itemsOf(db, fiction);
		expect(items.map((i) => i.callNumber)).toEqual(["A 3 PER", "A 3 PER", "A 3 PER"]);
		expect(items.map((i) => i.callHead)).toEqual(["A 3", "A 3", "A 3"]);
		expect(items.every((i) => i.spineLabelPrintedAt === null)).toBe(true);
		// the barcode label shows the call number: it goes back too
		expect(items.every((i) => i.barcodeLabelPrintedAt === null)).toBe(true);
		expect(fictionItems).toHaveLength(3);

		const file = JSON.parse(readFileSync(join(configDir, "classification.json"), "utf8")) as {
			genres: { code: string }[];
			_comment?: string;
		};
		expect(file.genres.map((g) => g.code)).not.toContain("B");
		expect(file._comment).toBeDefined();
		expect(getConfig().classification.genres.map((g) => g.code)).not.toContain("B");
		const change = listConfigChanges(configDir).find((c) => c.id === result.change);
		expect(change).toMatchObject({
			id: result.change,
			action: "config.classification",
			// the removed genre's own pictogram goes with it (and comes back with the history)
			files: [
				{ path: "classification.json", existed: true },
				{ path: "classification/images/B.svg", existed: true, removed: true },
			],
		});
		const row = db
			.select()
			.from(auditLog)
			.where(eq(auditLog.action, "config.classification"))
			.get();
		expect(row?.details).toMatchObject({
			change: result.change,
			replaced: { B: "A" },
			removed: ["B"],
			records: 1,
			callNumbers: 3,
		});
	});

	it("refuses a draft that is not ready and writes nothing", () => {
		const { db, config, actor } = fixture();
		const before = listConfigChanges(configDir).length;
		expect(() =>
			saveTaxonomy(context(db, config), withoutGenre(taxonomyOf(config), "B"), {}, actor),
		).toThrow(TaxonomyNotReadyError);
		expect(() => saveTaxonomy(context(db, config), taxonomyOf(config), {}, actor)).toThrow(
			TaxonomyNotReadyError,
		);
		expect(listConfigChanges(configDir)).toHaveLength(before);
	});

	it("puts the files back when the catalogue cannot be updated", () => {
		const { db, config, actor, fiction } = fixture();
		const path = join(configDir, "classification.json");
		const before = readFileSync(path, "utf8");
		const changes = listConfigChanges(configDir).length;
		db.$client.run(
			"CREATE TRIGGER no_biblio_updates BEFORE UPDATE ON biblio BEGIN SELECT RAISE(ABORT, 'read only'); END",
		);
		expect(() =>
			saveTaxonomy(
				context(db, config),
				withoutGenre(taxonomyOf(config), "B"),
				{ replacements: { B: "A" } },
				actor,
			),
		).toThrow();
		expect(readFileSync(path, "utf8")).toBe(before);
		expect(listConfigChanges(configDir)).toHaveLength(changes);
		expect(itemsOf(db, fiction).map((i) => i.callNumber)).toEqual([
			"B 3 PER",
			"B 3 PER",
			"B 3 PER",
		]);
	});

	it("sends restyled bands to print only when asked", () => {
		const { db, config, actor, nonfiction } = fixture();
		const draft = taxonomyOf(config);
		draft.nonfiction = draft.nonfiction.map((n) => ({ ...n, label: `${n.label}!` }));
		saveTaxonomy(context(db, config), draft, {}, actor, NOW);
		expect(itemsOf(db, nonfiction)[0]?.spineLabelPrintedAt).not.toBeNull();
		const again = taxonomyOf(loadConfig(configDir).config);
		again.nonfiction = again.nonfiction.map((n) => ({ ...n, color: "#123456" }));
		const result = saveTaxonomy(
			context(db, loadConfig(configDir).config),
			again,
			{ reprintRestyled: true },
			actor,
			NOW,
		);
		expect(result.bands).toBe(1);
		expect(itemsOf(db, nonfiction)[0]?.spineLabelPrintedAt).toBeNull();
	});

	it("moves the associated class to the copies and back", () => {
		const { db, config, actor, fiction } = fixture();
		const on = { ...taxonomyOf(config), classPerItem: true };
		expect(planTaxonomy(context(db, config), on).classPerItem).toEqual({
			to: true,
			records: 1,
			conflicts: 0,
		});
		expect(saveTaxonomy(context(db, config), on, {}, actor, NOW).moved).toBe(3);
		expect(db.select().from(biblio).where(eq(biblio.id, fiction)).get()?.readingLevel).toBe(
			null,
		);
		expect(itemsOf(db, fiction).map((i) => i.readingLevel)).toEqual(["3", "3", "3"]);

		const saved = loadConfig(configDir).config;
		const off = { ...taxonomyOf(saved), classPerItem: false };
		const [firstItem] = itemsOf(db, fiction);
		db.update(item)
			.set({ readingLevel: "4" })
			.where(eq(item.id, firstItem?.id ?? 0))
			.run();
		expect(classPerItemConflicts(db)).toBe(1);
		const blocked = planTaxonomy(context(db, saved), off);
		expect(blocked.classPerItem).toMatchObject({ to: false, conflicts: 1 });
		expect(blocked.ready).toBe(false);
		db.update(item)
			.set({ readingLevel: "3" })
			.where(eq(item.id, firstItem?.id ?? 0))
			.run();
		expect(saveTaxonomy(context(db, saved), off, {}, actor, NOW).moved).toBe(1);
		expect(db.select().from(biblio).where(eq(biblio.id, fiction)).get()?.readingLevel).toBe(
			"3",
		);
		expect(itemsOf(db, fiction).map((i) => i.readingLevel)).toEqual([null, null, null]);
		expect(moveClassesToRecords(db)).toBe(0);
	});
});

describe("reading levels (Phase 12.6)", () => {
	const without = (draft: TaxonomyDraft, code: string): TaxonomyDraft => ({
		...draft,
		readingLevels: draft.readingLevels.filter((l) => l.code !== code),
	});

	it("a level in use that goes away asks where its books go, then moves them and their call numbers", () => {
		const { db, config, actor, fiction } = fixture();
		const draft = without(taxonomyOf(config), "3");
		const plan = planTaxonomy(context(db, config), draft);
		expect(plan.removedLevels).toEqual([
			{ code: "3", label: "3ª", records: 1, copies: 0, replacement: null },
		]);
		expect(plan.ready).toBe(false);
		expect(planTaxonomy(context(db, config), draft, { "level:3": "9" }).issues).toContainEqual(
			expect.objectContaining({ path: "classification.readingLevels", level: "error" }),
		);
		expect(planTaxonomy(context(db, config), draft, { "level:3": "4" }).ready).toBe(true);
		const result = saveTaxonomy(
			context(db, config),
			draft,
			{ replacements: { "level:3": "4" } },
			actor,
			NOW,
		);
		expect(result.callNumbers).toBe(3);
		expect(db.select().from(biblio).where(eq(biblio.id, fiction)).get()?.readingLevel).toBe(
			"4",
		);
		const copies = itemsOf(db, fiction);
		expect(copies.map((i) => i.callNumber)).toEqual(["B 4 PER", "B 4 PER", "B 4 PER"]);
		// the copies whose call number changed go back among the labels to print
		expect(copies.every((i) => i.spineLabelPrintedAt === null)).toBe(true);
		expect(
			loadConfig(configDir).config.classification.readingLevels.map((l) => l.code),
		).toEqual(["1", "2", "4", "5"]);
	});

	it("books can also lose their level, and a renamed level takes its books along", () => {
		const { db, config, actor, fiction } = fixture();
		saveTaxonomy(
			context(db, config),
			without(taxonomyOf(config), "3"),
			{ replacements: { "level:3": "" } },
			actor,
			NOW,
		);
		expect(
			db.select().from(biblio).where(eq(biblio.id, fiction)).get()?.readingLevel,
		).toBeNull();
		expect(itemsOf(db, fiction).map((i) => i.callNumber)).toEqual(["B PER", "B PER", "B PER"]);

		const saved = loadConfig(configDir).config;
		db.update(biblio).set({ readingLevel: "2" }).where(eq(biblio.id, fiction)).run();
		const renamed = taxonomyOf(saved);
		renamed.readingLevels = renamed.readingLevels.map((l) =>
			l.code === "2" ? { code: "II", label: "Seconda" } : l,
		);
		saveTaxonomy(
			context(db, saved),
			renamed,
			{ replacements: { "level:2": "II" } },
			actor,
			NOW,
		);
		expect(db.select().from(biblio).where(eq(biblio.id, fiction)).get()?.readingLevel).toBe(
			"II",
		);
		expect(itemsOf(db, fiction).map((i) => i.callNumber)).toEqual([
			"B II PER",
			"B II PER",
			"B II PER",
		]);
	});
});

describe("the scheme of the segnatura (Q143)", () => {
	it("counts the copies a new order changes, then computes them again on save", () => {
		const { db, config, actor, fiction, nonfiction } = fixture();
		const draft = {
			...taxonomyOf(config),
			callNumber: callNumberScheme("levelGenre", "author"),
		};
		// the non-fiction copy keeps its segnatura: only the fiction ones change
		expect(planTaxonomy(context(db, config), draft)).toMatchObject({
			ready: true,
			callNumbers: 3,
		});
		const result = saveTaxonomy(context(db, config), draft, {}, actor, NOW);
		expect(result.callNumbers).toBe(3);
		const copies = itemsOf(db, fiction);
		expect(copies.map((i) => i.callNumber)).toEqual(["3 B PER", "3 B PER", "3 B PER"]);
		expect(copies.map((i) => i.callHead)).toEqual(["3 B", "3 B", "3 B"]);
		expect(copies.every((i) => i.barcodeLabelPrintedAt === null)).toBe(true);
		expect(itemsOf(db, nonfiction).map((i) => i.callNumber)).toEqual(["590 PER"]);
		expect(itemsOf(db, nonfiction)[0]?.barcodeLabelPrintedAt).not.toBeNull();
	});

	it("keeps the segnature as the copies' texts when the scheme becomes free", () => {
		const { db, config, actor, fiction } = fixture();
		const draft = { ...taxonomyOf(config), callNumber: callNumberScheme("free", "author") };
		expect(planTaxonomy(context(db, config), draft).callNumbers).toBe(0);
		expect(saveTaxonomy(context(db, config), draft, {}, actor, NOW).callNumbers).toBe(0);
		const copies = itemsOf(db, fiction);
		expect(copies.map((i) => i.callText)).toEqual(["B 3 PER", "B 3 PER", "B 3 PER"]);
		expect(copies.map((i) => i.callNumber)).toEqual(["B 3 PER", "B 3 PER", "B 3 PER"]);
		expect(copies.every((i) => i.spineLabelPrintedAt !== null)).toBe(true);
	});
});

describe("pictograms of the taxonomy", () => {
	it("saves an upload as a file of the folder, drops the replaced one, and the history brings it back", async () => {
		const { db, config, actor } = fixture();
		const images = join(configDir, "classification", "images");
		mkdirSync(images, { recursive: true });
		writeFileSync(join(images, "A.png"), await solidImage(8, 8, "png", 10));
		writeFileSync(join(images, "10.png"), "x");
		writeFileSync(join(images, "2.png"), "x");
		writeFileSync(join(images, "notes.txt"), "x");
		// the shipped pictograms are SVG files of the same folder (step 11.14)
		expect(listPictogramFiles(configDir).filter((f) => f.endsWith(".png"))).toEqual([
			"2.png",
			"10.png",
			"A.png",
		]);
		expect(listPictogramFiles(configDir)).toContain("A.svg");

		const token = await stagePictogram(dataDir, await solidImage(16, 16, "png", 90));
		const draft = taxonomyOf(config);
		draft.genres = draft.genres.map((g) =>
			g.code === "A" ? { ...g, image: `draft:${token}` } : g,
		);
		const result = saveTaxonomy(context(db, config), draft, {}, actor, NOW);
		expect(existsSync(join(images, "A-20260925-101500.png"))).toBe(true);
		expect(existsSync(join(images, "A.svg"))).toBe(false);
		expect(stagedPictogramPath(dataDir, token)).toBeNull();
		expect(getConfig().classification.genres.find((g) => g.code === "A")?.image).toBe(
			"A-20260925-101500.png",
		);
		revertConfigChange(configDir, result.change);
		expect(existsSync(join(images, "A.svg"))).toBe(true);
		expect(existsSync(join(images, "A-20260925-101500.png"))).toBe(false);
		expect(getConfig().classification.genres.find((g) => g.code === "A")?.image).toBe("A.svg");
		expect(
			readdirSync(images)
				.filter((f) => !f.endsWith(".svg"))
				.sort(),
		).toEqual(["10.png", "2.png", "A.png", "notes.txt"]);
	});

	it("previews the spine band of a node of the draft, unsaved pictogram included", async () => {
		const config = loadConfig(configDir).config;
		const token = await stagePictogram(dataDir, await solidImage(12, 12, "png", 50));
		const draft = taxonomyOf(config);
		draft.genres.push({ code: "Z", label: "Zeta", image: `draft:${token}`, color: "#00ff00" });
		const preview = previewTaxonomyBand({ config, configDir, dataDir }, draft, {
			kind: "fiction",
			code: "Z",
		});
		const png = readFileSync(stagedPictogramPath(dataDir, token) ?? "").toString("base64");
		expect(preview.html).toContain(`data:image/png;base64,${png}`);
		expect(preview.html).toContain("Z 4");
		expect(preview).toMatchObject({ kind: "pair", widthMm: 70, heightMm: 48 });
		expect(preview.html.match(/class="cell /g)).toHaveLength(1);
		const child = previewTaxonomyBand({ config, configDir, dataDir }, draft, {
			kind: "nonfiction",
			code: "590",
		});
		expect(child.html).toContain("590");
		expect(() =>
			previewTaxonomyBand({ config, configDir, dataDir }, draft, {
				kind: "nonfiction",
				code: "Z",
			}),
		).toThrow(TaxonomyNodeNotFoundError);
	});
});
