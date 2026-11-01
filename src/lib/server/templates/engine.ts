// SPDX-License-Identifier: GPL-3.0-or-later
// Print template engine shared by cards, labels and slips (PLAN.md §3.12, step 2.5): a template is
// a folder with `template.json`, Mustache HTML files, `style.css` and `assets/`. This module
// discovers folders (the repository defaults under `config/<kind>/templates/` — the cards under
// `config/cards/templates-no-photo/` while patron photos are switched off, 9.38 —, overridden by
// `CONFIG_DIR/<kind>/templates/` with the same name), inlines assets as data URLs, scopes the CSS
// and renders with a strict field allowlist. Every value is HTML-escaped by Mustache except the
// fields declared `raw`.
import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import Mustache from "mustache";
import * as v from "valibot";
import { featureOn } from "#lib/server/features.js";
import { fileDataUrl, mimeOf } from "./data-url.js";

export type TemplateKind = "cards" | "labels" | "slips";

export interface TemplateFolder {
	kind: TemplateKind;
	name: string;
	dir: string;
	/** `builtin` = shipped with the app, `config` = CONFIG_DIR (overrides a built-in of the same name). */
	source: "builtin" | "config";
}

export class TemplateError extends Error {
	constructor(
		readonly template: string,
		readonly problems: string[],
	) {
		super(`template "${template}": ${problems.join("; ")}`);
		this.name = "TemplateError";
	}
}

const NAME = /^[a-z0-9][a-z0-9_-]*$/i;

/** The shipped cards without the photo, the same names as the others (9.38, Q135). */
export const NO_PHOTO_CARDS = "templates-no-photo";

/**
 * The folder of `<builtinRoot>/<kind>/` holding the shipped templates: the cards without the photo
 * while photos are switched off (`photos` overrides the configuration, for tests and the wizard).
 */
export function shippedTemplatesDir(kind: TemplateKind, photos?: boolean): string {
	return kind === "cards" && !(photos ?? featureOn("photos")) ? NO_PHOTO_CARDS : "templates";
}

/** Every template folder of a kind, config ones overriding built-ins with the same name. */
export function discoverTemplates(
	kind: TemplateKind,
	configDir: string,
	builtinRoot = "config",
	/** Photos on or off (default: the configuration's `photos.enabled`, 9.38). */
	photos?: boolean,
): TemplateFolder[] {
	const found = new Map<string, TemplateFolder>();
	const scan = (root: string, source: TemplateFolder["source"]): void => {
		const base = join(
			root,
			kind,
			source === "builtin" ? shippedTemplatesDir(kind, photos) : "templates",
		);
		if (!existsSync(base)) {
			return;
		}
		for (const name of readdirSync(base).sort()) {
			const dir = join(base, name);
			if (!NAME.test(name) || !statSync(dir).isDirectory()) {
				continue;
			}
			if (!existsSync(join(dir, "template.json"))) {
				continue;
			}
			found.set(name, { kind, name, dir, source });
		}
	};
	scan(builtinRoot, "builtin");
	scan(configDir, "config");
	return [...found.values()].sort((a, b) => a.name.localeCompare(b.name));
}

export function findTemplate(
	kind: TemplateKind,
	name: string,
	configDir: string,
	builtinRoot = "config",
): TemplateFolder | undefined {
	return discoverTemplates(kind, configDir, builtinRoot).find((t) => t.name === name);
}

/** Data URL of a file in the template's `assets/` folder; throws a readable error when missing. */
export function assetDataUrl(folder: TemplateFolder, file: string): string {
	const clean = file.trim();
	if (!/^[\w.-]+$/.test(clean)) {
		throw new TemplateError(folder.name, [`asset name not allowed: "${clean}"`]);
	}
	const path = join(folder.dir, "assets", clean);
	if (!existsSync(path)) {
		throw new TemplateError(folder.name, [`asset not found: assets/${clean}`]);
	}
	const mime = mimeOf(clean);
	if (!mime) {
		throw new TemplateError(folder.name, [`asset type not allowed: ${clean}`]);
	}
	return fileDataUrl(path, mime);
}

export function readTemplateFile(folder: TemplateFolder, file: string): string {
	const path = join(folder.dir, file);
	if (!existsSync(path)) {
		throw new TemplateError(folder.name, [`missing file: ${file}`]);
	}
	return readFileSync(path, "utf8");
}

