// SPDX-License-Identifier: GPL-3.0-or-later
// Book labels (PLAN.md §3.12, step 3.8, Appendix G): pairs (spine band + barcode label), single
// barcode labels and spine bands printed on the sheet of an adhesive stock — units of stacked
// cells placed by the stock's geometry from a start position that skips used labels, the variant
// of the cell height — plus the sample sheet, the preview of one unit, the calibration page of a
// stock and the options of the print dialog. Templates in `label-templates.ts`, the context of a
// copy in `label-context.ts`, the copies and their printed flags in `label-items.ts`.
import { NotFoundError } from "#lib/server/errors.js";
import type { AppConfig, LabelStock } from "#lib/server/config/schema.js";
import type { ServerContext } from "#lib/server/context.js";
import { assertDemoPrintSheets } from "#lib/server/demo/public.js";
import { breaks } from "#lib/server/runtime/breaks.js";
import {
	escapeHtml,
	pageCss,
	previewDocument,
	printDocument,
	rulerSvg,
	SCREEN_PAGES_CSS,
} from "#lib/server/templates/document.js";
import { renderTemplate, shareDataUrls } from "#lib/server/templates/engine.js";
import {
	cellPosition,
	placeUnits as placeStockUnits,
	startInRange,
	stockProblems,
	unitGrid,
	unitPosition,
	type PlacedUnit,
	type UnitGrid,
} from "#lib/shared/label-stock.js";
import { PAPER_MM } from "#lib/shared/paper.js";
import {
	buildLabelContext,
	sampleLabelItem,
	type LabelContext,
	type LabelItem,
} from "./label-context.js";
import { selectItemsForLabels, type LabelSelection } from "./label-items.js";
import {
	LABEL_FIELDS,
	LABEL_KINDS,
	listLabelTemplates,
	loadLabelTemplate,
	variantFor,
	type LabelKind,
	type LoadedLabelTemplate,
} from "./label-templates.js";

// --- Geometry (the pure rules in #lib/shared/label-stock.ts) -----------------------------------

export class LabelGeometryError extends Error {
	constructor(
		readonly stock: string,
		readonly reason: "rowsNotMultiple" | "overflowX" | "overflowY" | "startOutOfRange",
		message: string,
	) {
		super(message);
		this.name = "LabelGeometryError";
	}
}

export class StockNotFoundError extends NotFoundError {
	constructor(readonly id: string) {
		super("label stock", `label stock ${id} not found`);
		this.name = "StockNotFoundError";
	}
}

export interface StockGeometry extends UnitGrid {
	stock: LabelStock;
	paper: { width: number; height: number };
}

export function findStock(config: AppConfig, id: string): LabelStock {
	const stock = config.labels.stocks.find((s) => s.id === id);
	if (!stock) {
		throw new StockNotFoundError(id);
	}
	return stock;
}

/** Checks the stock against the page and the unit shape; throws a readable error otherwise. */
export function stockGeometry(stock: LabelStock, cells = 1): StockGeometry {
	const paper = PAPER_MM[stock.paper];
	const [problem] = stockProblems(stock, cells, paper);
	if (problem?.reason === "rowsNotMultiple") {
		throw new LabelGeometryError(
			stock.id,
			problem.reason,
			`stock ${stock.id}: ${problem.rows} rows are not a multiple of ${cells} cells per unit`,
		);
	}
	if (problem) {
		const side = problem.reason === "overflowX" ? "width" : "height";
		throw new LabelGeometryError(
			stock.id,
			problem.reason,
			`stock ${stock.id}: ${problem.usedMm} mm of labels exceed the ${problem.paperMm} mm page ${side}`,
		);
	}
	return { stock, paper, ...unitGrid(stock, cells) };
}

/**
 * Lays `count` units on pages from `start` (1-based position on the first page, to skip labels
 * already used on a partially printed sheet). Throws when `start` exceeds the page.
 */
