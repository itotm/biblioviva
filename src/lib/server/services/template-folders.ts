// SPDX-License-Identifier: GPL-3.0-or-later
// Template folders from the admin UI (PLAN.md step 11.6): the card, label and slip templates with
// where they come from and which settings name them; duplicate (a built-in one too: a copy with the
// same name customises it), rename (the settings that name it follow), delete (refused while a
// setting names it, unless the built-in of the same name takes its place again), and the files of
// `assets/` uploaded and removed. Every operation is one configuration change (history, audit,
// "Ripristina").
import { ServiceError } from "#lib/server/errors.js";
import { BACKGROUND_NAME, cardBackgroundAsset } from "#lib/shared/card-backgrounds.js";
import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { extname, join, relative, sep } from "node:path";
import { loadConfig } from "#lib/server/config/load.js";
import type { AppConfig } from "#lib/server/config/schema.js";
import type { DbOrTx } from "#lib/server/db/client.js";
import { discoverTemplates, type TemplateKind } from "#lib/server/templates/engine.js";
import type { AuditActor } from "./audit.js";
import { draftWrites, keyDrafts, type ConfigChange, type FileWrite } from "./config-edit.js";
import { saveConfigWrites } from "./config-sections.js";
import { templatesOverview } from "./print-preview.js";
import { templateReferences } from "./template-refs.js";

export const TEMPLATE_NAME = /^[a-z0-9][a-z0-9_-]{0,63}$/;
export const ASSET_NAME = /^[\w-][\w.-]{0,99}$/;
/** Files of `assets/` the engine inlines (`assetDataUrl`). */
export const ASSET_TYPES = [
	".png",
	".jpg",
	".jpeg",
	".webp",
	".svg",
	".gif",
	".woff2",
	".woff",
	".ttf",
];
export const MAX_ASSET_BYTES = 5_000_000;

// --- The list --------------------------------------------------------------------------------

export interface TemplateAsset {
	file: string;
	bytes: number;
	/** Files of the template (HTML, CSS, template.json) that mention it. */
	usedIn: string[];
}

export interface TemplateFolderView {
	kind: TemplateKind;
	name: string;
	description: string;
	source: "builtin" | "config";
	/** A folder of CONFIG_DIR that replaces a built-in template with the same name. */
	overridesBuiltin: boolean;
	/** Label templates: pair, barcode or spine. */
	labelKind: string | null;
	/** Settings that name it. */
	usedBy: string[];
	files: string[];
	assets: TemplateAsset[];
	error: string | null;
}

const toSlash = (p: string): string => p.split(sep).join("/");

/** The names of the templates shipped with the application. */
function builtinNames(kind: TemplateKind, builtinRoot = "config"): Set<string> {
	return new Set(discoverTemplates(kind, builtinRoot, builtinRoot).map((t) => t.name));
}

/** Every file of a folder, relative and with forward slashes. */
function filesOf(dir: string): string[] {
	if (!existsSync(dir)) {
		return [];
	}
	const out: string[] = [];
	const walk = (d: string): void => {
		for (const name of readdirSync(d).sort()) {
			const path = join(d, name);
			if (statSync(path).isDirectory()) {
				walk(path);
			} else {
				out.push(toSlash(relative(dir, path)));
			}
		}
	};
	walk(dir);
	return out;
}

function assetsOf(dir: string, files: string[]): TemplateAsset[] {
	const texts = files
		.filter((f) => !f.startsWith("assets/"))
		.map((f) => ({ f, text: readFileSync(join(dir, f), "utf8") }));
	return files
		.filter((f) => f.startsWith("assets/"))
		.map((f) => {
			const file = f.slice("assets/".length);
			return {
				file,
				bytes: statSync(join(dir, f)).size,
				usedIn: texts.filter((t) => t.text.includes(file)).map((t) => t.f),
			};
		});
}