export function readTemplateJson<S extends v.GenericSchema>(
	folder: TemplateFolder,
	schema: S,
): v.InferOutput<S> {
	let raw: unknown;
	try {
		raw = JSON.parse(readTemplateFile(folder, "template.json"));
	} catch (e) {
		if (e instanceof TemplateError) {
			throw e;
		}
		throw new TemplateError(folder.name, [`template.json: ${(e as Error).message}`]);
	}
	const result = v.safeParse(schema, raw);
	if (!result.success) {
		throw new TemplateError(
			folder.name,
			result.issues.map(
				(i) =>
					`template.json ${(i.path ?? []).map((p) => String((p as { key: unknown }).key)).join(".")}: ${i.message}`,
			),
		);
	}
	return result.output;
}

/** A kind of template: its folders, the schema of its `template.json` and the checks it adds. */
export interface TemplateType<S extends v.GenericSchema> {
	kind: TemplateKind;
	schema: S;
	/** Problems the schema cannot express (none: the template loads). */
	check?: (meta: v.InferOutput<S>) => string[];
}

export interface LoadedTemplate<M> {
	folder: TemplateFolder;
	meta: M;
}

/** One entry per discovered template: its folder, the parsed meta or the error that stops it. */
export type TemplateStatus<M> = TemplateFolder & { meta: M | null; error: string | null };

function readMeta<S extends v.GenericSchema>(
	type: TemplateType<S>,
	folder: TemplateFolder,
): v.InferOutput<S> {
	const meta = readTemplateJson(folder, type.schema);
	const problems = type.check?.(meta) ?? [];
	if (problems.length > 0) {
		throw new TemplateError(folder.name, problems);
	}
	return meta;
}

/** The folder of a template and its checked `template.json`; a `TemplateError` otherwise. */
export function loadTemplate<S extends v.GenericSchema>(
	type: TemplateType<S>,
	name: string,
	configDir: string,
	builtinRoot?: string,
): LoadedTemplate<v.InferOutput<S>> {
	const folder = findTemplate(type.kind, name, configDir, builtinRoot);
	if (!folder) {
		throw new TemplateError(name, ["template folder not found"]);
	}
	return { folder, meta: readMeta(type, folder) };
}

/** Every template of a kind with its meta, or the error that stops it. */
export function listTemplates<S extends v.GenericSchema>(
	type: TemplateType<S>,
	configDir: string,
	builtinRoot?: string,
): TemplateStatus<v.InferOutput<S>>[] {
	return discoverTemplates(type.kind, configDir, builtinRoot).map((folder) => {
		try {
			return { ...folder, meta: readMeta(type, folder), error: null };
		} catch (e) {
			return { ...folder, meta: null, error: e instanceof Error ? e.message : String(e) };
		}
	});
}

/**
 * Names used by a Mustache template (`{{a.b}}`, `{{#a}}`, `{{{a}}}`), with the section context
 * resolved so `{{#patron}}{{first_name}}{{/patron}}` counts as `patron.first_name`.
 */
export function usedFields(template: string): Set<string> {
	const names = new Set<string>();
	const walk = (tokens: unknown[], scope: string[]): void => {
		for (const token of tokens as [string, string, number, number, unknown[]?][]) {
			const [type, name] = token;
			if (type === "name" || type === "&") {
				names.add([...scope, name].join("."));
			}
			if (type === "#" || type === "^") {
				const full = [...scope, name].join(".");
				names.add(full);
				walk(token[4] ?? [], [...scope, name]);
			}
		}
	};
	walk(Mustache.parse(template), []);
	return names;
}

/** Fields not in the allowlist (exact names, or descendants of an allowed object such as `rows`). */
export function unknownFields(template: string, allowed: readonly string[]): string[] {
	const allow = new Set(allowed);
	return [...usedFields(template)]
		.filter((f) => {
			if (allow.has(f)) {
				return false;
			}
			// a section over an allowed list/object may use relative names: `rows.patron.first_name`
			const parts = f.split(".");
			for (let i = parts.length - 1; i > 0; i--) {
				if (allow.has(parts.slice(0, i).join("."))) {
					return !allow.has(parts.slice(i).join(".")) && !allow.has(f);
				}
			}
			return true;
		})
		.filter((f) => f !== ".");
}