export function placeUnits(geometry: StockGeometry, count: number, start = 1): PlacedUnit[] {
	if (!startInRange(start, geometry.unitsPerPage)) {
		throw new LabelGeometryError(
			geometry.stock.id,
			"startOutOfRange",
			`start position ${start} is outside 1–${geometry.unitsPerPage}`,
		);
	}
	return placeStockUnits(geometry.unitsPerPage, count, start);
}

/** Units per page of a stock for units of `cells` labels, or null when the stock cannot print them. */
function unitsPerPageOf(stock: LabelStock, cells: number): number | null {
	try {
		return stockGeometry(stock, cells).unitsPerPage;
	} catch (e) {
		if (e instanceof LabelGeometryError) {
			return null;
		}
		throw e;
	}
}

// --- Rendering ------------------------------------------------------------------------------

export interface RenderedUnit {
	itemId: number;
	/** One HTML fragment per cell, top to bottom. */
	cells: string[];
	css: string;
	scope: string;
}

export function renderUnit(
	template: LoadedLabelTemplate,
	files: string[],
	context: LabelContext,
	itemId: number,
): RenderedUnit {
	const rendered = renderTemplate(template.folder, files, context, LABEL_FIELDS);
	return {
		itemId,
		cells: files.map((f) => rendered.html[f] ?? ""),
		css: rendered.css,
		scope: rendered.scope,
	};
}

/** CSS of the sheet wrapper: page, absolutely positioned cells, no outlines (calibration draws them). */
export function labelSheetCss(geometry: StockGeometry, outlines = false): string {
	const { stock, paper } = geometry;
	return [
		...pageCss(paper, `${stock.paper} portrait`),
		`.cell { position: absolute; width: ${stock.labelMm.width}mm; height: ${stock.labelMm.height}mm; box-sizing: border-box; overflow: hidden; border-radius: ${stock.cornerRadiusMm}mm; ${outlines ? "outline: 0.2mm dashed #888; outline-offset: -0.2mm;" : ""} }`,
		SCREEN_PAGES_CSS,
	].join("\n");
}

/** A complete HTML document with the units placed on the stock grid from `start`. */
export function labelSheetHtml(
	title: string,
	units: RenderedUnit[],
	geometry: StockGeometry,
	options: { start?: number; lang: string },
): { html: string; pages: number } {
	const { start = 1, lang } = options;
	const placed = placeUnits(geometry, units.length, start);
	const css = new Map<string, string>();
	const pages: string[][] = [];
	placed.forEach((p, i) => {
		const unit = units[i];
		if (!unit) {
			return;
		}
		css.set(unit.scope, unit.css);
		const position = unitPosition(geometry, p.slot);
		const cells = unit.cells
			.map(
				(html, k) =>
					`<div class="cell ${unit.scope}" style="left:${position.cells[k]?.xMm ?? 0}mm;top:${position.cells[k]?.yMm ?? 0}mm" data-item="${unit.itemId}" data-unit="${p.unit + 1}" data-cell="${k + 1}">${html}</div>`,
			)
			.join("");
		(pages[p.page] ??= []).push(cells);
	});
	// each picture of the labels once in the document (step 9.29)
	const shared = shareDataUrls(
		pages
			.map((cells, i) => `<div class="page" data-page="${i + 1}">${cells.join("\n")}</div>`)
			.join("\n"),
	);
	return {
		html: printDocument({
			title,
			lang,
			styles: [labelSheetCss(geometry), [...css.values()].join("\n"), shared.css],
			body: shared.body,
		}),
		pages: pages.length,
	};
}

// --- Jobs -----------------------------------------------------------------------------------

export interface LabelJobOptions {
	/** Overrides `labels.<kind>.template`. */
	templateName?: string;
	/** Overrides `labels.<kind>.stock`. */
	stockId?: string;
	/** 1-based first unit on the first page. */
	start?: number;
	title?: string;
	builtinRoot?: string;
	/** Work before giving the turn to other requests (`breaks`); tests use 0. */
	breakAfterMs?: number;
}