export function templateFolders(
	config: AppConfig,
	configDir: string,
	builtinRoot?: string,
): TemplateFolderView[] {
	const overview = templatesOverview(config, configDir, builtinRoot);
	const refs = templateReferences(config);
	return [...overview.cards, ...overview.labels, ...overview.slips].map((t) => {
		const builtin = builtinNames(t.kind, builtinRoot).has(t.name);
		const files = filesOf(t.dir);
		return {
			kind: t.kind,
			name: t.name,
			description: t.description,
			source: t.source,
			overridesBuiltin: t.source === "config" && builtin,
			labelKind: t.labelKind,
			usedBy: refs.filter((r) => r.kind === t.kind && r.name === t.name).map((r) => r.key),
			files,
			assets: assetsOf(t.dir, files),
			error: t.error,
		};
	});
}

// --- Changes ---------------------------------------------------------------------------------

export class TemplateFolderError extends ServiceError {
	constructor(
		override readonly code:
			| "notFound"
			| "badName"
			| "exists"
			| "builtin"
			| "inUse"
			| "badAsset"
			| "assetTooLarge"
			| "assetInUse",
		readonly details: string[] = [],
	) {
		super(
			code,
			`template folder: ${code}${details.length > 0 ? ` (${details.join(", ")})` : ""}`,
		);
		this.name = "TemplateFolderError";
	}
}

function folderOf(
	kind: TemplateKind,
	name: string,
	configDir: string,
	builtinRoot?: string,
): { dir: string; source: "builtin" | "config" } {
	const found = discoverTemplates(kind, configDir, builtinRoot).find((t) => t.name === name);
	if (!found) {
		throw new TemplateFolderError("notFound", [name]);
	}
	return found;
}

const target = (kind: TemplateKind, name: string, file = ""): string =>
	`${kind}/templates/${name}${file ? `/${file}` : ""}`;

/** The files of a folder written under another name (template.json gets the new name). */
function copyWrites(dir: string, kind: TemplateKind, to: string): FileWrite[] {
	return filesOf(dir).map((f) => {
		const content = readFileSync(join(dir, f));
		if (f === "template.json") {
			try {
				const meta = JSON.parse(content.toString("utf8")) as Record<string, unknown>;
				meta.name = to;
				return {
					path: target(kind, to, f),
					content: `${JSON.stringify(meta, null, "\t")}\n`,
				};
			} catch {
				// a broken template.json is copied as it is: the list reports it
			}
		}
		return { path: target(kind, to, f), content: new Uint8Array(content) };
	});
}

function change(
	db: DbOrTx,
	configDir: string,
	writes: FileWrite[],
	actor: AuditActor,
	details: Record<string, unknown>,
	now: Date,
): ConfigChange {
	return saveConfigWrites(db, configDir, "templates", writes, actor, details, now);
}

/**
 * A copy of a template under a new name in CONFIG_DIR; `to` equal to the name of a built-in
 * template that has no copy yet customises it.
 */
export function duplicateTemplate(
	db: DbOrTx,
	configDir: string,
	kind: TemplateKind,
	from: string,
	to: string,
	actor: AuditActor,
	now = new Date(),
	builtinRoot?: string,
): ConfigChange {
	if (!TEMPLATE_NAME.test(to)) {
		throw new TemplateFolderError("badName", [to]);
	}
	const source = folderOf(kind, from, configDir, builtinRoot);
	const existing = discoverTemplates(kind, configDir, builtinRoot).find((t) => t.name === to);
	if (existing && !(existing.source === "builtin" && from === to)) {
		throw new TemplateFolderError("exists", [to]);
	}
	return change(
		db,
		configDir,
		copyWrites(source.dir, kind, to),
		actor,
		{ duplicate: { kind, from, to } },
		now,
	);
}

