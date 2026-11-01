// SPDX-License-Identifier: GPL-3.0-or-later
import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { createTestDb } from "../../../../tests/helpers/db.js";
import { getConfig, resetConfigCache } from "#lib/server/config/index.js";
import { ConfigError } from "#lib/server/config/load.js";
import { staffUser } from "#lib/server/db/schema.js";
import { resetEnvCache } from "#lib/server/env.js";
import { setUiTheme } from "../../../../tests/helpers/config.js";
import { duplicateTemplate } from "./template-folders.js";
import {
	saveStocks,
	stockEditorView,
	StockDraftError,
	stockWrites,
	type StockDraft,
} from "./label-stocks.js";

let dir = "";
const previous = process.env.CONFIG_DIR;
beforeEach(() => {
	dir = mkdtempSync(join(tmpdir(), "bv-label-stocks-"));
	process.env.CONFIG_DIR = dir;
	resetEnvCache();
	resetConfigCache();
	setUiTheme(dir, "ocean"); // config.json lists the stocks, labels/stocks/ has a file each
});
afterEach(() => {
	process.env.CONFIG_DIR = previous;
	resetEnvCache();
	resetConfigCache();
	rmSync(dir, { recursive: true, force: true });
});

const actor = (): { db: ReturnType<typeof createTestDb>; actor: { id: number } } => {
	const db = createTestDb();
	return {
		db,
		actor: db
			.insert(staffUser)
			.values({ username: "admin", passwordHash: "x", roles: [] })
			.returning({ id: staffUser.id })
			.get(),
	};
};
const drafts = (): StockDraft[] =>
	getConfig().labels.stocks.map((s) => ({ originalId: s.id, stock: structuredClone(s) }));
const read = (f: string): Record<string, unknown> =>
	JSON.parse(readFileSync(join(dir, f), "utf8")) as Record<string, unknown>;

