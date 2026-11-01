// SPDX-License-Identifier: GPL-3.0-or-later
// The template editor (PLAN.md steps 11.10, 11.16): the text files of a template folder of
// CONFIG_DIR with the faces the visual designer draws — card faces, or the cells of a label unit
// for each layout variant, with the stock that previews it —; a draft previewed by rendering it
// from a temporary copy of the folder exactly as printing does (sample patron, sample copy, sample
// overdue groups); a draft saved only when it loads and renders, as one configuration change. The
// files are the only source of the drawing too: there is no layout file beside them.
import { ServiceError } from "#lib/server/errors.js";
import { randomUUID } from "node:crypto";
import {
	cpSync,
	existsSync,
	mkdirSync,
	readdirSync,
	readFileSync,
	rmSync,
	statSync,
	symlinkSync,
	writeFileSync,
} from "node:fs";
import { dirname, join, relative, sep } from "node:path";
import type { AppConfig } from "#lib/server/config/schema.js";
import type { ServerContext } from "#lib/server/context.js";
import { findTemplate, TemplateError, type TemplateKind } from "#lib/server/templates/engine.js";
import type { CardSheetSpacing } from "#lib/shared/card-layout.js";
import type { AuditActor } from "./audit.js";
import { cardGeometry, CardSizeError } from "./card-sheets.js";
import { loadCardTemplate } from "./card-templates.js";
import type { ConfigChange, FileWrite } from "./config-edit.js";
import { saveConfigWrites } from "./config-sections.js";
import { loadLabelTemplate, unitFiles, variantFor } from "./label-templates.js";
import { LabelGeometryError, renderLabelPreview, StockNotFoundError } from "./labels.js";
import { renderCardPreview } from "./card-preview.js";
import { renderSlipSample } from "./slips.js";
import type { WordSource } from "#lib/server/i18n/print-words.js";

const TEXT_FILE = /^[\w-]+\.(html|css)$|^template\.json$/;
/** A layout file beside the faces is not read: the next save removes it. */
const LEGACY_DESIGN_FILE = "design.json";
export const MAX_TEXT_FILE = 256 * 1024;

/** A card size that does not fit the sheet, with the largest that does (`cardSheetFit`). */
export interface CardSizeIssue {
	width: number;
	height: number;
	maxWidth: number;
	maxHeight: number;
}

export class TemplateEditorError extends ServiceError {
	constructor(
		override readonly code: "notFound" | "builtin" | "badFile" | "invalid",
		readonly details: string[] = [],
		readonly cardSize?: CardSizeIssue,
	) {
		super(
			code,
			`template editor: ${code}${details.length > 0 ? ` (${details.join("; ")})` : ""}`,
		);
		this.name = "TemplateEditorError";
	}
}

export interface FaceGeometry {
	file: string;
	widthMm: number;
	heightMm: number;
	/** Where the face starts in its preview document (the cells of a unit are stacked). */
	offsetMm: number;
	/** The preview document of the face: `front`/`back` for cards, the stock id for labels (null: none fits). */
	doc: string | null;
	/** The cell of the face in its document (labels, 0-based). */
	cell: number;
	/** The label variant the face belongs to (null: the template has one layout). */
	variant: string | null;
}

export interface EditorSource {
	kind: TemplateKind;
	name: string;
	files: Record<string, string>;
	assets: string[];
	/** Cards and labels: the faces the designer draws (none for slips). */
	faces: FaceGeometry[];
	/** Cards: the size a card takes when its `template.json` names none (`cards.cardMm`). */
	cardDefault: { width: number; height: number } | null;
	/** Cards: the sheet a card size must fit (`cardSheetFit`). */
	cardSheet: CardSheetSpacing | null;
}

const toSlash = (p: string): string => p.split(sep).join("/");

function configFolder(kind: TemplateKind, name: string, configDir: string): string {
	const folder = findTemplate(kind, name, configDir);
	if (!folder) {
		throw new TemplateEditorError("notFound", [name]);
	}
	if (folder.source !== "config") {
		throw new TemplateEditorError("builtin", [name]);
	}
	return folder.dir;
}

function textFiles(dir: string): Record<string, string> {
	return Object.fromEntries(
		readdirSync(dir)
			.filter((f) => TEXT_FILE.test(f) && statSync(join(dir, f)).isFile())
			.sort()
			.map((f) => [f, readFileSync(join(dir, f), "utf8")]),
	);
}

