// SPDX-License-Identifier: GPL-3.0-or-later
// The sheets of cards (PLAN.md §3.12, steps 2.5, 9.27 and 11.17): the geometry of a template's
// cards on the paper (front and back side by side, folded on the short edge, or on the two sides of
// the sheet), the sheet's own rules (places, cut lines, bleed), the crop and fold marks and the
// printed document of one or more templates' cards. Pure functions over the configuration.
import type { AppConfig } from "#lib/server/config/schema.js";
import { pageCss, printDocument, SCREEN_PAGES_CSS } from "#lib/server/templates/document.js";
import { shareDataUrls, TemplateError } from "#lib/server/templates/engine.js";
import {
	backOf,
	cardFitProblem,
	cardSheetFit,
	cropMarks,
	duplexFronts,
	duplexGrid,
	sideBySidePlaces,
	type CardLayout,
	type CardSheetFit,
	type CardSheetSettings,
	type Place,
	type Rect,
} from "#lib/shared/card-layout.js";
import { PAPER_MM } from "#lib/shared/paper.js";
import { attr, buildStartTag, splitNodes, withAttr } from "#lib/shared/template-html.js";
import type { CardTemplateMeta, LoadedCardTemplate, RenderedCard } from "./card-templates.js";

export interface CardGeometry {
	layout: CardLayout;
	cardW: number;
	cardH: number;
	unitW: number;
	/** Side by side: the units one under the other on a sheet. */
	rows: number;
	marginMm: number;
	gapMm: number;
	/** Side by side: height used by the rows, gaps and margins on an A4 page. */
	usedHeightMm: number;
	/** Cards on a sheet: the rows side by side, the grid of a sheet printed on both sides. */
	perPage: number;
	/** Printed on both sides: how far a face's background runs past its edge. */
	bleedMm: number;
	settings: CardSheetSettings;
	/** The card size against the sheet (`cardSheetFit`). */
	fit: CardSheetFit;
}

export function cardGeometry(
	config: AppConfig,
	meta?: CardTemplateMeta,
	layout: CardLayout = config.cards.layout,
): CardGeometry {
	const cardW = meta?.cardMm?.width ?? config.cards.cardMm.width;
	const cardH = meta?.cardMm?.height ?? config.cards.cardMm.height;
	const { marginMm, gapMm } = config.cards.sheet;
	// a template of another size (a portrait card, step 11.17) takes the rows that fit the page
	const fit = cardSheetFit({ width: cardW, height: cardH }, config.cards.sheet);
	const rows = Math.max(1, fit.rows);
	const usedHeightMm = rows * cardH + (rows - 1) * gapMm + 2 * marginMm;
	const settings: CardSheetSettings = {
		cardW,
		cardH,
		rows,
		marginMm,
		gapMm,
		flip: config.cards.duplex.flip,
		backOffsetMm: {
			x: config.cards.duplex.backOffsetMm.x,
			y: config.cards.duplex.backOffsetMm.y,
		},
	};
	const grid = duplexGrid(settings);
	return {
		layout,
		cardW,
		cardH,
		unitW: cardW * 2,
		rows,
		marginMm,
		gapMm,
		usedHeightMm,
		perPage: layout === "duplex" ? grid.columns * grid.rows : rows,
		bleedMm: layout === "duplex" ? meta?.bleedMm || config.cards.bleedMm : 0,
		settings,
		fit,
	};
}

/** A card template whose size does not fit the sheet (`cardSheetFit`). */
export class CardSizeError extends TemplateError {
	constructor(
		template: string,
		readonly size: { width: number; height: number },
		readonly fit: CardSheetFit,
	) {
		super(template, [cardFitProblem(size, fit)]);
		this.name = "CardSizeError";
	}
}

/** The geometry of a template's cards, refusing a size that does not fit the sheet. */
export function checkedCardGeometry(
	config: AppConfig,
	template: LoadedCardTemplate,
	layout?: CardLayout,
): CardGeometry {
	const geometry = cardGeometry(config, template.meta, layout);
	if (!geometry.fit.fits) {
		throw new CardSizeError(
			template.folder.name,
			{ width: geometry.cardW, height: geometry.cardH },
			geometry.fit,
		);
	}
	return geometry;
}

