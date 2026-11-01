// SPDX-License-Identifier: GPL-3.0-or-later
// What the card template pages print besides real cards (PLAN.md steps 2.5b and 9.27): real-size
// previews of one card (front and back as documents for sandboxed iframes), a sheet of the sample
// patron, the test sheet with marks and a ruler, and the calibration of printing on both sides.
// Pure functions over the database, the configuration and the template folders.
import { NotFoundError } from "#lib/server/errors.js";
import { and, eq, ne } from "drizzle-orm";
import type { AppConfig } from "#lib/server/config/schema.js";
import type { ServerContext } from "#lib/server/context.js";
import type { Db } from "#lib/server/db/client.js";
import { patron } from "#lib/server/db/schema.js";
import {
	escapeHtml,
	pageCss,
	previewDocument,
	printDocument,
	rulerSvg,
	SCREEN_PAGES_CSS,
} from "#lib/server/templates/document.js";
import {
	CALIBRATION_CARD,
	CALIBRATION_RANGE,
	calibrationEdges,
	calibrationFront,
	type CardLayout,
} from "#lib/shared/card-layout.js";
import { PAPER_MM } from "#lib/shared/paper.js";
import {
	checkedCardGeometry,
	sheetCss,
	sheetHtml,
	sheetMarks,
	sheetPages,
	type CardGeometry,
} from "./card-sheets.js";
import {
	buildCardContext,
	loadCardTemplate,
	renderCard,
	type CardPatron,
	type RenderedCard,
} from "./card-templates.js";
import { cardPhoto, patronCardRows } from "./cards.js";
import type { WordSource } from "#lib/server/i18n/print-words.js";

/** A made-up patron for previews: nothing here belongs to a real person. */
export function samplePatron(patronType: "student" | "teacher" = "student"): CardPatron {
	return {
		id: 0,
		firstName: patronType === "student" ? "Maria" : "Giovanni",
		lastName: patronType === "student" ? "Esempio" : "Modello",
		cardNumber: "1000000009",
		patronType,
		classLabel: patronType === "student" ? "2 B" : "Docenti",
		levelLabel: patronType === "student" ? "2" : "",
		levelName: patronType === "student" ? "Seconda" : "",
		groupName: patronType === "student" ? "B" : "Docenti",
		photoPath: null,
		status: "active",
	};
}

export class PreviewPatronNotFoundError extends NotFoundError {
	constructor(readonly id: number) {
		super("patron", `patron ${id} not found`);
		this.name = "PreviewPatronNotFoundError";
	}
}

/** The patron to preview: a real one by id (anonymized ones excluded) or the sample. */
export function previewPatron(
	db: Db,
	dataDir: string,
	patronId: number | null,
	patronType: "student" | "teacher" = "student",
): { patron: CardPatron; photo: string | null } {
	if (patronId === null || patronId === 0) {
		return { patron: samplePatron(patronType), photo: null };
	}
	const [row] = patronCardRows(db, and(eq(patron.id, patronId), ne(patron.status, "anonymized")));
	if (!row) {
		throw new PreviewPatronNotFoundError(patronId);
	}
	return { patron: row, photo: cardPhoto(db, dataDir, row.id) };
}

export interface CardPreview {
	template: string;
	/** Complete HTML documents of each face, for `<iframe sandbox srcdoc>`. */
	front: string;
	back: string;
	widthMm: number;
	heightMm: number;
	zoom: number;
}

function faceDocument(
	face: string,
	card: RenderedCard,
	geometry: CardGeometry,
	zoom: number,
	lang: string,
): string {
	return previewDocument({
		title: card.template,
		lang,
		zoom,
		frameCss: `.face { width: ${geometry.cardW}mm; height: ${geometry.cardH}mm; overflow: hidden; box-sizing: border-box; position: relative; }`,
		css: card.css,
		body: `<div class="${card.scope}">${face}</div>`,
	});
}

/**
 * Renders one card of `templateName` for the given patron (or the sample) as two standalone
 * documents at the given zoom (1 = real size on a 96 dpi screen, 2 = double).
 */