/** Prefixes every selector of `css` with `.${scope}` (nested at-rules included, `@font-face`/`@page` untouched). */
export function scopeCss(css: string, scope: string): string {
	const prefix = `.${scope}`;
	let out = "";
	let i = 0;
	const n = css.length;
	while (i < n) {
		const open = css.indexOf("{", i);
		if (open === -1) {
			out += css.slice(i);
			break;
		}
		// comments before a selector stay out of it (a comma in one would split the selector)
		const head = css.slice(i, open).replace(/\/\*[\s\S]*?\*\//g, "");
		const trimmed = head.trim();
		if (trimmed.startsWith("@")) {
			// find the matching brace of the at-rule block
			let depth = 1;
			let j = open + 1;
			while (j < n && depth > 0) {
				if (css[j] === "{") {
					depth++;
				} else if (css[j] === "}") {
					depth--;
				}
				j++;
			}
			const body = css.slice(open + 1, j - 1);
			const keep = /^@(font-face|page|keyframes|counter-style)/.test(trimmed);
			out += `${head}{${keep ? body : scopeCss(body, scope)}}`;
			i = j;
			continue;
		}
		const close = css.indexOf("}", open);
		const selectors = trimmed
			.split(",")
			.map((s) => s.trim())
			.filter(Boolean)
			.map((s) => `${prefix} ${s}`)
			.join(", ");
		out += `${head.slice(0, head.length - head.trimStart().length)}${selectors} {${css.slice(open + 1, close)}}`;
		i = close + 1;
	}
	return out;
}

/** HTML escaping for values (Mustache's default also escapes `/` and `=`, which bloats data URLs). */
export function escapeHtml(value: unknown): string {
	const text =
		typeof value === "object" && value !== null
			? JSON.stringify(value)
			: String((value as string | number | boolean | null | undefined) ?? "");
	return text.replace(
		/[&<>"']/g,
		(c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c] ?? c,
	);
}

export interface RenderedTemplate {
	html: Record<string, string>;
	css: string;
	scope: string;
}

/**
 * The rules every template gets before its own `style.css`: the barcode of an element with the
 * class `bv-barcode` fills the element (the designer's barcode, step 11.16).
 */
export const BASE_CSS = ".bv-barcode > svg { display: block; width: 100%; height: 100%; }\n";

/**
 * Renders the given HTML files of a template with `context`, checks their fields against
 * `allowed`, inlines assets (`{{#asset}}file{{/asset}}` in HTML and CSS) and scopes the CSS
 * (`BASE_CSS` first).
 */
export function renderTemplate(
	folder: TemplateFolder,
	files: string[],
	context: Record<string, unknown>,
	allowed: readonly string[],
): RenderedTemplate {
	const problems: string[] = [];
	const sources: Record<string, string> = {};
	for (const file of files) {
		try {
			sources[file] = readTemplateFile(folder, file);
			for (const f of unknownFields(sources[file], [...allowed, "asset"])) {
				problems.push(`${file}: unknown field {{${f}}}`);
			}
		} catch (e) {
			problems.push(...(e instanceof TemplateError ? e.problems : [String(e)]));
		}
	}
	if (problems.length > 0) {
		throw new TemplateError(folder.name, problems);
	}
	const asset = () => (text: string, render: (t: string) => string) =>
		assetDataUrl(folder, render(text));
	const view = { ...context, asset };
	const html: Record<string, string> = {};
	for (const file of files) {
		html[file] = Mustache.render(sources[file] ?? "", view, {}, { escape: escapeHtml });
	}
	const scope = `tpl-${folder.kind}-${folder.name}`;
	const cssSource = existsSync(join(folder.dir, "style.css"))
		? readTemplateFile(folder, "style.css")
		: "";
	const css = scopeCss(
		BASE_CSS + Mustache.render(cssSource, { asset }, {}, { escape: (s: string) => s }),
		scope,
	);
	return { html, css, scope };
}

const DATA_URL = /url\((['"]?)(data:[^'")\s]+)\1\)/g;

/**
 * Each picture once per printed document (step 9.29): a data URL that the faces use in their
 * styles (`url('data:…')`, a background) is taken out of every face and written once, as a CSS
 * custom property of the document (`--bv-asset-N`), which each face refers to (`var(…)`). What is
 * printed does not change; a sheet of cards no longer carries the back's picture once per card.
 * Only the HTML of the faces is changed, never a style sheet (`@font-face` takes no `var()`).
 */
export function shareDataUrls(body: string): { body: string; css: string } {
	const names = new Map<string, string>();
	const shared = body.replace(DATA_URL, (_, _quote: string, url: string) => {
		let name = names.get(url);
		if (!name) {
			name = `--bv-asset-${names.size + 1}`;
			names.set(url, name);
		}
		return `var(${name})`;
	});
	const css = [...names].map(([url, name]) => `${name}: url("${url}");`).join("\n");
	return { body: shared, css: css ? `:root {\n${css}\n}` : "" };
}