/**
 * What the print dialog tells the operator to cut along: the crop marks, else the coloured
 * outline of the cards, else the edge of the card.
 */
export function cutGuide(config: AppConfig): "marks" | "line" | "edge" {
	const { cutMarks, cutLines } = config.cards.sheet;
	return cutMarks ? "marks" : cutLines ? "line" : "edge";
}

const mm = (v: number): string => `${Math.round(v * 100) / 100}mm`;

/**
 * CSS of the sheet wrapper (outside the templates): A4 pages with no printer margin (every card is
 * placed in mm from the corner of the paper, 9.27), side-by-side units or the slots of a sheet
 * printed on both sides, cut lines (on the fronts), the bleed of a face; the crop and fold marks
 * are drawn by `sheetPages`. With `scope` (a job of several templates) the sizes apply to that
 * template's cards only.
 */
export function sheetCss(config: AppConfig, geometry: CardGeometry, scope?: string): string {
	const s = scope ? `.${scope}` : "";
	const cut = config.cards.sheet.cutLines;
	const outline = cut
		? `outline: ${cut.widthMm}mm solid ${cut.color}; outline-offset: -${cut.widthMm}mm;`
		: "";
	const b = geometry.bleedMm;
	return [
		...pageCss(PAPER_MM.A4),
		`.unit${s} { position: absolute; display: flex; width: ${mm(geometry.unitW)}; height: ${mm(geometry.cardH)}; box-sizing: content-box; ${outline} }`,
		`.slot${s} { position: absolute; width: ${mm(geometry.cardW)}; height: ${mm(geometry.cardH)}; }`,
		`.slot${s}.front { ${outline} }`,
		`.slot${s} > .face:not(.bv-bleed) { position: relative; z-index: 1; }`,
		b > 0
			? // the bleed is the copy's padding: its background is sized and centred in a content box
				// of the face's size (as on the face) and painted under the padding too
				`.slot${s} > .bv-bleed { position: absolute !important; left: -${b}mm !important; top: -${b}mm !important; width: calc(100% + ${2 * b}mm) !important; height: calc(100% + ${2 * b}mm) !important; margin: 0 !important; padding: ${b}mm !important; box-sizing: border-box !important; background-origin: content-box !important; background-clip: border-box !important; z-index: 0; }`
			: "",
		`${scope ? `.${scope} ` : ""}.face { width: ${mm(geometry.cardW)}; height: ${mm(geometry.cardH)}; overflow: hidden; box-sizing: border-box; position: relative; flex: 0 0 auto; }`,
		`.bv-marks { position: absolute; left: 0; top: 0; z-index: 2; pointer-events: none; }`,
		SCREEN_PAGES_CSS,
	]
		.filter(Boolean)
		.join("\n");
}

/** The empty copy of a face's root element that carries its background past the edge (bleed). */
function bleedOf(face: string): string {
	const root = splitNodes(face).find((n) => n.kind === "element" || n.text.trim() !== "");
	if (root?.kind !== "element" || root.tag !== "div") {
		return "";
	}
	const classes = attr(root, "class");
	const attrs = withAttr(
		withAttr(root.attrs, "class", classes === null ? "face bv-bleed" : `${classes} bv-bleed`),
		"aria-hidden",
		"true",
	);
	return `${buildStartTag("div", attrs)}</div>`;
}

const at = (p: Place): string => `left: ${mm(p.x)}; top: ${mm(p.y)};`;

/** Whether a sheet gets its crop marks and the fold marks of its side-by-side units. */
export interface SheetMarks {
	cut: boolean;
	fold: boolean;
}

/** The marks of every sheet of cards (`cards.sheet`), whatever the template. */
export function sheetMarks(config: AppConfig): SheetMarks {
	return { cut: config.cards.sheet.cutMarks, fold: config.cards.sheet.foldMarks };
}

