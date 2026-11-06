// SPDX-License-Identifier: GPL-3.0-or-later
// docs/database.md in step with the schema (step 9.53): every table of `schema.ts` is drawn in the
// diagrams with its columns, and the diagrams name no table that does not exist.
import { readFileSync } from "node:fs";
import { getTableConfig, SQLiteTable } from "drizzle-orm/sqlite-core";
import { describe, expect, it } from "vitest";
import * as schema from "./schema.js";
import { mermaidBlocks } from "../../../../scripts/diagrams.ts";

const tables = Object.values(schema as Record<string, unknown>)
	.filter((t) => t instanceof SQLiteTable)
	.map((t) => getTableConfig(t as SQLiteTable));

/** The entities of the erDiagram blocks with the columns drawn for them (all blocks together). */
function drawn(): Map<string, Set<string>> {
	const out = new Map<string, Set<string>>();
	const doc = readFileSync("docs/database.md", "utf8");
	for (const code of mermaidBlocks(doc).filter((c) => c.startsWith("erDiagram"))) {
		for (const m of code.matchAll(/^\s*([\w]+)\s*\{\n([\s\S]*?)^\s*\}/gm)) {
			const columns = out.get(m[1] ?? "") ?? new Set<string>();
			for (const line of (m[2] ?? "").split("\n")) {
				const column = /^\s*\w+\s+(\w+)/.exec(line)?.[1];
				if (column) {
					columns.add(column);
				}
			}
			out.set(m[1] ?? "", columns);
		}
	}
	return out;
}

describe("docs/database.md", () => {
	it("draws every table of the schema with all its columns", () => {
		const entities = drawn();
		for (const table of tables) {
			const columns = entities.get(table.name);
			expect(columns, `table ${table.name} is missing from the diagrams`).toBeDefined();
			for (const c of table.columns) {
				expect(columns?.has(c.name), `${table.name}.${c.name} is missing`).toBe(true);
			}
		}
	});

	it("draws no table and no column the schema does not have", () => {
		const known = new Map(tables.map((t) => [t.name, new Set(t.columns.map((c) => c.name))]));
		for (const [entity, columns] of drawn()) {
			// the full-text index is a virtual table of the migration, outside the Drizzle schema
			if (entity.endsWith("_fts")) {
				continue;
			}
			expect(known.has(entity), `${entity} is not a table`).toBe(true);
			for (const c of columns) {
				expect(known.get(entity)?.has(c), `${entity}.${c} is not a column`).toBe(true);
			}
		}
	});
});
