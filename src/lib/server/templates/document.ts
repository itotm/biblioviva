// SPDX-License-Identifier: GPL-3.0-or-later
// The HTML document around every printout (PLAN.md §3.12): cards, labels, slips, test and
// calibration sheets are pages of paper placed in millimetres, shown on screen as sheets on a grey
// desk; the template previews are documents of one face for a sandboxed iframe. One wrapper for all
// of them, in the installation's language (`ui.locale`).
import { escapeHtml } from "./engine.js";

export { escapeHtml };

/** Backgrounds and colours printed as they are drawn. */
export const PRINT_COLOURS = "-webkit-print-color-adjust: exact; print-color-adjust: exact;";

/** The bare document: margins off, white paper, colours printed. */
export const BODY_CSS = `html, body { margin: 0; padding: 0; background: #fff; ${PRINT_COLOURS} }`;

/**
 * The rules of a document of fixed pages (`<div class="page">`): the paper without printer
 * margins (everything is placed in mm from its corner), one page per sheet.
 */
export function pageCss(paper: { width: number; height: number }, size = "A4 portrait"): string[] {
	return [
		`@page { size: ${size}; margin: 0; }`,
		BODY_CSS,
		`.page { position: relative; width: ${paper.width}mm; height: ${paper.height}mm; overflow: hidden; page-break-after: always; break-after: page; }`,
		`.page:last-child { page-break-after: auto; break-after: auto; }`,
	];
}

/** On screen, the pages as sheets on a grey desk (never printed). */
export const SCREEN_PAGES_CSS =
	"@media screen { body { background: #eee; padding: 8mm 0; } .page { background: #fff; margin: 0 auto 8mm; box-shadow: 0 2px 8px rgba(0,0,0,.2); } }";

export interface PrintDocument {
	title: string;
	/** The installation's language (`ui.locale`). */
	lang: string;
	/** Each style sheet in its own `<style>`, in order (the sheet's own rules, the templates'). */
	styles: readonly string[];
	body: string;
	/** Attributes of `<body>` (`data-layout`), escaped here. */
	bodyData?: Record<string, string>;
}

/** A complete printable HTML document. */
export function printDocument(doc: PrintDocument): string {
	const data = Object.entries(doc.bodyData ?? {})
		.map(([name, value]) => ` data-${name}="${escapeHtml(value)}"`)
		.join("");
	return `<!doctype html>
<html lang="${escapeHtml(doc.lang)}"><head><meta charset="utf-8"><title>${escapeHtml(doc.title)}</title>
${doc.styles.map((s) => `<style>${s}</style>`).join("\n")}
</head><body${data}>${doc.body}</body></html>`;
}

/**
 * A document of one face or label unit for `<iframe sandbox srcdoc>` (the template pages and the
 * designer): no page, no scroll bars, drawn at `zoom` (1 = real size on a 96 dpi screen).
 */
export function previewDocument(doc: {
	title: string;
	lang: string;
	zoom: number;
	/** The rules of the frame around the face (its size). */
	frameCss: string;
	/** The template's scoped style sheet. */
	css: string;
	body: string;
}): string {
	return printDocument({
		title: doc.title,
		lang: doc.lang,
		styles: [
			`html, body { margin: 0; padding: 0; background: #fff; overflow: hidden; }\nbody { zoom: ${doc.zoom}; }\n${doc.frameCss}`,
			doc.css,
		],
		body: doc.body,
	});
}

/** SVG ruler of `lengthMm` with a tick every millimetre, numbered every centimetre. */
export function rulerSvg(lengthMm = 100, heightMm = 8): string {
	const ticks: string[] = [];
	for (let mm = 0; mm <= lengthMm; mm++) {
		const h = mm % 10 === 0 ? 5 : mm % 5 === 0 ? 3.5 : 2;
		ticks.push(
			`<line x1="${mm}" y1="0" x2="${mm}" y2="${h}" stroke="#000" stroke-width="0.15"/>`,
		);
		if (mm % 10 === 0) {
			ticks.push(
				`<text x="${mm}" y="7.2" font-size="2.2" font-family="sans-serif" text-anchor="middle">${mm / 10}</text>`,
			);
		}
	}
	// 2 mm of margin on each side so the numbers at both ends are not clipped; the ticks stay exact
	return `<svg xmlns="http://www.w3.org/2000/svg" width="${lengthMm + 4}mm" height="${heightMm}mm" viewBox="-2 0 ${lengthMm + 4} ${heightMm}"><line x1="0" y1="0" x2="${lengthMm}" y2="0" stroke="#000" stroke-width="0.2"/>${ticks.join("")}</svg>`;
}