/** The crop marks of a page (step 11.17) as an SVG over the whole paper, in mm. */
function marksSvg(rects: Rect[], folds: number[]): string {
	const lines = cropMarks(rects, folds)
		.map(
			(l) =>
				`<line x1="${l.x1}" y1="${l.y1}" x2="${l.x2}" y2="${l.y2}"${l.fold ? ' stroke-dasharray="1 0.7"' : ""} />`,
		)
		.join("");
	return `<svg class="bv-marks" xmlns="http://www.w3.org/2000/svg" width="${PAPER_MM.A4.width}mm" height="${PAPER_MM.A4.height}mm" viewBox="0 0 ${PAPER_MM.A4.width} ${PAPER_MM.A4.height}" stroke="#000" stroke-width="0.15" aria-hidden="true">${lines}</svg>`;
}

/** The pages of a print job: side by side, or fronts and backs on the two sides of each sheet. */
export function sheetPages(
	cards: RenderedCard[],
	geometry: CardGeometry,
	marks: SheetMarks = { cut: false, fold: false },
): string[] {
	const pages: string[] = [];
	for (let i = 0; i < cards.length; i += geometry.perPage) {
		const batch = cards.slice(i, i + geometry.perPage);
		if (geometry.layout === "duplex") {
			const fronts = duplexFronts(geometry.settings);
			const slot = (c: RenderedCard, k: number, side: "front" | "back"): string => {
				const front = fronts[k] ?? { x: 0, y: 0 };
				const place = side === "front" ? front : backOf(front, geometry.settings);
				const face = side === "front" ? c.front : c.back;
				return `<div class="slot ${side} ${c.scope}" data-patron="${c.patronId}" style="${at(place)}">${geometry.bleedMm > 0 ? bleedOf(face) : ""}${face}</div>`;
			};
			// the cards are cut from the side of the fronts: the marks are drawn there
			const cut = marks.cut
				? marksSvg(
						batch.map((_, k) => ({
							...(fronts[k] ?? { x: 0, y: 0 }),
							w: geometry.cardW,
							h: geometry.cardH,
						})),
						[],
					)
				: "";
			pages.push(batch.map((c, k) => slot(c, k, "front")).join("\n") + cut);
			pages.push(batch.map((c, k) => slot(c, k, "back")).join("\n"));
		} else {
			const places = sideBySidePlaces(geometry.settings).slice(0, batch.length);
			const units = places.map((p) => ({ ...p, w: geometry.unitW, h: geometry.cardH }));
			const svg =
				marks.cut || marks.fold
					? marksSvg(
							marks.cut ? units : [],
							marks.fold ? places.map((p) => p.x + geometry.cardW) : [],
						)
					: "";
			pages.push(
				batch
					.map(
						(c, k) =>
							`<div class="unit ${c.scope}" data-patron="${c.patronId}" style="${at(places[k] ?? { x: 0, y: 0 })}">${c.front}${c.back}</div>`,
					)
					.join("\n") + svg,
			);
		}
	}
	return pages;
}

/** The cards of one template in a print job, on sheets of that template's geometry. */
export interface CardSheetGroup {
	cards: RenderedCard[];
	meta: CardTemplateMeta | undefined;
	geometry: CardGeometry;
}

/**
 * A complete HTML document with the given cards, ready to print: each group (the cards of one
 * template) on pages of its own geometry with its own marks, one group after the other.
 */
export function sheetHtml(title: string, groups: CardSheetGroup[], config: AppConfig): string {
	const css = new Map<string, string>();
	for (const c of groups.flatMap((g) => g.cards)) {
		css.set(c.scope, c.css);
	}
	// each picture of the faces once in the document (step 9.29)
	const shared = shareDataUrls(
		groups
			.flatMap((g) => sheetPages(g.cards, g.geometry, sheetMarks(config)))
			.map((p, i) => `<div class="page" data-page="${i + 1}">${p}</div>`)
			.join("\n"),
	);
	const pages = shared.body;
	// one template: its sizes apply to every card; several: each to its own template's cards
	const scoped = groups.length > 1;
	const sheet = [
		...new Set(
			groups.flatMap((g) =>
				sheetCss(config, g.geometry, scoped ? g.cards[0]?.scope : undefined).split("\n"),
			),
		),
	].join("\n");
	return printDocument({
		title,
		lang: config.ui.locale,
		styles: [sheet, [...css.values()].join("\n"), shared.css],
		body: pages,
		bodyData: { layout: groups[0]?.geometry.layout ?? config.cards.layout },
	});
}
