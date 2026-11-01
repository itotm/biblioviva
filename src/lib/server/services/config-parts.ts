// SPDX-License-Identifier: GPL-3.0-or-later
// The configuration folder cut into parts (PLAN.md step 11.12): each file belongs to a part by its
// place (`reports/` → reports, `labels/templates/<name>/` → the templates of its kind, …) and the
// JSON documents are cut by section (`config.json` holds many; `labels.stocks` goes with the
// stocks). `partsIn` tells what a folder holds, `selectedFiles` writes only some parts (an export),
// `mergeParts` builds the folder the live one becomes when some parts are taken from another one
// (an import or a restore): the other parts stay exactly as they are.
import {
	cpSync,
	existsSync,
	mkdirSync,
	readdirSync,
	readFileSync,
	rmSync,
	writeFileSync,
} from "node:fs";
import { dirname, join } from "node:path";
import { fileKindOf, fileRuleOf, HISTORY_DIR, SECTION_NAMES } from "#lib/server/config/folder.js";
import { listFilesRecursive } from "#lib/server/runtime/fs.js";
import { configPart, sectionPartOf, type PartId } from "#lib/shared/archive-parts.js";

type Json = Record<string, unknown>;

const BASE = "config.json";

const isObject = (v: unknown): v is Json =>
	typeof v === "object" && v !== null && !Array.isArray(v);

function readJson(path: string): Json | null {
	try {
		const value: unknown = JSON.parse(readFileSync(path, "utf8"));
		return isObject(value) ? value : null;
	} catch {
		return null;
	}
}
const json = (value: unknown): string => `${JSON.stringify(value, null, "\t")}\n`;

/** Every file of a folder (relative, forward slashes), the history left out. */
export function folderFiles(dir: string): string[] {
	return listFilesRecursive(dir, (sub) => sub === HISTORY_DIR);
}

const isSectionFile = (rel: string): boolean => fileKindOf(rel) === "<section>.json";

/**
 * The part of a file other than config.json and the section fragments (which are cut by key),
 * or null for files that belong to no part (the history, anything unknown): the table of the
 * folder's files (`CONFIG_FILES`), a label template by the kind in its `template.json`.
 */
export function filePart(rel: string, dir: string): PartId | null {
	const part = fileRuleOf(rel)?.part ?? null;
	if (part === null || part === "sections") {
		return null;
	}
	if (part !== "labelTemplates") {
		return configPart(part);
	}
	const name = rel.split("/")[2] ?? "";
	const kind = readJson(join(dir, "labels", "templates", name, "template.json"))?.kind;
	return configPart(
		kind === "barcode"
			? "barcodeTemplates"
			: kind === "spine"
				? "spineTemplates"
				: "pairTemplates",
	);
}

/** The sections a folder defines, where: in config.json and/or in `<section>.json`. */
function sectionsIn(dir: string): { base: Json | null; fragments: Record<string, Json> } {
	const base = existsSync(join(dir, BASE)) ? readJson(join(dir, BASE)) : null;
	const fragments: Record<string, Json> = {};
	for (const f of existsSync(dir) ? readdirSync(dir) : []) {
		if (isSectionFile(f)) {
			const doc = readJson(join(dir, f));
			if (doc) {
				fragments[f.slice(0, -".json".length)] = doc;
			}
		}
	}
	return { base, fragments };
}

const hasStocks = (value: unknown): boolean => isObject(value) && "stocks" in value;

/** Every part a folder holds something of. */
export function partsIn(dir: string): PartId[] {
	const found = new Set<PartId>();
	for (const rel of folderFiles(dir)) {
		const part = rel === BASE || isSectionFile(rel) ? null : filePart(rel, dir);
		if (part) {
			found.add(part);
		}
	}
	const { base, fragments } = sectionsIn(dir);
	for (const section of SECTION_NAMES) {
		const inBase = base?.[section];
		const inFragment = fragments[section];
		if (inBase !== undefined || inFragment) {
			const values = [inBase, inFragment].filter(isObject);
			const onlyStocks =
				section === "labels" &&
				values.every((v) =>
					Object.keys(v).every((k) => k === "stocks" || k.startsWith("_")),
				);
			if (!onlyStocks) {
				found.add(sectionPartOf(section));
			}
			if (section === "labels" && values.some(hasStocks)) {
				found.add(configPart("stocks"));
			}
		}
	}
	return [...found].sort();
}