export function renderCardPreview(
	{ db, config, configDir, dataDir }: ServerContext,
	templateName: string,
	options: {
		patronId?: number | null;
		zoom?: number;
		builtinRoot?: string;
		now?: Date;
		words?: WordSource;
	} = {},
): CardPreview {
	const template = loadCardTemplate(templateName, configDir, options.builtinRoot);
	const wanted = template.meta.patronTypes.includes("student") ? "student" : "teacher";
	const { patron: p, photo } = previewPatron(db, dataDir, options.patronId ?? null, wanted);
	const card = renderCard(
		template,
		buildCardContext(
			p,
			config,
			template.meta,
			config.cards.showPhoto ? photo : null,
			options.now,
			options.words,
		),
		p.id,
	);
	const geometry = checkedCardGeometry(config, template);
	const zoom = options.zoom ?? 1;
	return {
		template: template.folder.name,
		front: faceDocument(card.front, card, geometry, zoom, config.ui.locale),
		back: faceDocument(card.back, card, geometry, zoom, config.ui.locale),
		widthMm: geometry.cardW,
		heightMm: geometry.cardH,
		zoom,
	};
}

/** A whole sheet of the sample patron (one sheet of the layout): the sheet preview. */
export function sampleSheetHtml(
	config: AppConfig,
	configDir: string,
	templateName: string,
	title: string,
	options: { builtinRoot?: string; now?: Date; layout?: CardLayout; words?: WordSource } = {},
): string {
	const template = loadCardTemplate(templateName, configDir, options.builtinRoot);
	const geometry = checkedCardGeometry(config, template, options.layout);
	const wanted = template.meta.patronTypes.includes("student") ? "student" : "teacher";
	const context = buildCardContext(
		samplePatron(wanted),
		config,
		template.meta,
		null,
		options.now,
		options.words,
	);
	const cards = Array.from({ length: geometry.perPage }, () => renderCard(template, context, 0));
	return sheetHtml(title, [{ cards, meta: template.meta, geometry }], config);
}

/**
 * The test sheet of a card template: one page of empty units at the places of the real sheet,
 * drawn by the same sheet code as the cards (cut lines, fold and crop marks as configured), with
 * the face labels and sizes printed inside and a 10 cm ruler at the bottom of the page so the
 * operator can check the printer scale (PLAN.md step 2.5: 171.2 × 54 mm per unit, fold at 85.6 mm).
 */
export function testSheetHtml(
	config: AppConfig,
	configDir: string,
	templateName: string,
	labels: { front: string; back: string; ruler: string; title: string },
	builtinRoot?: string,
): string {
	const template = loadCardTemplate(templateName, configDir, builtinRoot);
	const geometry = checkedCardGeometry(config, template, "side-by-side");
	const face = (label: string, unit = ""): string =>
		`<div class="face"${unit}><div class="mark">${escapeHtml(label)}</div><div class="size">${geometry.cardW} × ${geometry.cardH} mm</div><div class="cross"></div></div>`;
	const units = Array.from({ length: geometry.perPage }, (_, i): RenderedCard => ({
		patronId: 0,
		front: face(labels.front, ` data-unit="${i + 1}"`),
		back: face(labels.back),
		css: "",
		scope: "bv-test",
		template: template.folder.name,
	}));
	const [page = ""] = sheetPages(units, geometry, sheetMarks(config));
	const bottom = PAPER_MM.A4.height - geometry.marginMm - 16;
	const css = [
		sheetCss(config, geometry),
		`.face { display: flex; flex-direction: column; align-items: center; justify-content: center; font-family: sans-serif; color: #333; border: 0.15mm dashed #999; }`,
		`.face .mark { font-size: 5mm; font-weight: 700; }`,
		`.face .size { font-size: 3mm; }`,
		`.face .cross { position: absolute; inset: 0; background: linear-gradient(#bbb, #bbb) center/100% 0.15mm no-repeat, linear-gradient(#bbb, #bbb) center/0.15mm 100% no-repeat; pointer-events: none; }`,
		`.info, .ruler { position: absolute; left: ${(PAPER_MM.A4.width - geometry.unitW) / 2}mm; width: ${geometry.unitW}mm; font: 3mm sans-serif; color: #333; }`,
		`.info { top: ${bottom}mm; }`,
		`.ruler { top: ${bottom + 5}mm; display: flex; align-items: center; gap: 4mm; }`,
	].join("\n");
	return printDocument({
		title: labels.title,
		lang: config.ui.locale,
		styles: [css],
		body: `<div class="page">
${page}
<div class="info">${escapeHtml(labels.title)} — ${escapeHtml(template.folder.name)} — ${geometry.unitW} × ${geometry.cardH} mm, ${geometry.rows} × A4</div>
<div class="ruler">${rulerSvg()}<span>${escapeHtml(labels.ruler)}</span></div>
</div>`,
	});
}

