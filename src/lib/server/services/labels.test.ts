// SPDX-License-Identifier: GPL-3.0-or-later
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { createTestDb } from "../../../../tests/helpers/db.js";
import { exampleRaw, parseConfig } from "#lib/server/config/load.js";
import type { AppConfig, LabelStock } from "#lib/server/config/schema.js";
import type { Db } from "#lib/server/db/client.js";
import { auditLog, item, staffUser } from "#lib/server/db/schema.js";
import { eq } from "drizzle-orm";
import { TemplateError } from "#lib/server/templates/engine.js";
import { renderBarcodeSvg } from "#lib/server/barcodes/render.js";
import { catalogRules, createBiblio } from "./catalog.js";
import { addItems, setItemStatus } from "./catalog-items.js";
import { classifyBiblio } from "./catalog-classify.js";
import { buildLabelContext, type LabelItem, sampleLabelItem } from "./label-context.js";
import {
	itemIdsOfBiblios,
	markItemLabelsPrinted,
	markLabelsPrinted,
	pendingLabelCounts,
	pendingLabelItemIds,
	selectItemsForLabels,
	unclassifiedCopyCount,
} from "./label-items.js";
import {
	LABEL_FIELDS,
	listLabelTemplates,
	loadLabelTemplate,
	unitFiles,
	variantFor,
} from "./label-templates.js";
import {
	calibrationSheetHtml,
	LabelGeometryError,
	labelPrintOptions,
	labelSheetHtml,
	placeUnits,
	renderLabelPreview,
	renderLabelsSheet,
	renderUnit,
	resolveLabelJob,
	sampleLabelsSheet,
	stockGeometry,
	StockNotFoundError,
} from "./labels.js";
import { cellPosition, unitPosition } from "#lib/shared/label-stock.js";

const config = parseConfig(exampleRaw()).config;
const rules = catalogRules(config);
const stockOf = (id: string): LabelStock => config.labels.stocks.find((s) => s.id === id)!;

const dirs: string[] = [];
const temp = (): string => {
	const d = mkdtempSync(join(tmpdir(), "bv-labels-"));
	dirs.push(d);
	return d;
};
afterEach(() => {
	for (const d of dirs.splice(0)) {
		rmSync(d, { recursive: true, force: true });
	}
});

const fiction = {
	title: "La casa segreta dei sette nani e del gatto con gli stivali",
	subtitle: "",
	originalTitle: "",
	responsibility: "",
	author: "Delitto, Anna",
	publisher: "Einaudi",
	publicationPlace: "",
	publicationYear: "2019",
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
	readingLevel: "4",
	subjects: "",
	notes: "",
};
const nonfiction = {
	...fiction,
	title: "Gli animali",
	author: "Rossi, Anna",
	kind: "nonfiction" as const,
	genreCode: "",
	classCode: "590",
	readingLevel: "",
};
const copy = {
	itemType: "libro",
	callNumber: "",
	readingLevel: "",
	enumeration: "",
	acquisitionDate: "",
	notes: "",
	notForLoan: false,
};

function seeded(): { db: Db; actor: { id: number }; fictionId: number; nonfictionId: number } {
	const db = createTestDb();
	const actor = db
		.insert(staffUser)
		.values({ username: "u", passwordHash: "x", roles: [] })
		.returning({ id: staffUser.id })
		.get();
	const fictionId = createBiblio(db, fiction, actor, rules);
	const nonfictionId = createBiblio(db, nonfiction, actor, rules);
	return { db, actor, fictionId, nonfictionId };
}