export interface LabelsJob {
	html: string;
	count: number;
	pages: number;
	template: string;
	stock: string;
	variant: string | null;
	itemIds: number[];
	/** Copies of records still to classify: left out of a spine job, without their band in a pair. */
	withoutSpine: number;
}

/** Resolves template, stock, geometry and variant for a kind and its options. */
export function resolveLabelJob(
	config: AppConfig,
	configDir: string,
	kind: LabelKind,
	options: LabelJobOptions = {},
): {
	template: LoadedLabelTemplate;
	geometry: StockGeometry;
	variant: string | null;
	files: string[];
} {
	const job = config.labels[kind];
	const template = loadLabelTemplate(
		options.templateName ?? job.template,
		configDir,
		options.builtinRoot,
	);
	return { template, ...templateOnStock(config, template, options.stockId ?? job.stock) };
}

/** A loaded template on a stock: the sheet's geometry and the layout of the stock's height. */
function templateOnStock(
	config: AppConfig,
	template: LoadedLabelTemplate,
	stockId: string,
): { geometry: StockGeometry; variant: string | null; files: string[] } {
	const stock = findStock(config, stockId);
	const geometry = stockGeometry(stock, template.meta.unit.cells);
	const { variant, files } = variantFor(template.meta, stock.labelMm.height);
	return { geometry, variant, files };
}

/**
 * Renders the sheet of a selection. The units are rendered with breaks (a few milliseconds of
 * work, then the requests waiting are served): a sheet of every copy no longer holds the server.
 */
export async function renderLabelsSheet(
	{ db, config, configDir }: Pick<ServerContext, "db" | "config" | "configDir">,
	kind: LabelKind,
	selection: LabelSelection,
	options: LabelJobOptions = {},
): Promise<LabelsJob> {
	const { template, geometry, variant, files } = resolveLabelJob(
		config,
		configDir,
		kind,
		options,
	);
	const selected = selectItemsForLabels(db, selection);
	// the spine band waits for the classification (step 9.21): a spine job leaves those copies
	// out, a pair prints their barcode label with the band's cell (the top one) left blank
	const items = kind === "spine" ? selected.filter((it) => it.kind !== null) : selected;
	const withoutSpine = kind === "barcode" ? 0 : selected.filter((it) => it.kind === null).length;
	// the public demo stops a big job before it is rendered
	assertDemoPrintSheets(
		(placeUnits(geometry, items.length, options.start).at(-1)?.page ?? -1) + 1,
	);
	const pictograms = new Map<string, string>();
	const pause = breaks(options.breakAfterMs);
	const units: RenderedUnit[] = [];
	for (const it of items) {
		await pause();
		const unit = renderUnit(
			template,
			files,
			buildLabelContext(it, config, configDir, template.meta, pictograms),
			it.id,
		);
		units.push(
			kind === "pair" && it.kind === null
				? { ...unit, cells: unit.cells.map((c, i) => (i === 0 ? "" : c)) }
				: unit,
		);
	}
	const { html, pages } = labelSheetHtml(options.title ?? "Etichette", units, geometry, {
		start: options.start,
		lang: config.ui.locale,
	});
	return {
		html,
		count: units.length,
		pages,
		template: template.folder.name,
		stock: geometry.stock.id,
		variant,
		itemIds: items.map((i) => i.id),
		withoutSpine,
	};
}