describe("label stocks", () => {
	it("shows each stock with its file and the jobs printing on it", () => {
		const view = stockEditorView(getConfig(), dir);
		const pair = view.find((s) => s.stock.id === getConfig().labels.pair.stock);
		expect(pair?.file).toBe(`labels/stocks/${pair?.stock.id}.json`);
		expect(pair?.usedBy).toContain("pair");
		// nothing changed: nothing written
		expect(stockWrites(dir, drafts())).toEqual([]);
	});

	it("edits, adds, renames (jobs and templates following) and removes stocks in one change", () => {
		const { db, actor: a } = actor();
		duplicateTemplate(db, dir, "labels", "pair-default", "coppia", a);
		const list = drafts();
		const pairId = getConfig().labels.pair.stock;
		const pair = list.find((d) => d.stock.id === pairId);
		if (!pair) {
			throw new Error("no pair stock");
		}
		pair.stock.id = "scuola-70x48";
		pair.stock.marginMm.top = 5;
		const unused = list.find(
			(d) =>
				!["pair", "barcode", "spine"].some(
					(k) => getConfig().labels[k as "pair"].stock === d.stock.id,
				),
		);
		const next = list.filter((d) => d !== unused);
		next.push({
			originalId: null,
			stock: { ...structuredClone(pair.stock), id: "nuovo", name: "Nuovo foglio" },
		});
		saveStocks(db, dir, next, a);
		const config = getConfig();
		expect(config.labels.pair.stock).toBe("scuola-70x48");
		expect(config.labels.stocks.find((s) => s.id === "scuola-70x48")?.marginMm.top).toBe(5);
		expect(config.labels.stocks.some((s) => s.id === pairId)).toBe(false);
		expect(config.labels.stocks.some((s) => s.id === unused?.stock.id)).toBe(false);
		expect(existsSync(join(dir, `labels/stocks/${pairId}.json`))).toBe(false);
		expect(read("labels/stocks/nuovo.json").name).toBe("Nuovo foglio");
		expect(read("labels/templates/coppia/template.json").stocks).toContain("scuola-70x48");
	});

	it("refuses duplicate ids, a stock in use removed, and a stock too big for the page", () => {
		const { db, actor: a } = actor();
		const list = drafts();
		const copy = list[0];
		if (!copy) {
			throw new Error("no stock");
		}
		expect(() =>
			saveStocks(db, dir, [...list, { originalId: null, stock: { ...copy.stock } }], a),
		).toThrow(StockDraftError);
		const pairId = getConfig().labels.pair.stock;
		expect(() =>
			saveStocks(
				db,
				dir,
				list.filter((d) => d.stock.id !== pairId),
				a,
			),
		).toThrow(StockDraftError);
		copy.stock.columns = 9;
		expect(() => saveStocks(db, dir, list, a)).toThrow(ConfigError);
		expect(getConfig().labels.stocks[0]?.columns).not.toBe(9);
	});

	it("keeps the comments of a stock file, arrays included, and reads a folder without stocks", () => {
		const file = join(dir, "labels/stocks/a4-70x48.json");
		const doc = read("labels/stocks/a4-70x48.json");
		writeFileSync(file, JSON.stringify({ _notes: ["foglio della scuola", "2026"], ...doc }));
		// same values, keys in another order and a comment: nothing to write
		expect(stockWrites(dir, drafts())).toEqual([]);

		const empty = mkdtempSync(join(tmpdir(), "bv-label-stocks-empty-"));
		try {
			const view = stockEditorView(getConfig(), empty);
			expect(view.length).toBeGreaterThan(0);
			expect(view.every((s) => s.file === "config.json")).toBe(true);
		} finally {
			rmSync(empty, { recursive: true, force: true });
		}
	});

	it("edits the stocks listed in config.json in place; a copy shadowed by a file follows it", () => {
		const { db, actor: a } = actor();
		const stocks = getConfig().labels.stocks;
		const used = getConfig().labels.pair.stock;
		const inlineOnly = stocks.filter((s) => s.id !== used);
		expect(inlineOnly.length).toBeGreaterThanOrEqual(2);
		const [edited, removed] = inlineOnly;
		// every stock listed in config.json; only the one in use also has its own file
		const raw = read("config.json") as { labels: Record<string, unknown> };
		raw.labels.stocks = stocks.map((s) =>
			s.id === edited?.id ? { _comment: "foglio della segreteria", ...s } : s,
		);
		writeFileSync(join(dir, "config.json"), JSON.stringify(raw, null, "\t"));
		for (const s of inlineOnly) {
			rmSync(join(dir, `labels/stocks/${s.id}.json`));
		}
		resetConfigCache();
		expect(stockEditorView(getConfig(), dir).find((v) => v.stock.id === edited?.id)?.file).toBe(
			"config.json",
		);

		const list = drafts().filter((d) => d.stock.id !== removed?.id);
		const draft = list.find((d) => d.stock.id === edited?.id);
		if (!draft) {
			throw new Error("no stock to edit");
		}
		draft.stock.marginMm.top = 7;
		saveStocks(db, dir, list, a);
		const inline = (read("config.json") as { labels: { stocks: Record<string, unknown>[] } })
			.labels.stocks;
		expect(inline.map((s) => s.id)).toEqual(
			stocks.filter((s) => s.id !== removed?.id).map((s) => s.id),
		);
		expect(inline.find((s) => s.id === edited?.id)).toMatchObject({
			_comment: "foglio della segreteria",
			marginMm: { top: 7 },
		});
		expect(existsSync(join(dir, `labels/stocks/${String(edited?.id)}.json`))).toBe(false);
		expect(getConfig().labels.stocks.some((s) => s.id === removed?.id)).toBe(false);

		// the stock in use renamed: its file moves and the shadowed copy in config.json goes
		const renamed = drafts();
		const pair = renamed.find((d) => d.stock.id === used);
		if (!pair) {
			throw new Error("no stock in use");
		}
		pair.stock.id = "scuola";
		saveStocks(db, dir, renamed, a);
		const after = (read("config.json") as { labels: { stocks: Record<string, unknown>[] } })
			.labels.stocks;
		expect(after.some((s) => s.id === used)).toBe(false);
		expect(existsSync(join(dir, "labels/stocks/scuola.json"))).toBe(true);
		expect(getConfig().labels.pair.stock).toBe("scuola");
	});
});