/** A template of CONFIG_DIR under a new name; the settings that name it follow. */
export function renameTemplate(
	db: DbOrTx,
	configDir: string,
	kind: TemplateKind,
	from: string,
	to: string,
	actor: AuditActor,
	now = new Date(),
	builtinRoot?: string,
): ConfigChange {
	if (!TEMPLATE_NAME.test(to)) {
		throw new TemplateFolderError("badName", [to]);
	}
	const source = folderOf(kind, from, configDir, builtinRoot);
	if (source.source !== "config") {
		throw new TemplateFolderError("builtin", [from]);
	}
	if (discoverTemplates(kind, configDir, builtinRoot).some((t) => t.name === to)) {
		throw new TemplateFolderError("exists", [to]);
	}
	const loaded = loadConfig(configDir);
	const patch: Record<string, unknown> = {};
	for (const r of templateReferences(loaded.config)) {
		if (r.kind === kind && r.name === from) {
			if (r.key.startsWith("cards.templateByPatronType.")) {
				patch["cards.templateByPatronType"] = Object.fromEntries(
					Object.entries(loaded.config.cards.templateByPatronType).map(([t, n]) => [
						t,
						n === from ? to : n,
					]),
				);
			} else {
				patch[r.key] = to;
			}
		}
	}
	const writes = [
		...copyWrites(source.dir, kind, to),
		...filesOf(source.dir).map((f) => ({ path: target(kind, from, f), content: null })),
		...draftWrites(keyDrafts(configDir, loaded, patch)),
	];
	return change(
		db,
		configDir,
		writes,
		actor,
		{ rename: { kind, from, to }, settings: Object.keys(patch) },
		now,
	);
}

/**
 * Removes a template of CONFIG_DIR. Refused while a setting names it, unless a built-in template
 * with the same name takes its place (the copy goes, the original comes back).
 */
export function deleteTemplate(
	db: DbOrTx,
	configDir: string,
	kind: TemplateKind,
	name: string,
	actor: AuditActor,
	now = new Date(),
	builtinRoot?: string,
): ConfigChange {
	const source = folderOf(kind, name, configDir, builtinRoot);
	if (source.source !== "config") {
		throw new TemplateFolderError("builtin", [name]);
	}
	const builtin = builtinNames(kind, builtinRoot).has(name);
	const usedBy = templateReferences(loadConfig(configDir).config)
		.filter((r) => r.kind === kind && r.name === name)
		.map((r) => r.key);
	if (usedBy.length > 0 && !builtin) {
		throw new TemplateFolderError("inUse", usedBy);
	}
	return change(
		db,
		configDir,
		filesOf(source.dir).map((f) => ({ path: target(kind, name, f), content: null })),
		actor,
		{ delete: { kind, name } },
		now,
	);
}

/** Whether the bytes look like the type their name says (fonts are taken as they are). */
function looksLike(ext: string, bytes: Uint8Array): boolean {
	const starts = (...sig: number[]): boolean => sig.every((b, i) => bytes[i] === b);
	switch (ext) {
		case ".png":
			return starts(0x89, 0x50, 0x4e, 0x47);
		case ".jpg":
		case ".jpeg":
			return starts(0xff, 0xd8, 0xff);
		case ".gif":
			return starts(0x47, 0x49, 0x46);
		case ".webp":
			return starts(0x52, 0x49, 0x46, 0x46) && bytes[8] === 0x57 && bytes[9] === 0x45;
		case ".svg": {
			const text = new TextDecoder().decode(bytes.slice(0, 4096)).toLowerCase();
			return text.includes("<svg") && !text.includes("<script");
		}
		default:
			return true;
	}
}