/** A whole sheet of sample units (one page) for the template page and the stock check. */
export function sampleLabelsSheet(
	config: AppConfig,
	configDir: string,
	kind: LabelKind,
	options: LabelJobOptions = {},
): LabelsJob {
	const { template, geometry, variant, files } = resolveLabelJob(
		config,
		configDir,
		kind,
		options,
	);
	const pictograms = new Map<string, string>();
	const samples = [
		sampleLabelItem(config, "fiction"),
		sampleLabelItem(config, "nonfiction"),
	] as const;
	const units = Array.from({ length: geometry.unitsPerPage }, (_, i) => {
		const it = i % 2 === 0 ? samples[0] : samples[1];
		return renderUnit(
			template,
			files,
			buildLabelContext(it, config, configDir, template.meta, pictograms),
			0,
		);
	});
	const { html, pages } = labelSheetHtml(options.title ?? "Etichette", units, geometry, {
		lang: config.ui.locale,
	});
	return {
		html,
		count: units.length,
		pages,
		template: template.folder.name,
		stock: geometry.stock.id,
		variant,
		itemIds: [],
		withoutSpine: 0,
	};
}

export interface LabelPreview {
	template: string;
	kind: LabelKind;
	stock: string;
	variant: string | null;
	/** A complete HTML document of one unit, for `<iframe sandbox srcdoc>`. */
	html: string;
	widthMm: number;
	heightMm: number;
	zoom: number;
}

/**
 * One sample unit of a template on a stock, as a standalone document at the given zoom. `item`
 * replaces the sample copy, `pictograms` pre-resolves pictograms by code (images not saved yet)
 * and `firstCellOnly` keeps the top cell alone (the spine band of a pair).
 */
export function renderLabelPreview(
	config: AppConfig,
	configDir: string,
	templateName: string,
	options: {
		stockId?: string;
		zoom?: number;
		sample?: "fiction" | "nonfiction";
		builtinRoot?: string;
		item?: LabelItem;
		pictograms?: Map<string, string>;
		firstCellOnly?: boolean;
	} = {},
): LabelPreview {
	const template = loadLabelTemplate(templateName, configDir, options.builtinRoot);
	const kind = template.meta.kind;
	const { geometry, variant, files } = templateOnStock(
		config,
		template,
		// the first stock the template lists that still exists (a stock may have been renamed)
		options.stockId ??
			template.meta.stocks.find((id) => config.labels.stocks.some((s) => s.id === id)) ??
			config.labels[kind].stock,
	);
	const unit = renderUnit(
		template,
		files,
		buildLabelContext(
			options.item ?? sampleLabelItem(config, options.sample),
			config,
			configDir,
			template.meta,
			options.pictograms,
		),
		0,
	);
	const zoom = options.zoom ?? 1;
	const { stock } = geometry;
	const shown = options.firstCellOnly ? unit.cells.slice(0, 1) : unit.cells;
	const heightMm = options.firstCellOnly ? stock.labelMm.height : geometry.unitHeightMm;
	const cells = shown
		.map(
			(html, k) =>
				`<div class="cell ${unit.scope}" style="left:0;top:${k * (stock.labelMm.height + stock.gapMm.y)}mm" data-cell="${k + 1}">${html}</div>`,
		)
		.join("");
	return {
		template: template.folder.name,
		kind,
		stock: stock.id,
		variant,
		html: previewDocument({
			title: template.folder.name,
			lang: config.ui.locale,
			zoom,
			frameCss: `.unit { position: relative; width: ${stock.labelMm.width}mm; height: ${heightMm}mm; }
.cell { position: absolute; width: ${stock.labelMm.width}mm; height: ${stock.labelMm.height}mm; box-sizing: border-box; overflow: hidden; outline: 0.2mm dashed #bbb; outline-offset: -0.2mm; }`,
			css: unit.css,
			body: `<div class="unit">${cells}</div>`,
		}),
		widthMm: stock.labelMm.width,
		heightMm,
		zoom,
	};
}

// --- Calibration ------------------------------------------------------------------------------

/**
 * Calibration page of an adhesive stock: every cell outlined at the configured geometry with its
 * index and size, the units of `unitCells` stacked cells outlined in a heavier line, plus a 10 cm
 * ruler, so the operator can check margins on a plain sheet before using the real labels.
 */