/** A section's value without the keys another part owns (`labels.stocks`). */
function sectionOwn(section: string, value: Json): Json {
	if (section !== "labels") {
		return value;
	}
	return Object.fromEntries(Object.entries(value).filter(([k]) => k !== "stocks"));
}

/**
 * The files of the selected parts, as an export writes them: config.json and the section
 * fragments cut to the selected sections (comments kept), every other file of a selected part.
 */
export function selectedFiles(dir: string, parts: readonly PartId[]): Record<string, Uint8Array> {
	const selected = new Set(parts);
	const out: Record<string, Uint8Array> = {};
	for (const rel of folderFiles(dir)) {
		if (rel === BASE || isSectionFile(rel)) {
			continue;
		}
		const part = filePart(rel, dir);
		if (part && selected.has(part)) {
			out[rel] = new Uint8Array(readFileSync(join(dir, rel)));
		}
	}
	const { base, fragments } = sectionsIn(dir);
	/** Every section of a document is taken whole: the file travels as it is. */
	const whole = (sections: [string, unknown][]): boolean =>
		sections.every(
			([section, value]) =>
				selected.has(sectionPartOf(section)) &&
				(section !== "labels" || !hasStocks(value) || selected.has(configPart("stocks"))),
		);
	const cut = (section: string, value: unknown): unknown => {
		if (!isObject(value)) {
			return selected.has(sectionPartOf(section)) ? value : undefined;
		}
		const own = selected.has(sectionPartOf(section)) ? sectionOwn(section, value) : {};
		const stocks =
			section === "labels" && selected.has(configPart("stocks")) && "stocks" in value
				? { stocks: value.stocks }
				: {};
		const out = { ...own, ...stocks };
		return Object.keys(out).length > 0 ? out : undefined;
	};
	const raw = (rel: string): Uint8Array => new Uint8Array(readFileSync(join(dir, rel)));
	if (base && whole(Object.entries(base).filter(([k]) => SECTION_NAMES.includes(k)))) {
		out[BASE] = raw(BASE);
	} else if (base) {
		const doc: Json = {};
		for (const [k, v] of Object.entries(base)) {
			if (!SECTION_NAMES.includes(k)) {
				doc[k] = v; // comments and other top-level keys
				continue;
			}
			const kept = cut(k, v);
			if (kept !== undefined) {
				doc[k] = kept;
			}
		}
		if (Object.keys(doc).some((k) => SECTION_NAMES.includes(k))) {
			out[BASE] = new TextEncoder().encode(json(doc));
		}
	}
	for (const [section, doc] of Object.entries(fragments)) {
		if (whole([[section, doc]])) {
			out[`${section}.json`] = raw(`${section}.json`);
			continue;
		}
		const kept = cut(section, doc);
		if (kept !== undefined) {
			out[`${section}.json`] = new TextEncoder().encode(json(kept));
		}
	}
	return out;
}

/**
 * Builds in `out` the folder `live` becomes when the `parts` are taken from `from`: the files of
 * those parts replaced (removed when `from` has none), the sections replaced where `from` writes
 * them, everything else as in `live`. The history is not copied.
 */