describe("label templates", () => {
	it("ships pair, barcode and spine templates with the declared cells, files and variants", () => {
		const all = listLabelTemplates(temp());
		expect(all.map((t) => t.name)).toEqual([
			"barcode-default",
			"pair-default",
			"spine-default",
		]);
		expect(all.every((t) => t.error === null)).toBe(true);
		const pair = loadLabelTemplate("pair-default", temp());
		expect(pair.meta.kind).toBe("pair");
		expect(unitFiles(pair.meta)).toEqual(["top.html", "bottom.html"]);
		expect(variantFor(pair.meta, 48)).toEqual({
			variant: "full",
			files: ["top.html", "bottom.html"],
		});
		expect(variantFor(pair.meta, 24)).toEqual({
			variant: "compact",
			files: ["top-compact.html", "bottom-compact.html"],
		});
		const spine = loadLabelTemplate("spine-default", temp());
		expect(unitFiles(spine.meta)).toEqual(["label.html"]);
		expect(variantFor(spine.meta, 21.2).variant).toBe("compact");
	});

	it("uses the file convention when files are not declared and refuses mismatched counts", () => {
		const configDir = temp();
		const dir = join(configDir, "labels", "templates", "tre");
		mkdirSync(dir, { recursive: true });
		writeFileSync(
			join(dir, "template.json"),
			JSON.stringify({ name: "tre", kind: "spine", unit: { cells: 3 } }),
		);
		expect(unitFiles(loadLabelTemplate("tre", configDir).meta)).toEqual([
			"cell-1.html",
			"cell-2.html",
			"cell-3.html",
		]);
		writeFileSync(
			join(dir, "template.json"),
			JSON.stringify({
				name: "tre",
				kind: "spine",
				unit: { cells: 2, files: ["a.html"] },
				variants: { x: { files: ["a.html", "b.html", "c.html"] } },
			}),
		);
		expect(() => loadLabelTemplate("tre", configDir)).toThrow(TemplateError);
		expect(listLabelTemplates(configDir).find((t) => t.name === "tre")?.error).toContain(
			"unit.files",
		);
		expect(() => loadLabelTemplate("nope", configDir)).toThrow(TemplateError);
	});
});

describe("stock geometry", () => {
	it("computes cells, units and positions for the three stocks", () => {
		const g = stockGeometry(stockOf("a4-70x48"), 2);
		expect(g).toMatchObject({ cells: 2, unitRows: 3, unitsPerPage: 9, cellsPerPage: 18 });
		expect(g.unitHeightMm).toBe(96);
		// cell 4 is the first of the second row
		expect(cellPosition(g.stock, 3)).toEqual({ column: 0, row: 1, xMm: 0, yMm: 52 });
		expect(cellPosition(g.stock, 5)).toEqual({ column: 2, row: 1, xMm: 140, yMm: 52 });
		// unit 4 (index 3) sits in column 0 of the second unit row: cells 7 and 10
		const u = unitPosition(g, 3);
		expect(u).toMatchObject({ column: 0, xMm: 0, yMm: 4 + 96 });
		expect(u.cells.map((c) => c.yMm)).toEqual([100, 148]);

		const single = stockGeometry(stockOf("l7159"), 1);
		expect(single).toMatchObject({ unitsPerPage: 24, unitRows: 8 });
		expect(cellPosition(single.stock, 1).xMm).toBeCloseTo(7.2 + 63.5 + 2.5);

		const small = stockGeometry(stockOf("l7651"), 1);
		expect(small.unitsPerPage).toBe(65);
		expect(cellPosition(small.stock, 64)).toMatchObject({ column: 4, row: 12 });
		expect(cellPosition(small.stock, 64).yMm).toBeCloseTo(10.7 + 12 * 21.2);
	});

	it("refuses rows that are not a multiple of the unit and stocks beyond the page", () => {
		expect(() => stockGeometry(stockOf("l7651"), 2)).toThrow(LabelGeometryError);
		expect(() => stockGeometry(stockOf("l7651"), 2)).toThrow(/13 rows/);
		const wide: LabelStock = { ...stockOf("a4-70x48"), columns: 4 };
		expect(() => stockGeometry(wide, 1)).toThrow(/page width/);
		const tall: LabelStock = { ...stockOf("a4-70x48"), rows: 7 };
		expect(() => stockGeometry(tall, 1)).toThrow(/page height/);
	});

	it("lays units from the start position across pages", () => {
		const g = stockGeometry(stockOf("a4-70x48"), 2);
		const placed = placeUnits(g, 12, 8);
		expect(placed[0]).toEqual({ unit: 0, page: 0, slot: 7 });
		expect(placed[1]).toEqual({ unit: 1, page: 0, slot: 8 });
		expect(placed[2]).toEqual({ unit: 2, page: 1, slot: 0 });
		expect(placed[11]).toEqual({ unit: 11, page: 2, slot: 0 });
		expect(placeUnits(g, 0, 1)).toEqual([]);
		expect(() => placeUnits(g, 1, 10)).toThrow(LabelGeometryError);
		expect(() => placeUnits(g, 1, 0)).toThrow(/start position/);
	});
});