export function calibrationSheetHtml(
	config: AppConfig,
	stockId: string,
	labels: { title: string; ruler: string },
	unitCells = 1,
): string {
	const stock = findStock(config, stockId);
	const geometry = stockGeometry(stock, unitCells);
	const cells: string[] = [];
	for (let i = 0; i < geometry.cellsPerPage; i++) {
		const { xMm, yMm } = cellPosition(stock, i);
		cells.push(
			`<div class="cell" style="left:${xMm}mm;top:${yMm}mm"><span>${i + 1}</span><small>${stock.labelMm.width} × ${stock.labelMm.height} mm</small></div>`,
		);
	}
	const units: string[] = [];
	if (unitCells > 1) {
		for (let i = 0; i < geometry.unitsPerPage; i++) {
			const { xMm, yMm } = unitPosition(geometry, i);
			units.push(
				`<div class="unit" style="left:${xMm}mm;top:${yMm}mm"><b>${i + 1}</b></div>`,
			);
		}
	}
	// the ruler and the title sit inside the first row: stocks often use the whole page, and the
	// calibration sheet is printed on plain paper anyway
	const inset = { left: stock.marginMm.left + 2, top: stock.marginMm.top + 1 };
	const css = [
		...pageCss(PAPER_MM.A4),
		`.page { font-family: sans-serif; color: #333; }`,
		`.cell { position: absolute; width: ${stock.labelMm.width}mm; height: ${stock.labelMm.height}mm; box-sizing: border-box; border: 0.2mm dashed #888; border-radius: ${stock.cornerRadiusMm}mm; display: flex; flex-direction: column; align-items: center; justify-content: center; }`,
		`.cell span { font-size: 4mm; font-weight: 700; }`,
		`.cell small { font-size: 2.5mm; }`,
		`.unit { position: absolute; width: ${stock.labelMm.width}mm; height: ${geometry.unitHeightMm}mm; box-sizing: border-box; border: 0.4mm solid #333; pointer-events: none; }`,
		`.unit b { position: absolute; right: 1.5mm; top: 1mm; font-size: 3mm; }`,
		`.ruler { position: absolute; left: ${inset.left}mm; top: ${inset.top}mm; display: flex; align-items: center; gap: 3mm; font-size: 2.6mm; }`,
		`.ruler span { max-width: 80mm; }`,
		`.title { position: absolute; left: ${inset.left}mm; top: ${inset.top + 9}mm; font-size: 2.6mm; }`,
		SCREEN_PAGES_CSS,
	].join("\n");
	return printDocument({
		title: labels.title,
		lang: config.ui.locale,
		styles: [`\n${css}\n`],
		body: `<div class="page" data-stock="${escapeHtml(stock.id)}" data-unit-cells="${unitCells}">
${cells.join("\n")}
${units.join("\n")}
<div class="ruler">${rulerSvg()}<span>${escapeHtml(labels.ruler)}</span></div>
<div class="title">${escapeHtml(labels.title)} — ${escapeHtml(stock.name)}</div>
</div>`,
	});
}

// --- The print dialog --------------------------------------------------------------------------

export interface LabelKindOption {
	kind: LabelKind;
	template: string;
	stock: string;
	/** Cells per unit of the configured template (2 for pairs). */
	cells: number;
	/** Stock id → units per page (stocks whose rows do not divide by the cells are left out). */
	unitsPerPage: Record<string, number>;
}

/** Each kind of label with its configured template and stock, and the units of a page per stock. */
export function labelPrintOptions(config: AppConfig, configDir: string): LabelKindOption[] {
	const templates = listLabelTemplates(configDir);
	return LABEL_KINDS.map((kind): LabelKindOption => {
		const job = config.labels[kind];
		const cells = templates.find((t) => t.name === job.template)?.meta?.unit.cells ?? 1;
		const unitsPerPage: Record<string, number> = {};
		for (const stock of config.labels.stocks) {
			const units = unitsPerPageOf(stock, cells);
			if (units !== null) {
				unitsPerPage[stock.id] = units;
			}
		}
		return { kind, template: job.template, stock: job.stock, cells, unitsPerPage };
	});
}