export function mergeParts(
	live: string,
	from: string,
	parts: readonly PartId[],
	out: string,
): void {
	rmSync(out, { recursive: true, force: true });
	mkdirSync(out, { recursive: true });
	for (const rel of folderFiles(live)) {
		mkdirSync(dirname(join(out, rel)), { recursive: true });
		cpSync(join(live, rel), join(out, rel));
	}
	const selected = new Set(parts);

	// files: the live ones of the parts go, the other folder's come in
	for (const rel of folderFiles(live)) {
		if (rel !== BASE && !isSectionFile(rel)) {
			const part = filePart(rel, live);
			if (part && selected.has(part)) {
				rmSync(join(out, rel), { force: true });
			}
		}
	}
	for (const rel of folderFiles(from)) {
		if (rel !== BASE && !isSectionFile(rel)) {
			const part = filePart(rel, from);
			if (part && selected.has(part)) {
				mkdirSync(dirname(join(out, rel)), { recursive: true });
				cpSync(join(from, rel), join(out, rel));
			}
		}
	}

	// sections: taken as the other folder writes them (config.json or its own file)
	const src = sectionsIn(from);
	const base: Json = existsSync(join(out, BASE)) ? (readJson(join(out, BASE)) ?? {}) : {};
	const baseBefore = JSON.stringify(base);
	/** A document written only when its content changes: the untouched keep their bytes. */
	const writeDoc = (path: string, doc: Json): void => {
		const current = existsSync(path) ? readJson(path) : null;
		if (JSON.stringify(current) !== JSON.stringify(doc)) {
			writeFileSync(path, json(doc));
		}
	};
	const writeFragment = (section: string, doc: Json | null): void => {
		const path = join(out, `${section}.json`);
		if (doc && Object.keys(doc).some((k) => !k.startsWith("_"))) {
			writeDoc(path, doc);
		} else {
			rmSync(path, { force: true });
		}
	};
	const fragmentOf = (section: string): Json | null =>
		existsSync(join(out, `${section}.json`)) ? readJson(join(out, `${section}.json`)) : null;
	for (const section of SECTION_NAMES) {
		if (!selected.has(sectionPartOf(section))) {
			continue;
		}
		// what the live side keeps of it: the stocks of the labels
		const keepBase =
			isObject(base[section]) && section === "labels" && hasStocks(base[section])
				? { stocks: base[section].stocks }
				: null;
		const liveFragment = fragmentOf(section);
		const keepFragment =
			liveFragment && section === "labels" && hasStocks(liveFragment)
				? { stocks: liveFragment.stocks }
				: null;
		const fromBase = src.base?.[section];
		const fromFragment = src.fragments[section];
		const newBase = isObject(fromBase)
			? { ...sectionOwn(section, fromBase), ...keepBase }
			: keepBase;
		if (newBase && Object.keys(newBase).length > 0) {
			base[section] = newBase;
		} else if (fromBase !== undefined && !isObject(fromBase)) {
			base[section] = fromBase;
		} else {
			Reflect.deleteProperty(base, section);
		}
		writeFragment(
			section,
			fromFragment || keepFragment
				? { ...(fromFragment ? sectionOwn(section, fromFragment) : {}), ...keepFragment }
				: null,
		);
	}
	if (selected.has(configPart("stocks"))) {
		const labels = isObject(base.labels) ? { ...base.labels } : null;
		const fromLabels = src.base?.labels;
		if (labels) {
			Reflect.deleteProperty(labels, "stocks");
		}
		if (isObject(fromLabels) && "stocks" in fromLabels) {
			base.labels = { ...(labels ?? {}), stocks: fromLabels.stocks };
		} else if (labels) {
			base.labels = labels;
		}
		const liveFragment = fragmentOf("labels");
		const fromFragment = src.fragments.labels;
		if (liveFragment || (fromFragment && "stocks" in fromFragment)) {
			const doc = { ...(liveFragment ?? {}) };
			Reflect.deleteProperty(doc, "stocks");
			if (fromFragment && "stocks" in fromFragment) {
				doc.stocks = fromFragment.stocks;
			}
			writeFragment("labels", doc);
		}
	}
	if (JSON.stringify(base) !== baseBefore) {
		writeFileSync(join(out, BASE), json(base));
	}
}
