// SPDX-License-Identifier: GPL-3.0-or-later
// The configuration is a folder (PLAN.md §3.6, Q78, step 2.4a): a base document plus fragments,
// merged here into one raw JSON object. Every merged key remembers the file it came from, so
// validation issues and `config:check --explain` can point at the right file.
//
//   config.json                  base document (or config.example.json in the repository)
//   <section>.json               one top-level section, deep-merged over the base (fragment wins)
//   calendar.<year>.json         holidays and closures appended to `calendar`
//   labels/stocks/<id>.json      one adhesive stock each, appended to `labels.stocks` (stem = id)
//   {cards,labels,slips}/templates/<name>/, reports/, classification/images/: discovered by their
//                                own steps, never merged into JSON (every kind: `CONFIG_FILES`)
import { existsSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { mergeCalendarFragments, readJsonFile } from "./load.js";
import type { ConfigPart } from "#lib/shared/archive-parts.js";
import { schemaSections } from "./introspect.js";
import type { ConfigIssue } from "./validate.js";

type Json = Record<string, unknown>;

/** Top-level sections a `<section>.json` fragment may hold. */
export const SECTION_NAMES: readonly string[] = schemaSections();

export const STOCKS_DIR = join("labels", "stocks");

export interface AssembledConfig {
	raw: Json;
	/** Dotted key path → file that defines it (deepest path wins on lookup). */
	origins: Map<string, string>;
	/** Files that took part, base first. */
	files: string[];
	warnings: ConfigIssue[];
}

const isObject = (v: unknown): v is Json =>
	typeof v === "object" && v !== null && !Array.isArray(v);

/** Deep merge: objects recurse, everything else (arrays included) is replaced by `over`. */
export function deepMerge(base: unknown, over: unknown): unknown {
	if (isObject(base) && isObject(over)) {
		const out: Json = { ...base };
		for (const [k, v] of Object.entries(over)) {
			out[k] = deepMerge(base[k], v);
		}
		return out;
	}
	return over;
}

function recordOrigins(
	origins: Map<string, string>,
	value: unknown,
	file: string,
	prefix: string,
): void {
	origins.set(prefix, file);
	if (isObject(value)) {
		for (const [k, v] of Object.entries(value)) {
			recordOrigins(origins, v, file, prefix ? `${prefix}.${k}` : k);
		}
	}
}

/** The file that defines `path` (`a.b.c`), by the longest recorded prefix. */
export function originOf(origins: Map<string, string>, path: string): string | undefined {
	const parts = path.split(".");
	for (let i = parts.length; i > 0; i--) {
		const hit = origins.get(parts.slice(0, i).join("."));
		if (hit) {
			return hit;
		}
	}
	return origins.get("");
}

function listJson(dir: string, pattern: RegExp): string[] {
	if (!existsSync(dir)) {
		return [];
	}
	return readdirSync(dir)
		.filter((f) => pattern.test(f))
		.sort();
}

/**
 * Merges the folder `dir` on top of `baseRaw` (already read from `baseFile`). Reading errors of
 * a fragment are reported with that file's name. `read` reads a fragment (the editors pass one
 * that answers with their unsaved drafts, step 11.2).
 */
export function assembleConfig(
	dir: string,
	baseRaw: Json,
	baseFile: string,
	read: (path: string) => Json = readJsonFile,
): AssembledConfig {
	const origins = new Map<string, string>();
	const files = [baseFile];
	const warnings: ConfigIssue[] = [];
	recordOrigins(origins, baseRaw, baseFile, "");
	let raw: Json = { ...baseRaw };

	// <section>.json fragments (config.json and calendar.<year>.json are not sections)
	for (const file of listJson(dir, /^[a-z][\w-]*\.json$/i)) {
		const stem = file.slice(0, -".json".length);
		if (stem === "config" || stem === "config.example") {
			continue;
		}
		const path = join(dir, file);
		if (!SECTION_NAMES.includes(stem)) {
			warnings.push({
				level: "warning",
				path: "(folder)",
				file: path,
				message: `"${file}" is not a configuration section (${SECTION_NAMES.join(", ")}) and is ignored`,
			});
			continue;
		}
		const fragment = read(path);
		if (stem in baseRaw) {
			warnings.push({
				level: "warning",
				path: stem,
				file: path,
				message: `"${stem}" is defined in ${baseFile} too: the values of "${file}" win`,
			});
		}
		raw[stem] = deepMerge(raw[stem], fragment);
		recordOrigins(origins, fragment, path, stem);
		files.push(path);
	}

	// calendar.<year>.json
	const calendarFiles = listJson(dir, /^calendar\.[\w-]+\.json$/);
	if (calendarFiles.length > 0) {
		raw = mergeCalendarFragments(
			raw,
			calendarFiles.map((f) => read(join(dir, f))),
		);
		for (const f of calendarFiles) {
			const path = join(dir, f);
			origins.set("calendar.holidays", path);
			origins.set("calendar.closedRanges", path);
			files.push(path);
		}
	}

	// labels/stocks/<id>.json
	const stocksDir = join(dir, STOCKS_DIR);
	const stockFiles = listJson(stocksDir, /^[\w-]+\.json$/);
	if (stockFiles.length > 0) {
		const labels = isObject(raw.labels) ? { ...raw.labels } : {};
		const stocks: Json[] = Array.isArray(labels.stocks) ? [...(labels.stocks as Json[])] : [];
		for (const f of stockFiles) {
			const path = join(stocksDir, f);
			const stock = read(path);
			const id = typeof stock.id === "string" ? stock.id : f.slice(0, -".json".length);
			const merged = { id, ...stock };
			const index = stocks.findIndex((s) => s.id === id);
			if (index === -1) {
				stocks.push(merged);
			} else {
				stocks[index] = merged;
			}
			origins.set(`labels.stocks.${index === -1 ? stocks.length - 1 : index}`, path);
			files.push(path);
		}
		labels.stocks = stocks;
		raw.labels = labels;
	}

	return { raw, origins, files, warnings };
}

/**
 * The files of a configuration folder (§3.6), one row per kind: what the editors (Phase 11,
 * coverage map), the configuration archive (step 11.3) and its parts (step 11.12) know about, and
 * what the shipped folder copies into CONFIG_DIR when missing. Paths use `/`. `part` is the part
 * of the archive the file belongs to: `sections` for the JSON documents cut by section,
 * `labelTemplates` for a label template (its part follows the kind in its `template.json`), null
 * for what never travels (the history).
 */
export const CONFIG_FILES = [
	{
		kind: "config.json",
		pattern: /^config(\.example)?\.json$/,
		part: "sections",
	},
	{
		kind: "<section>.json",
		pattern: /^[a-z][\w-]*\.json$/i,
		part: "sections",
		// the reports are read from the application folder, not copied (ADR-014)
		defaults: ["classification.json"],
	},
	{ kind: "calendar.<year>.json", pattern: /^calendar\.[\w-]+\.json$/, part: "calendar" },
	{
		kind: "labels/stocks/<id>.json",
		pattern: /^labels\/stocks\/[\w-]+\.json$/,
		part: "stocks",
		defaults: ["labels/stocks"],
	},
	{
		kind: "cards/templates/<name>/",
		pattern: /^cards\/templates\/[^/]+\/./,
		part: "cardTemplates",
		defaults: ["cards/templates"],
	},
	{
		kind: "labels/templates/<name>/",
		pattern: /^labels\/templates\/[^/]+\/./,
		part: "labelTemplates",
		defaults: ["labels/templates"],
	},
	{
		kind: "slips/templates/<name>/",
		pattern: /^slips\/templates\/[^/]+\/./,
		part: "slipTemplates",
		defaults: ["slips/templates"],
	},
	{ kind: "reports/<name>.json", pattern: /^reports\/[^/]+\.json$/, part: "reports" },
	{
		kind: "classification/images/",
		pattern: /^classification\/images\/[^/]+$/,
		part: "classification",
		defaults: ["classification/images"],
	},
	{ kind: "branding/logo.png", pattern: /^branding\/logo\.png$/, part: "logo" },
	{ kind: "i18n/<code>/", pattern: /^i18n\/[^/]+\/./, part: "languages" },
	{ kind: "history/", pattern: /^history\//, part: null },
] as const satisfies readonly {
	kind: string;
	pattern: RegExp;
	part: ConfigPart | "sections" | "labelTemplates" | null;
	defaults?: readonly string[];
}[];

export type ConfigFileKind = (typeof CONFIG_FILES)[number]["kind"];
export type ConfigFileRule = (typeof CONFIG_FILES)[number];
export const CONFIG_FILE_KINDS: readonly ConfigFileKind[] = CONFIG_FILES.map((f) => f.kind);

/** The folder of the history of changes (`history/<id>/`), never part of an archive. */
export const HISTORY_DIR = "history";

/** What the shipped folder copies into CONFIG_DIR when missing (config.json is written by the wizard). */
export const DEFAULT_ENTRIES: readonly string[] = CONFIG_FILES.flatMap((f) =>
	"defaults" in f ? f.defaults : [],
);

/**
 * Folders of the shipped `config/` that are read only from the application, never from
 * `CONFIG_DIR`: not configuration files, so no editor, no archive (Phase 12: the school presets;
 * step 11.17: the backgrounds the card designer copies into a template; 9.38: the shipped cards
 * without the photo, built-ins of the same names while photos are switched off).
 */
export const BUILTIN_ONLY_FOLDERS = [
	"school-presets/",
	"cards/backgrounds/",
	"cards/templates-no-photo/",
] as const;

/** The row of a file of the folder (relative path with `/`), or null for a file nobody reads. */
export function fileRuleOf(path: string): ConfigFileRule | null {
	return (
		CONFIG_FILES.find(
			(f) =>
				f.pattern.test(path) &&
				(f.kind !== "<section>.json" ||
					SECTION_NAMES.includes(path.slice(0, -".json".length))),
		) ?? null
	);
}

/** The kind of a file of the folder (relative path with `/`), or null for a file nobody reads. */
export function fileKindOf(path: string): ConfigFileKind | null {
	return fileRuleOf(path)?.kind ?? null;
}

/** A file of the folder that travels in an archive (known, outside the history, not the example). */
export function travels(path: string): boolean {
	const rule = fileRuleOf(path);
	return rule !== null && rule.part !== null && path !== "config.example.json";
}

/** Attaches the originating file to issues that lack one. */
export function attachFiles(issues: ConfigIssue[], origins: Map<string, string>): ConfigIssue[] {
	return issues.map((i) => (i.file ? i : { ...i, file: originOf(origins, i.path) }));
}
