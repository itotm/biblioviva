// SPDX-License-Identifier: GPL-3.0-or-later
import { describe, expect, it } from "vitest";
import { createTestDb } from "../../../../tests/helpers/db.js";
import { importBatch } from "#lib/server/db/schema.js";
import type { ImportSpec } from "#lib/shared/import-columns.js";
import {
	canCommit,
	countRows,
	createdIdsOfBatch,
	detectFormat,
	importBatches,
	mappingComplete,
	mapRows,
} from "./pipeline.js";

type ShelfField = "code" | "room" | "notes";
const SHELF_IMPORT: ImportSpec<ShelfField> = {
	columns: [
		{ field: "code", header: "code", group: "required" },
		{ field: "room", header: "room", group: "required" },
		{ field: "notes", header: "notes", group: "optional" },
	],
};

describe("import pipeline", () => {
	it("maps the cells of every row onto the fields, keeping the file lines", () => {
		const rows = [["Titolo", "Autore"], [" Il barone ", "Calvino"], ["Marcovaldo"]];
		expect(mapRows(rows, ["title", null], true, ["title", "author"], [1, 3, 4])).toEqual([
			{ line: 3, title: "Il barone", author: "" },
			{ line: 4, title: "Marcovaldo", author: "" },
		]);
		expect(mapRows(rows.slice(1), [null, "author"], false, ["author"])).toEqual([
			{ line: 1, author: "Calvino" },
			{ line: 2, author: "" },
		]);
	});

	it("counts the rows by status and allows the commit only without errors", () => {
		const counts = countRows([{ status: "new" }, { status: "unchanged" }]);
		expect(counts).toEqual({ new: 1, update: 0, unchanged: 1, error: 0, total: 2 });
		expect(canCommit(counts)).toBe(true);
		expect(canCommit(countRows([{ status: "new" }, { status: "error" }]))).toBe(false);
		expect(canCommit(countRows([]))).toBe(false);
	});

	it("detects a header by its names, certain only with every required column", () => {
		expect(
			detectFormat(SHELF_IMPORT, [
				["Room", "CODE", "x"],
				["A", "1", ""],
			]),
		).toEqual({
			header: true,
			mapping: ["room", "code", null],
			certain: true,
			columns: 3,
		});
		expect(detectFormat(SHELF_IMPORT, [["code", "notes"]])).toEqual({
			header: true,
			mapping: ["code", "notes"],
			certain: false,
			columns: 2,
		});
		expect(mappingComplete(SHELF_IMPORT, ["code", "room"])).toBe(true);
		expect(mappingComplete(SHELF_IMPORT, ["code", null, "notes"])).toBe(false);
	});

	it("maps a file without a header by its fallback, or ignores every column", () => {
		const rows = [
			["A1", "Aula 3"],
			["A2", "Aula 3", "alto"],
		];
		expect(detectFormat(SHELF_IMPORT, rows)).toEqual({
			header: false,
			mapping: [null, null, null],
			certain: false,
			columns: 3,
		});
		const positional = (columns: number): ShelfField[] | null =>
			columns === 3 ? ["code", "room", "notes"] : null;
		expect(detectFormat(SHELF_IMPORT, rows, positional)).toMatchObject({
			header: false,
			mapping: ["code", "room", "notes"],
			certain: false,
		});
		expect(detectFormat(SHELF_IMPORT, [["A1"]], positional).mapping).toEqual([null]);
		expect(detectFormat(SHELF_IMPORT, [])).toEqual({
			header: false,
			mapping: [],
			certain: false,
			columns: 0,
		});
	});

	it("reads what a batch created and lists the last 20 batches of a kind, newest first", () => {
		const db = createTestDb();
		const add = (
			kind: "patrons" | "catalog",
			filename: string,
			summary?: Record<string, unknown>,
		): number =>
			db
				.insert(importBatch)
				.values({ kind, filename, summary })
				.returning({ id: importBatch.id })
				.get().id;
		const patrons = add("patrons", "a.csv", { created: 2, createdIds: [4, 5] });
		const books = add("catalog", "b.csv", { createdItemIds: [7] });
		const open = add("patrons", "open.csv");
		expect(createdIdsOfBatch(db, patrons, "createdIds")).toEqual([4, 5]);
		expect(createdIdsOfBatch(db, books, "createdItemIds")).toEqual([7]);
		expect(createdIdsOfBatch(db, books, "createdIds")).toEqual([]);
		expect(createdIdsOfBatch(db, open, "createdIds")).toEqual([]);
		expect(createdIdsOfBatch(db, 999, "createdIds")).toEqual([]);

		const created = (summary: Record<string, unknown>): number => Number(summary.created ?? 0);
		expect(importBatches(db, "patrons", created)).toEqual([
			{ id: open, filename: "open.csv", finishedAt: null, created: 0 },
			{ id: patrons, filename: "a.csv", finishedAt: null, created: 2 },
		]);
		expect(importBatches(db, "loans", created)).toEqual([]);
		for (let i = 0; i < 25; i++) {
			add("catalog", `c${String(i)}.csv`, { createdItemIds: [] });
		}
		const listed = importBatches(db, "catalog", () => 1);
		expect(listed).toHaveLength(20);
		expect(listed[0]?.filename).toBe("c24.csv");
		expect(listed.every((b) => b.created === 1)).toBe(true);
	});
});