/** The faces of a card (front and back) or of every layout of a label unit, with their stocks. */
function faceGeometry(
	config: AppConfig,
	kind: TemplateKind,
	name: string,
	configDir: string,
): FaceGeometry[] {
	if (kind === "cards") {
		const g = cardGeometry(config, loadCardTemplate(name, configDir).meta);
		return ["front", "back"].map((doc) => ({
			file: `${doc}.html`,
			widthMm: g.cardW,
			heightMm: g.cardH,
			offsetMm: 0,
			doc,
			cell: 0,
			variant: null,
		}));
	}
	if (kind !== "labels") {
		return [];
	}
	const { meta } = loadLabelTemplate(name, configDir);
	const ids = [...meta.stocks, ...config.labels.stocks.map((s) => s.id)];
	const stocks = ids
		.map((id) => config.labels.stocks.find((s) => s.id === id))
		.filter((s) => s !== undefined);
	// the unit's files first, then each variant with files of its own
	const layouts: { variant: string | null; files: string[] }[] = [];
	const unit = unitFiles(meta);
	const variants = Object.entries(meta.variants);
	layouts.push({ variant: variants.find(([, r]) => !r.files)?.[0] ?? null, files: unit });
	for (const [variant, rule] of variants) {
		if (rule.files && !layouts.some((l) => l.files.join() === rule.files?.join())) {
			layouts.push({ variant, files: rule.files });
		}
	}
	const fallback = stocks.find((s) => s.id === config.labels[meta.kind].stock) ?? stocks[0];
	return layouts.flatMap((l) => {
		const stock = stocks.find(
			(s) => variantFor(meta, s.labelMm.height).files.join() === l.files.join(),
		);
		const size = stock ?? fallback;
		if (!size) {
			return [];
		}
		return l.files.map((file, cell) => ({
			file,
			widthMm: size.labelMm.width,
			heightMm: size.labelMm.height,
			offsetMm: cell * (size.labelMm.height + size.gapMm.y),
			doc: stock?.id ?? null,
			cell,
			variant: variants.length > 0 ? l.variant : null,
		}));
	});
}

export function editorSource(
	config: AppConfig,
	configDir: string,
	kind: TemplateKind,
	name: string,
): EditorSource {
	const dir = configFolder(kind, name, configDir);
	let faces: FaceGeometry[] = [];
	try {
		faces = faceGeometry(config, kind, name, configDir);
	} catch {
		// a folder that does not load is still opened in the code editor
	}
	const assetsDir = join(dir, "assets");
	return {
		kind,
		name,
		files: textFiles(dir),
		assets: existsSync(assetsDir) ? readdirSync(assetsDir).sort() : [],
		faces,
		cardDefault: kind === "cards" ? { ...config.cards.cardMm } : null,
		cardSheet:
			kind === "cards"
				? {
						rows: config.cards.sheet.rows,
						marginMm: config.cards.sheet.marginMm,
						gapMm: config.cards.sheet.gapMm,
					}
				: null,
	};
}

// --- Drafts -----------------------------------------------------------------------------------

/** The text files of a draft, checked. */
function draftFiles(files: Readonly<Record<string, string>>): Record<string, string> {
	for (const [f, content] of Object.entries(files)) {
		if (!TEXT_FILE.test(f) || content.length > MAX_TEXT_FILE) {
			throw new TemplateEditorError("badFile", [f]);
		}
	}
	return { ...files };
}

export type DraftPreview =
	| { kind: "cards"; front: string; back: string; widthMm: number; heightMm: number }
	| {
			kind: "labels";
			/** One document per layout: the template on each stock of `faceGeometry`. */
			docs: {
				stock: string;
				variant: string | null;
				html: string;
				widthMm: number;
				heightMm: number;
			}[];
	  }
	| { kind: "slips"; html: string };

export interface PreviewOptions {
	zoom?: number;
	today: string;
	teacherLabel: string;
	/** The words of the installation's language for the shipped templates (9.41). */
	words?: WordSource;
}

/** A draft of a template folder: its text files, written by the code editor or the designer. */
export interface TemplateDraft {
	kind: TemplateKind;
	name: string;
	files: Readonly<Record<string, string>>;
}