describe("label context", () => {
	it("splits the call number, truncates the title and resolves the classification", () => {
		const it_: LabelItem = sampleLabelItem(config, "fiction");
		const meta = loadLabelTemplate("pair-default", temp()).meta;
		const ctx = buildLabelContext(it_, config, temp(), meta);
		expect(ctx.call).toEqual({ head: "A 4", rest: "DEL" });
		expect(ctx.item.call_number).toBe("A 4 DEL");
		expect(ctx.classification).toMatchObject({
			is_fiction: true,
			is_nonfiction: false,
			code: "A",
			reading_level: "4",
		});
		expect(ctx.classification.image_url.startsWith("data:image/svg+xml;base64,")).toBe(true);
		expect(ctx.barcode_svg.startsWith("<svg")).toBe(true);
		expect(ctx.biblio.author_short).toBe("Delitto");
		expect(ctx.labels.monochrome).toBe(false);

		const nf = buildLabelContext(sampleLabelItem(config, "nonfiction"), config, temp(), meta);
		expect(nf.call).toEqual({ head: "590", rest: "ROS" });
		expect(nf.classification).toMatchObject({ is_nonfiction: true, code: "590" });
		expect(nf.classification.label.length).toBeGreaterThan(0);
		expect(nf.biblio.title_short).toBe("Gli animali della fattoria e d");
		expect(Array.from(nf.biblio.title_short).length).toBe(30);
	});

	it("inherits the parent's pictogram, falls back to a suggested call number and reads the copy's class", () => {
		const configDir = temp();
		mkdirSync(join(configDir, "classification", "images"), { recursive: true });
		writeFileSync(join(configDir, "classification", "images", "500.svg"), "<svg/>");
		const meta = loadLabelTemplate("pair-default", configDir).meta;
		const child: LabelItem = {
			...sampleLabelItem(config, "nonfiction"),
			callNumber: null,
			classCode: "590",
		};
		const perItem: AppConfig = {
			...config,
			classification: { ...config.classification, classPerItem: true },
		};
		const ctx = buildLabelContext({ ...child, readingLevel: "2" }, perItem, configDir, meta);
		expect(ctx.item.call_number).toBe("590 ROS");
		expect(ctx.classification.image_url).toBe(
			`data:image/svg+xml;base64,${Buffer.from("<svg/>").toString("base64")}`,
		);
		expect(ctx.classification.reading_level).toBe("2");
	});
});

