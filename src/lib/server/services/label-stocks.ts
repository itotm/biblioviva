// SPDX-License-Identifier: GPL-3.0-or-later
// Adhesive label stocks from the admin UI (PLAN.md step 11.6): the stocks with the file each comes
// from (`labels/stocks/<id>.json`, or the `labels.stocks` list of the section file) and the label
// jobs that print on it; a draft of the whole list saved as one configuration change — each stock
// in the file that holds it, new ones in a file of their own, removed ones taken out of every file,
// a changed id followed by the jobs and by the label templates of CONFIG_DIR that list it.
import { ServiceError } from "#lib/server/errors.js";
import { existsSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { STOCKS_DIR } from "#lib/server/config/folder.js";
import { loadConfig, readJsonFile } from "#lib/server/config/load.js";
import type { AppConfig, LabelStock } from "#lib/server/config/schema.js";
import type { DbOrTx } from "#lib/server/db/client.js";
import { discoverTemplates } from "#lib/server/templates/engine.js";
import type { AuditActor } from "./audit.js";
import {
	draftWrites,
	keyDrafts,
	sectionFile,
	type ConfigChange,
	type FileWrite,
} from "./config-edit.js";
import { saveConfigWrites } from "./config-sections.js";

type Json = Record<string, unknown>;
export type LabelJob = "pair" | "barcode" | "spine";
export const LABEL_JOBS: readonly LabelJob[] = ["pair", "barcode", "spine"];

export interface StockView {
	stock: LabelStock;
	/** The file that holds it, relative to CONFIG_DIR. */
	file: string;
	/** The label jobs that print on it. */
	usedBy: LabelJob[];
}

export interface StockDraft {
	/** The id the stock had when the editor opened; null for a new stock. */
	originalId: string | null;
	stock: LabelStock;
}

export class StockDraftError extends ServiceError {
	constructor(
		override readonly code: "duplicate" | "inUse",
		readonly details: string[],
	) {
		super(code, `label stocks: ${code} (${details.join(", ")})`);
		this.name = "StockDraftError";
	}
}

const STOCKS = "labels/stocks";
const stockFile = (id: string): string => `${STOCKS}/${id}.json`;
const json = (value: unknown): string => `${JSON.stringify(value, null, "\t")}\n`;

/** Stock id → file of `labels/stocks/` (the id written in the file wins over its name). */
function stockFiles(configDir: string): Map<string, string> {
	const dir = join(configDir, STOCKS_DIR);
	const out = new Map<string, string>();
	if (!existsSync(dir)) {
		return out;
	}
	for (const f of readdirSync(dir).sort()) {
		if (!/^[\w-]+\.json$/.test(f)) {
			continue;
		}
		const doc = readJsonFile(join(dir, f));
		const id = typeof doc.id === "string" ? doc.id : f.slice(0, -".json".length);
		out.set(id, `${STOCKS}/${f}`);
	}
	return out;
}

/** The `stocks` list written in the labels section file, with that file. */
function inlineStocks(configDir: string): { file: string; list: Json[] | null } {
	const file = sectionFile(configDir, "labels");
	const path = join(configDir, file);
	if (!existsSync(path)) {
		return { file, list: null };
	}
	const doc = readJsonFile(path);
	const section = (file === "config.json" ? doc.labels : doc) as Json | undefined;
	const list = section?.stocks;
	return { file, list: Array.isArray(list) ? (list as Json[]) : null };
}

export function stockEditorView(config: AppConfig, configDir: string): StockView[] {
	const files = stockFiles(configDir);
	const inline = inlineStocks(configDir);
	return config.labels.stocks.map((stock) => ({
		stock,
		file: files.get(stock.id) ?? inline.file,
		usedBy: LABEL_JOBS.filter((k) => config.labels[k].stock === stock.id),
	}));
}

/** A stock as a file writes it, keys in the documented order. */
function stockJson(s: LabelStock): Json {
	return {
		id: s.id,
		name: s.name,
		paper: s.paper,
		labelMm: { width: s.labelMm.width, height: s.labelMm.height },
		columns: s.columns,
		rows: s.rows,
		marginMm: { top: s.marginMm.top, left: s.marginMm.left },
		gapMm: { x: s.gapMm.x, y: s.gapMm.y },
		cornerRadiusMm: s.cornerRadiusMm,
	};
}

/** The writes that store the draft list (see the header), without saving anything. */
export function stockWrites(configDir: string, drafts: readonly StockDraft[]): FileWrite[] {
	const ids = drafts.map((d) => d.stock.id);
	const duplicates = ids.filter((id, i) => ids.indexOf(id) !== i);
	if (duplicates.length > 0) {
		throw new StockDraftError("duplicate", [...new Set(duplicates)]);
	}
	const loaded = loadConfig(configDir);
	const byOriginal = new Map(
		drafts.flatMap((d) => (d.originalId === null ? [] : [[d.originalId, d] as const])),
	);
	const renamed = new Map(
		drafts.flatMap((d) =>
			d.originalId !== null && d.originalId !== d.stock.id
				? [[d.originalId, d.stock.id] as const]
				: [],
		),
	);
	const files = stockFiles(configDir);
	const writes: FileWrite[] = [];
	const written = new Set<string>();

	// the stocks in a file of their own: rewritten, moved to the new id's file, or removed
	for (const [id, file] of files) {
		const draft = byOriginal.get(id);
		if (!draft) {
			writes.push({ path: file, content: null });
			continue;
		}
		const path = draft.stock.id === id ? file : stockFile(draft.stock.id);
		if (path !== file) {
			writes.push({ path: file, content: null });
		}
		const current = readJsonFile(join(configDir, file));
		const next = { ...stockJson(draft.stock), ...pickComments(current) };
		if (path !== file || canonical(next) !== canonical(current)) {
			writes.push({ path, content: json(next) });
		}
		written.add(draft.stock.id);
	}

	// the list of the section file: those only there are edited in place; a copy shadowed by a
	// file goes when its stock is removed or renamed
	const inline = inlineStocks(configDir);
	const patch: Record<string, unknown> = {};
	if (inline.list) {
		const list = inline.list.flatMap((s): Json[] => {
			const id = String(s.id);
			const draft = byOriginal.get(id);
			if (!draft) {
				return [];
			}
			if (files.has(id)) {
				return draft.stock.id === id ? [s] : [];
			}
			written.add(draft.stock.id);
			return [{ ...pickComments(s), ...stockJson(draft.stock) }];
		});
		if (JSON.stringify(list) !== JSON.stringify(inline.list)) {
			patch["labels.stocks"] = list;
		}
	}

	// new stocks: a file each
	for (const d of drafts) {
		if (!written.has(d.stock.id)) {
			writes.push({ path: stockFile(d.stock.id), content: json(stockJson(d.stock)) });
		}
	}

	// the jobs follow a changed id
	for (const k of LABEL_JOBS) {
		const next = renamed.get(loaded.config.labels[k].stock);
		if (next) {
			patch[`labels.${k}.stock`] = next;
		}
	}
	if (Object.keys(patch).length > 0) {
		writes.push(...draftWrites(keyDrafts(configDir, loaded, patch)));
	}

	// the label templates of CONFIG_DIR that list a changed id
	if (renamed.size > 0) {
		for (const t of discoverTemplates("labels", configDir)) {
			if (t.source !== "config") {
				continue;
			}
			const path = `labels/templates/${t.name}/template.json`;
			const meta = readJsonFile(join(configDir, path));
			const listed: unknown[] = Array.isArray(meta.stocks) ? meta.stocks : [];
			if (listed.some((s) => renamed.has(String(s)))) {
				meta.stocks = listed.map((s) => renamed.get(String(s)) ?? s);
				writes.push({ path, content: json(meta) });
			}
		}
	}
	return writes;
}

/** JSON with sorted keys, to compare documents whatever the order of their keys. */
function canonical(value: unknown): string {
	if (Array.isArray(value)) {
		return `[${value.map(canonical).join(",")}]`;
	}
	if (typeof value === "object" && value !== null) {
		return `{${Object.keys(value)
			.sort()
			.map((k) => `${JSON.stringify(k)}:${canonical((value as Json)[k])}`)
			.join(",")}}`;
	}
	return JSON.stringify(value);
}

/** The `_comment` keys of a stock, kept when it is rewritten. */
function pickComments(doc: Json): Json {
	return Object.fromEntries(Object.entries(doc).filter(([k]) => k.startsWith("_")));
}

export function saveStocks(
	db: DbOrTx,
	configDir: string,
	drafts: readonly StockDraft[],
	actor: AuditActor,
	now = new Date(),
): ConfigChange {
	const config = loadConfig(configDir).config;
	const kept = new Set(drafts.map((d) => d.originalId));
	const lost = LABEL_JOBS.filter((k) => !kept.has(config.labels[k].stock));
	if (lost.length > 0) {
		throw new StockDraftError(
			"inUse",
			lost.map((k) => `labels.${k}.stock`),
		);
	}
	return saveConfigWrites(
		db,
		configDir,
		"labels",
		stockWrites(configDir, drafts),
		actor,
		{
			stocks: drafts.map((d) => d.stock.id),
			renamed: Object.fromEntries(
				drafts
					.filter((d) => d.originalId !== null && d.originalId !== d.stock.id)
					.map((d) => [d.originalId, d.stock.id]),
			),
		},
		now,
	);
}