/**
 * A calibration ruler (9.27): `−range … +range` mm about its 0, a tick every millimetre, longer and
 * numbered every five, the 0 bold; `vertical` turns it to run downwards. Its 0 is at (0, 0) of the
 * SVG's own coordinates, placed by the caller.
 */
function calibrationRuler(range: number, vertical: boolean): string {
	const parts: string[] = [];
	for (let k = -range; k <= range; k++) {
		const h = k === 0 ? 7 : k % 5 === 0 ? 5 : 3;
		parts.push(
			`<line x1="${k}" y1="${-h / 2}" x2="${k}" y2="${h / 2}" stroke="#000" stroke-width="${k === 0 ? 0.3 : 0.15}"/>`,
		);
		if (k % 5 === 0) {
			const label = k > 0 ? `+${k}` : k < 0 ? `−${-k}` : "0";
			parts.push(
				`<text x="${k}" y="${-h / 2 - 0.8}" font-size="2.6" font-family="sans-serif" font-weight="${k === 0 ? 700 : 400}" text-anchor="middle">${label}</text>`,
			);
		}
	}
	parts.unshift(
		`<line x1="${-range}" y1="0" x2="${range}" y2="0" stroke="#000" stroke-width="0.2"/>`,
	);
	const size = 2 * range + 6;
	const box = vertical
		? `width="14mm" height="${size}mm" viewBox="-7 ${-range - 3} 14 ${size}"`
		: `width="${size}mm" height="14mm" viewBox="${-range - 3} -7 ${size} 14"`;
	return `<svg xmlns="http://www.w3.org/2000/svg" ${box}><g${vertical ? ` transform="rotate(90)"` : ""}>${parts.join("")}</g></svg>`;
}

/**
 * The calibration of printing on both sides (9.27, Q127): page 1, a 150 × 100 mm card with its
 * outline to cut along and a large "1"; page 2, a large "2" behind it and two rulers in mm across
 * the places where the cut edges should fall (the front's left edge on the horizontal ruler, its
 * top edge on the vertical one), at the mirrored places of the configured flip and moved by the
 * offset in use, so the values read are added to it.
 */
export function duplexCalibrationHtml(
	config: AppConfig,
	labels: { title: string; cut: string; read: string },
): string {
	const settings = {
		flip: config.cards.duplex.flip,
		backOffsetMm: config.cards.duplex.backOffsetMm,
	};
	const front = calibrationFront();
	const { leftX, topY, back } = calibrationEdges(settings);
	const w = CALIBRATION_CARD.width;
	const h = CALIBRATION_CARD.height;
	const r = CALIBRATION_RANGE;
	const css = [
		...pageCss(PAPER_MM.A4),
		`body { font-family: sans-serif; color: #111; }`,
		`.card { position: absolute; width: ${w}mm; height: ${h}mm; box-sizing: border-box; display: flex; flex-direction: column; align-items: center; justify-content: center; text-align: center; }`,
		`.card.front { border: 0.3mm solid #000; }`,
		`.big { font-size: 40mm; font-weight: 700; line-height: 1; opacity: .25; }`,
		`.note { font-size: 3.5mm; max-width: ${w - 20}mm; }`,
		`.head { position: absolute; left: 15mm; right: 15mm; top: 12mm; font-size: 4mm; }`,
		`.ruler { position: absolute; }`,
		SCREEN_PAGES_CSS,
	].join("\n");
	const ruler = (x: number, y: number, vertical: boolean): string =>
		`<div class="ruler" data-ruler="${vertical ? "top" : "left"}" style="left: ${vertical ? x - 7 : x - r - 3}mm; top: ${vertical ? y - r - 3 : y - 7}mm;">${calibrationRuler(r, vertical)}</div>`;
	return printDocument({
		title: labels.title,
		lang: config.ui.locale,
		styles: [css],
		bodyData: { flip: settings.flip },
		body: `
<div class="page" data-side="1"><div class="head">${escapeHtml(labels.title)}</div>
<div class="card front" style="left: ${front.x}mm; top: ${front.y}mm;"><div class="big">1</div><div class="note">${escapeHtml(labels.cut)}</div></div>
</div>
<div class="page" data-side="2"><div class="head">${escapeHtml(labels.title)}</div>
<div class="card back" style="left: ${back.x}mm; top: ${back.y}mm;"><div class="big">2</div><div class="note">${escapeHtml(labels.read)}</div></div>
${ruler(leftX, back.y + h / 2, false)}
${ruler(back.x + w / 2, topY, true)}
</div>
`,
	});
}