describe("rendering", () => {
	it("renders the pair unit field by field, escaped, with the pictogram inlined", () => {
		const template = loadLabelTemplate("pair-default", temp());
		const it_ = { ...sampleLabelItem(config, "fiction"), title: "Il <gatto> & C." };
		const ctx = buildLabelContext(it_, config, temp(), template.meta);
		const unit = renderUnit(template, ["top.html", "bottom.html"], ctx, 7);
		expect(unit.cells).toHaveLength(2);
		const [top, bottom] = unit.cells as [string, string];
		expect(top).toContain(">2026-02678<");
		expect(top).toContain("Il &lt;gatto&gt; &amp; C.");
		expect(top).toContain('src="data:image/svg+xml;base64,');
		expect(top).toContain('<div class="head">A 4</div>');
		expect(top).toContain('<div class="sub">DEL</div>');
		expect(bottom).toContain('<div class="call">A 4 DEL</div>');
		expect(bottom).toContain("<svg");
		expect(unit.css).toContain(".tpl-labels-pair-default .band");
		expect(unit.scope).toBe("tpl-labels-pair-default");

		const nf = buildLabelContext(
			sampleLabelItem(config, "nonfiction"),
			config,
			temp(),
			template.meta,
		);
		const top2 = renderUnit(template, ["top.html", "bottom.html"], nf, 8).cells[0] ?? "";
		expect(top2).toContain('<div class="head">590</div>');
		expect(top2).toMatch(/<div class="sub">[^<]+<\/div>/);
		expect(top2).not.toContain("ROS</div>");
	});

	it("refuses templates with unknown fields and lists the allowlist", () => {
		const configDir = temp();
		const dir = join(configDir, "labels", "templates", "bad");
		mkdirSync(dir, { recursive: true });
		writeFileSync(join(dir, "template.json"), JSON.stringify({ name: "bad", kind: "barcode" }));
		writeFileSync(join(dir, "label.html"), "<b>{{patron.name}}</b>");
		const template = loadLabelTemplate("bad", configDir);
		const ctx = buildLabelContext(sampleLabelItem(config), config, configDir, template.meta);
		expect(() => renderUnit(template, ["label.html"], ctx, 1)).toThrow(/unknown field/);
		expect(LABEL_FIELDS).toContain("call.head");
		expect(LABEL_FIELDS).toContain("classification.image_url");
	});

	it("places the units on the stock grid, one page every nine pairs, from the start position", () => {
		const template = loadLabelTemplate("pair-default", temp());
		const g = stockGeometry(stockOf("a4-70x48"), 2);
		const ctx = buildLabelContext(sampleLabelItem(config), config, temp(), template.meta);
		const units = Array.from({ length: 10 }, (_, i) =>
			renderUnit(template, ["top.html", "bottom.html"], ctx, i + 1),
		);
		const { html, pages } = labelSheetHtml("Etichette", units, g, { start: 9, lang: "it" });
		expect(pages).toBe(2);
		expect(html.match(/class="page"/g)).toHaveLength(2);
		expect(html.match(/class="cell /g)).toHaveLength(20);
		// the first unit fills the last slot of page 1: column 2, unit row 2
		expect(html).toContain(
			'style="left:140mm;top:196mm" data-item="1" data-unit="1" data-cell="1"',
		);
		expect(html).toContain(
			'style="left:140mm;top:244mm" data-item="1" data-unit="1" data-cell="2"',
		);
		expect(html).toContain(
			'style="left:0mm;top:4mm" data-item="2" data-unit="2" data-cell="1"',
		);
		expect(html).toContain("@page { size: A4 portrait; margin: 0; }");
		expect(html).not.toContain("outline:");
		expect(html).not.toContain("<script");
	});

	it("resolves the configured template, stock and variant per kind and validates overrides", () => {
		const r = resolveLabelJob(config, temp(), "pair");
		expect(r.geometry.stock.id).toBe("a4-70x48");
		expect(r.variant).toBe("full");
		const compact = resolveLabelJob(config, temp(), "pair", { stockId: "a4-70x24" });
		expect(compact.variant).toBe("compact");
		expect(compact.files).toEqual(["top-compact.html", "bottom-compact.html"]);
		expect(() => resolveLabelJob(config, temp(), "pair", { stockId: "nope" })).toThrow(
			StockNotFoundError,
		);
		expect(() => resolveLabelJob(config, temp(), "pair", { stockId: "l7651" })).toThrow(
			LabelGeometryError,
		);
		expect(() => resolveLabelJob(config, temp(), "pair", { templateName: "nope" })).toThrow(
			TemplateError,
		);
	});

	it("sample sheets fill one page and the preview is one unit at the given zoom", () => {
		const sheet = sampleLabelsSheet(config, temp(), "pair");
		expect(sheet).toMatchObject({ count: 9, pages: 1, stock: "a4-70x48", variant: "full" });
		expect(sampleLabelsSheet(config, temp(), "spine", { stockId: "l7651" }).count).toBe(65);
		const preview = renderLabelPreview(config, temp(), "pair-default", { zoom: 2 });
		expect(preview).toMatchObject({ kind: "pair", widthMm: 70, heightMm: 96, zoom: 2 });
		expect(preview.html).toContain("zoom: 2");
		expect(preview.html.match(/class="cell /g)).toHaveLength(2);
		const spine = renderLabelPreview(config, temp(), "spine-default", {
			stockId: "l7651",
			sample: "nonfiction",
		});
		expect(spine).toMatchObject({ variant: "compact", heightMm: 21.2 });
		expect(spine.html).toContain('class="spine"');
		const mono = renderLabelPreview(
			{ ...config, labels: { ...config.labels, monochrome: true } },
			temp(),
			"spine-default",
			{ stockId: "l7651" },
		);
		expect(mono.html).toContain('class="spine hatched"');
	});

	it("writes the label barcode fixture decoded by the browser test", () => {
		// tests/fixtures/barcodes/label-code128.svg is decoded in scanner.svelte.spec.ts
		mkdirSync("tests/fixtures/barcodes", { recursive: true });
		const template = loadLabelTemplate("pair-default", temp());
		// the built-in template follows `barcodes.item.symbology` (Code 128 by default)
		const symbology = template.meta.barcode.symbology ?? config.barcodes.item.symbology;
		writeFileSync(
			"tests/fixtures/barcodes/label-code128.svg",
			renderBarcodeSvg("2026-02678", {
				symbology,
				text: template.meta.barcode.text,
				heightMm: template.meta.barcode.heightMm,
				scale: 3,
			}),
		);
		expect(template.meta.barcode.symbology).toBeUndefined();
		expect(symbology).toBe("code128");
	});
});

describe("selection and jobs", () => {
	it("selects copies by id (in order), record, pending kind and acquisition range", () => {
		const { db, actor, fictionId, nonfictionId } = seeded();
		const a = addItems(
			db,
			fictionId,
			{ ...copy, acquisitionDate: "2026-01-10" },
			2,
			actor,
			rules,
		);
		const b = addItems(
			db,
			nonfictionId,
			{ ...copy, acquisitionDate: "2026-03-01" },
			1,
			actor,
			rules,
		);
		const [a1, a2] = a.ids as [number, number];
		const b1 = b.ids[0]!;
		expect(selectItemsForLabels(db, {})).toEqual([]);
		expect(selectItemsForLabels(db, { ids: [b1, a1] }).map((i) => i.id)).toEqual([b1, a1]);
		expect(selectItemsForLabels(db, { biblioIds: [fictionId] }).map((i) => i.id)).toEqual([
			a1,
			a2,
		]);
		expect(selectItemsForLabels(db, { pending: "pair" })).toHaveLength(3);
		expect(selectItemsForLabels(db, { from: "2026-02-01" }).map((i) => i.id)).toEqual([b1]);
		expect(selectItemsForLabels(db, { from: "2026-01-01", to: "2026-01-31" })).toHaveLength(2);
		expect(itemIdsOfBiblios(db, [nonfictionId, fictionId])).toEqual([a1, a2, b1]);
		expect(itemIdsOfBiblios(db, [])).toEqual([]);

		// printed flags: barcode only → still pending for pair and spine
		expect(markLabelsPrinted(db, "barcode", [a1])).toBe(1);
		expect(selectItemsForLabels(db, { pending: "barcode" }).map((i) => i.id)).toEqual([a2, b1]);
		expect(selectItemsForLabels(db, { pending: "spine" })).toHaveLength(3);
		expect(markLabelsPrinted(db, "pair", [a1, a2])).toBe(2);
		expect(selectItemsForLabels(db, { pending: "pair" }).map((i) => i.id)).toEqual([b1]);
		expect(markLabelsPrinted(db, "spine", [])).toBe(0);
		// the dashboard's dialog marks exactly the copies of the pending sheet (9.42)
		expect(pendingLabelItemIds(db, "pair")).toEqual([b1]);
		expect(pendingLabelItemIds(db, "barcode")).toEqual([b1]);
		// from the record page or the print dialog: the flags and their audit row
		expect(markItemLabelsPrinted(db, "barcode", [b1], actor)).toBe(1);
		expect(
			db
				.select()
				.from(auditLog)
				.where(eq(auditLog.action, "item.labels_printed"))
				.all()
				.map((r) => r.details),
		).toEqual([{ kind: "barcode", count: 1 }]);
		db.update(item).set({ barcodeLabelPrintedAt: null }).where(eq(item.id, b1)).run();
		const row = db.select().from(item).where(eq(item.id, a1)).get()!;
		expect(row.barcodeLabelPrintedAt).not.toBeNull();
		expect(row.spineLabelPrintedAt).not.toBeNull();
		expect(pendingLabelCounts(db)).toEqual({ pair: 1, barcode: 1, spine: 1 });

		// lost copies are skipped by filters but printed when asked for by id
		setItemStatus(db, b1, "lost", "sparito", actor);
		expect(selectItemsForLabels(db, { pending: "pair" })).toEqual([]);
		expect(selectItemsForLabels(db, { ids: [b1] })).toHaveLength(1);
		expect(pendingLabelCounts(db).pair).toBe(0);
	});

	it("gives the turn to the requests waiting while it renders a sheet", async () => {
		const { db, actor, fictionId } = seeded();
		const a = addItems(db, fictionId, copy, 3, actor, rules);
		const order: string[] = [];
		// a request that arrives while the sheet is rendered
		setImmediate(() => order.push("other request"));
		await renderLabelsSheet(
			{ db, config, configDir: temp() },
			"pair",
			{ ids: a.ids },
			{ breakAfterMs: 0 },
		).then(() => order.push("sheet"));
		expect(order).toEqual(["other request", "sheet"]);
	});

	it("renders a whole job from the database with the copies' own data", async () => {
		const { db, actor, fictionId, nonfictionId } = seeded();
		const a = addItems(db, fictionId, copy, 1, actor, rules);
		const b = addItems(db, nonfictionId, copy, 1, actor, rules);
		const job = await renderLabelsSheet(
			{ db, config, configDir: temp() },
			"pair",
			{ ids: [...a.ids, ...b.ids] },
			{ start: 2 },
		);
		expect(job).toMatchObject({
			count: 2,
			pages: 1,
			template: "pair-default",
			stock: "a4-70x48",
		});
		expect(job.itemIds).toEqual([...a.ids, ...b.ids]);
		expect(job.html).toContain(a.barcodes[0]);
		expect(job.html).toContain('<div class="head">B 4</div>');
		expect(job.html).toContain('<div class="call">590 ROS</div>');
		expect(job.html).toContain("La casa segreta dei sette nani");
		expect(job.html).toContain(`data-item="${a.ids[0]}" data-unit="1"`);
		// start 2 → the first unit sits in column 1
		expect(job.html).toContain(`left:70mm;top:4mm" data-item="${a.ids[0]}"`);
		const single = await renderLabelsSheet({ db, config, configDir: temp() }, "barcode", {
			ids: a.ids,
		});
		expect(single.html.match(/class="cell /g)).toHaveLength(1);
		const spine = await renderLabelsSheet(
			{ db, config, configDir: temp() },
			"spine",
			{ ids: a.ids },
			{ stockId: "l7651" },
		);
		expect(spine.variant).toBe("compact");
	});
});

describe("copies of a record still to classify (step 9.21)", () => {
	it("print their barcode label only; the spine band waits for the classification", async () => {
		const { db, actor, fictionId } = seeded();
		const laterId = createBiblio(
			db,
			{
				...fiction,
				title: "Da classificare",
				isbn: "",
				kind: "",
				genreCode: "",
				readingLevel: "",
			},
			actor,
			rules,
		);
		const classified = addItems(db, fictionId, copy, 1, actor, rules);
		const later = addItems(db, laterId, copy, 1, actor, rules);
		const ids = [...classified.ids, ...later.ids];
		expect(unclassifiedCopyCount(db)).toBe(1);
		expect(pendingLabelCounts(db)).toEqual({ pair: 2, barcode: 2, spine: 1 });

		const pair = await renderLabelsSheet({ db, config, configDir: temp() }, "pair", { ids });
		expect(pair.count).toBe(2);
		expect(pair.withoutSpine).toBe(1);
		expect(pair.html).toContain(later.barcodes[0]);
		// one spine band only: the classified copy's
		expect(pair.html.match(/class="band"/g)).toHaveLength(1);
		const spine = await renderLabelsSheet({ db, config, configDir: temp() }, "spine", { ids });
		expect(spine.itemIds).toEqual(classified.ids);
		expect(spine.withoutSpine).toBe(1);
		expect(
			(await renderLabelsSheet({ db, config, configDir: temp() }, "barcode", { ids }))
				.withoutSpine,
		).toBe(0);

		// "Segna come stampate" on the pair: no band was printed for the unclassified copy
		markLabelsPrinted(db, "pair", ids);
		const flags = (id: number): { b: string | null; s: string | null } | undefined =>
			db
				.select({ b: item.barcodeLabelPrintedAt, s: item.spineLabelPrintedAt })
				.from(item)
				.where(eq(item.id, id))
				.get();
		expect(flags(later.ids[0]!)).toMatchObject({ s: null });
		expect(flags(later.ids[0]!)?.b).not.toBeNull();
		expect(flags(classified.ids[0]!)?.s).not.toBeNull();
		// nothing is pending until it is classified, then its band is
		expect(pendingLabelCounts(db)).toEqual({ pair: 0, barcode: 0, spine: 0 });
		classifyBiblio(
			db,
			laterId,
			{ kind: "nonfiction", genreCode: "", classCode: "590", readingLevel: "" },
			actor,
			rules,
		);
		expect(pendingLabelCounts(db)).toEqual({ pair: 1, barcode: 0, spine: 1 });
		expect(unclassifiedCopyCount(db)).toBe(0);
	});
});

describe("calibration page with units", () => {
	it("outlines the cells and, for pairs, the units", () => {
		const html = calibrationSheetHtml(config, "a4-70x48", { title: "T", ruler: "R" }, 2);
		expect(html.match(/class="cell"/g)).toHaveLength(18);
		expect(html.match(/class="unit"/g)).toHaveLength(9);
		expect(html).toContain('data-unit-cells="2"');
		expect(html).toContain("height: 96mm");
		expect(() => calibrationSheetHtml(config, "l7651", { title: "T", ruler: "R" }, 2)).toThrow(
			LabelGeometryError,
		);
	});
});

describe("calibration page", () => {
	it("outlines every cell of a stock at its geometry", () => {
		const stock = config.labels.stocks.find((s) => s.id === "a4-70x48")!;
		const html = calibrationSheetHtml(config, stock.id, { title: "Calibrazione", ruler: "R" });
		expect(html.match(/class="cell"/g)).toHaveLength(stock.rows * stock.columns);
		expect(html).toContain(`left:${stock.marginMm.left}mm;top:${stock.marginMm.top}mm`);
		expect(html).toContain(
			`left:${stock.marginMm.left + stock.labelMm.width + stock.gapMm.x}mm;top:${stock.marginMm.top}mm`,
		);
		expect(html).toContain(`data-stock="${stock.id}"`);
		expect(html).toContain(stock.name);
		expect(() => calibrationSheetHtml(config, "nope", { title: "", ruler: "" })).toThrow(
			StockNotFoundError,
		);
	});
});

describe("print dialog", () => {
	it("offers each kind with its template's cells and the units of a page per stock", () => {
		const options = labelPrintOptions(config, temp());
		expect(options.map((o) => [o.kind, o.template, o.cells])).toEqual([
			["pair", config.labels.pair.template, 2],
			["barcode", config.labels.barcode.template, 1],
			["spine", config.labels.spine.template, 1],
		]);
		const pair = options[0]!;
		// a stock of 13 rows cannot hold pairs: it is not offered for them
		expect(pair.unitsPerPage["a4-70x48"]).toBe(9);
		expect("l7651" in pair.unitsPerPage).toBe(false);
		expect(options[1]?.unitsPerPage.l7651).toBe(65);
	});
});