/** Renders the draft from a temporary copy of the folder; throws what printing would throw. */
function renderDraft(
	{ db, config, configDir, dataDir }: ServerContext,
	{ kind, name, files }: TemplateDraft,
	options: PreviewOptions,
): DraftPreview {
	const source = configFolder(kind, name, configDir);
	const root = join(dataDir, "tmp", "template-draft", randomUUID());
	const dir = join(root, kind, "templates", name);
	try {
		mkdirSync(dirname(dir), { recursive: true });
		cpSync(source, dir, { recursive: true });
		for (const [f, content] of Object.entries(files)) {
			writeFileSync(join(dir, f), content);
		}
		const images = join(configDir, "classification");
		if (existsSync(images)) {
			symlinkSync(images, join(root, "classification"));
		}
		const zoom = options.zoom ?? 1;
		if (kind === "cards") {
			const p = renderCardPreview({ db, config, configDir: root, dataDir }, name, {
				zoom,
				words: options.words,
			});
			return { kind, front: p.front, back: p.back, widthMm: p.widthMm, heightMm: p.heightMm };
		}
		if (kind === "labels") {
			const stocks = [
				...new Set(
					faceGeometry(config, kind, name, root).flatMap((f) => (f.doc ? [f.doc] : [])),
				),
			];
			const docs = (stocks.length > 0 ? stocks : [undefined]).map((stockId) => {
				const p = renderLabelPreview(config, root, name, { zoom, stockId });
				return {
					stock: p.stock,
					variant: p.variant,
					html: p.html,
					widthMm: p.widthMm,
					heightMm: p.heightMm,
				};
			});
			return { kind, docs };
		}
		const job = renderSlipSample(config, root, name, {
			today: options.today,
			teacherLabel: options.teacherLabel,
			words: options.words,
		});
		return { kind, html: job.html };
	} finally {
		rmSync(root, { recursive: true, force: true });
	}
}

function problemsOf(e: unknown): string[] | null {
	if (e instanceof TemplateError) {
		return e.problems;
	}
	if (e instanceof LabelGeometryError || e instanceof StockNotFoundError) {
		return [e.message];
	}
	return null;
}

/** The preview of a draft, or the problems that keep it from printing. */
export function previewDraft(
	ctx: ServerContext,
	draft: TemplateDraft,
	options: PreviewOptions,
):
	| { ok: true; preview: DraftPreview; files: Record<string, string> }
	/** `cardSize`: the card does not fit the sheet, the only problem then (translated by the caller). */
	| { ok: false; problems: string[]; cardSize?: CardSizeIssue } {
	try {
		const all = draftFiles(draft.files);
		return {
			ok: true,
			preview: renderDraft(ctx, { ...draft, files: all }, options),
			files: all,
		};
	} catch (e) {
		if (e instanceof TemplateEditorError) {
			return { ok: false, problems: e.details.length > 0 ? e.details : [e.code] };
		}
		if (e instanceof CardSizeError) {
			return {
				ok: false,
				problems: e.problems,
				cardSize: {
					width: e.size.width,
					height: e.size.height,
					maxWidth: e.fit.max.width,
					maxHeight: e.fit.max.height,
				},
			};
		}
		const problems = problemsOf(e);
		if (problems) {
			return { ok: false, problems };
		}
		throw e;
	}
}

/**
 * Saves a draft as one configuration change after rendering it: the changed text files (and the
 * removal of a `design.json`).
 */
export function saveTemplateSource(
	ctx: ServerContext,
	draft: TemplateDraft,
	options: PreviewOptions,
	actor: AuditActor,
	now = new Date(),
): ConfigChange {
	const { db, configDir } = ctx;
	const { kind, name } = draft;
	const result = previewDraft(ctx, draft, options);
	if (!result.ok) {
		throw new TemplateEditorError("invalid", result.problems, result.cardSize);
	}
	const dir = configFolder(kind, name, configDir);
	const base = toSlash(relative(configDir, dir));
	const current = textFiles(dir);
	const writes: FileWrite[] = Object.entries(result.files)
		.filter(([f, content]) => current[f] !== content)
		.map(([f, content]) => ({ path: `${base}/${f}`, content }));
	if (existsSync(join(dir, LEGACY_DESIGN_FILE))) {
		writes.push({ path: `${base}/${LEGACY_DESIGN_FILE}`, content: null });
	}
	return saveConfigWrites(
		db,
		configDir,
		"templates",
		writes,
		actor,
		{ template: { kind, name }, files: writes.map((w) => w.path) },
		now,
	);
}