/** Adds (or replaces) a file of `assets/` of a template of CONFIG_DIR. */
export function uploadTemplateAsset(
	db: DbOrTx,
	configDir: string,
	kind: TemplateKind,
	name: string,
	file: string,
	bytes: Uint8Array,
	actor: AuditActor,
	now = new Date(),
	builtinRoot?: string,
): ConfigChange {
	const source = folderOf(kind, name, configDir, builtinRoot);
	if (source.source !== "config") {
		throw new TemplateFolderError("builtin", [name]);
	}
	const ext = extname(file).toLowerCase();
	if (!ASSET_NAME.test(file) || !ASSET_TYPES.includes(ext)) {
		throw new TemplateFolderError("badAsset", [file]);
	}
	if (bytes.byteLength > MAX_ASSET_BYTES) {
		throw new TemplateFolderError("assetTooLarge", [file]);
	}
	if (bytes.byteLength === 0 || !looksLike(ext, bytes)) {
		throw new TemplateFolderError("badAsset", [file]);
	}
	return change(
		db,
		configDir,
		[{ path: target(kind, name, `assets/${file}`), content: bytes }],
		actor,
		{ asset: { kind, name, file, bytes: bytes.byteLength } },
		now,
	);
}

/** Removes a file of `assets/`; refused while a file of the template mentions it. */
export function deleteTemplateAsset(
	db: DbOrTx,
	configDir: string,
	kind: TemplateKind,
	name: string,
	file: string,
	actor: AuditActor,
	now = new Date(),
	builtinRoot?: string,
): ConfigChange {
	const source = folderOf(kind, name, configDir, builtinRoot);
	if (source.source !== "config") {
		throw new TemplateFolderError("builtin", [name]);
	}
	const files = filesOf(source.dir);
	const asset = assetsOf(source.dir, files).find((a) => a.file === file);
	if (!asset) {
		throw new TemplateFolderError("notFound", [file]);
	}
	if (asset.usedIn.length > 0) {
		throw new TemplateFolderError("assetInUse", asset.usedIn);
	}
	return change(
		db,
		configDir,
		[{ path: target(kind, name, `assets/${file}`), content: null }],
		actor,
		{ removeAsset: { kind, name, file } },
		now,
	);
}

// --- The backgrounds of the cards (step 11.17) ---------------------------------------------------

// each picture is the card plus `BACKGROUND_BLEED_MM` on every side, to be cut away
// (#lib/shared/card-backgrounds.ts)

export interface CardBackground {
	name: string;
	orientation: "landscape" | "portrait";
}

/** The backgrounds shipped with the app (`config/cards/backgrounds/`). */
export function cardBackgrounds(builtinRoot = "config"): CardBackground[] {
	const path = join(builtinRoot, "cards", "backgrounds", "backgrounds.json");
	if (!existsSync(path)) {
		return [];
	}
	const list = (JSON.parse(readFileSync(path, "utf8")) as { backgrounds?: CardBackground[] })
		.backgrounds;
	return (list ?? []).filter(
		(b) =>
			BACKGROUND_NAME.test(b.name) &&
			existsSync(join(builtinRoot, "cards", "backgrounds", `${b.name}.webp`)),
	);
}

/** The picture of a shipped background, or null for a name that is not one. */
export function cardBackgroundFile(name: string, builtinRoot = "config"): Uint8Array | null {
	if (!cardBackgrounds(builtinRoot).some((b) => b.name === name)) {
		return null;
	}
	return readFileSync(join(builtinRoot, "cards", "backgrounds", `${name}.webp`));
}

/**
 * Copies a shipped background into `assets/` of a card template of CONFIG_DIR, where the faces
 * can use it (the template keeps working once copied elsewhere, archive included). Returns the
 * asset's file name.
 */
export function addCardBackground(
	db: DbOrTx,
	configDir: string,
	name: string,
	background: string,
	actor: AuditActor,
	now = new Date(),
	builtinRoot = "config",
): string {
	const bytes = cardBackgroundFile(background, builtinRoot);
	if (!bytes) {
		throw new TemplateFolderError("notFound", [background]);
	}
	const file = cardBackgroundAsset(background);
	uploadTemplateAsset(db, configDir, "cards", name, file, bytes, actor, now, builtinRoot);
	return file;
}
