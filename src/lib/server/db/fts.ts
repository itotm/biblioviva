// SPDX-License-Identifier: GPL-3.0-or-later
// FTS5 index over biblio (PLAN.md §4.1). Drizzle cannot model virtual tables, so this is a
// hand-written, idempotent migration applied after the Drizzle ones.
import type { Database } from "bun:sqlite";
import { integer, sqliteTable, text } from "drizzle-orm/sqlite-core";
import { sql, type SQL } from "drizzle-orm";
import { normalizeSearchText } from "#lib/shared/text.js";

export const FTS_COLUMNS = [
	"title",
	"original_title",
	"subtitle",
	"author",
	"responsibility",
	"publisher",
	"subjects",
	"isbn",
	"series",
] as const;

const cols = FTS_COLUMNS.join(", ");
const newCols = FTS_COLUMNS.map((c) => `new.${c}`).join(", ");
const oldCols = FTS_COLUMNS.map((c) => `old.${c}`).join(", ");

export const FTS_STATEMENTS = [
	`CREATE VIRTUAL TABLE IF NOT EXISTS biblio_fts USING fts5(${cols}, content='biblio', content_rowid='id', tokenize='unicode61 remove_diacritics 2')`,
	`CREATE TRIGGER IF NOT EXISTS biblio_fts_ai AFTER INSERT ON biblio BEGIN
		INSERT INTO biblio_fts(rowid, ${cols}) VALUES (new.id, ${newCols});
	END`,
	`CREATE TRIGGER IF NOT EXISTS biblio_fts_ad AFTER DELETE ON biblio BEGIN
		INSERT INTO biblio_fts(biblio_fts, rowid, ${cols}) VALUES ('delete', old.id, ${oldCols});
	END`,
	`CREATE TRIGGER IF NOT EXISTS biblio_fts_au AFTER UPDATE ON biblio BEGIN
		INSERT INTO biblio_fts(biblio_fts, rowid, ${cols}) VALUES ('delete', old.id, ${oldCols});
		INSERT INTO biblio_fts(rowid, ${cols}) VALUES (new.id, ${newCols});
	END`,
];

/** Throws a readable error when the linked SQLite has no FTS5 (the catalog search needs it). */
export function assertFts5(sqlite: Database): void {
	try {
		sqlite.run("CREATE VIRTUAL TABLE IF NOT EXISTS __fts5_probe USING fts5(x)");
		sqlite.run("DROP TABLE IF EXISTS __fts5_probe");
	} catch (e) {
		throw new Error(`SQLite FTS5 extension is not available: ${(e as Error).message}`, {
			cause: e,
		});
	}
}

/**
 * Creates the index and its triggers; an index built with other columns (a database made before
 * a column was added, such as the original title of step 9.23) is dropped, made again and filled.
 */
export function applyFtsMigration(sqlite: Database): void {
	const existing = sqlite
		.query<{ name: string }, []>("SELECT name FROM pragma_table_info('biblio_fts')")
		.all()
		.map((c) => c.name);
	const stale = existing.length > 0 && existing.join(",") !== FTS_COLUMNS.join(",");
	if (stale) {
		for (const trigger of ["biblio_fts_ai", "biblio_fts_ad", "biblio_fts_au"]) {
			sqlite.run(`DROP TRIGGER IF EXISTS ${trigger}`);
		}
		sqlite.run("DROP TABLE biblio_fts");
	}
	for (const statement of FTS_STATEMENTS) {
		sqlite.run(statement);
	}
	if (stale) {
		rebuildFts(sqlite);
	}
}

/** Rebuilds the index from the content table (after imports or repairs). */
export function rebuildFts(sqlite: Database): void {
	sqlite.run("INSERT INTO biblio_fts(biblio_fts) VALUES ('rebuild')");
}

/** The columns where a search forgives typing mistakes (step 9.24): titles and authors. */
export const SIMILAR_COLUMNS = ["title", "original_title", "author"] as const;

const vocabularies = new WeakMap<Database, { key: string; words: string[] }>();

/**
 * The words of `SIMILAR_COLUMNS` in the index (step 9.24), read through a `fts5vocab` table of the
 * connection's temporary schema (never part of the database file) and kept until the catalogue
 * changes (count, last id or last update of the records).
 */
export function searchVocabulary(sqlite: Database): string[] {
	const key = sqlite
		.query<{ k: string }, []>(
			"SELECT count(*) || ':' || ifnull(max(id), 0) || ':' || ifnull(max(updated_at), '') AS k FROM biblio",
		)
		.get()?.k;
	const cached = vocabularies.get(sqlite);
	if (cached && cached.key === key) {
		return cached.words;
	}
	sqlite.run(
		"CREATE VIRTUAL TABLE IF NOT EXISTS temp.biblio_fts_words USING fts5vocab(main, biblio_fts, col)",
	);
	const columns = SIMILAR_COLUMNS.map((c) => `'${c}'`).join(", ");
	const words = sqlite
		.query<{ term: string }, []>(
			`SELECT DISTINCT term FROM temp.biblio_fts_words WHERE col IN (${columns})`,
		)
		.all()
		.map((r) => r.term);
	vocabularies.set(sqlite, { key: key ?? "", words });
	return words;
}

/**
 * The FTS5 table as seen by queries (never by drizzle-kit: it is not exported from `schema.ts`,
 * so no migration is generated for it); `rowid` is the biblio id.
 */
export const biblioFts = sqliteTable("biblio_fts", {
	rowid: integer("rowid").notNull(),
	title: text("title"),
});

/**
 * The MATCH expression of a search box text (step 5.1): every word a prefix (`calv* cosmic*`),
 * all required, diacritics and punctuation dropped ("Città" = "citta", "dell'arte" = "dell arte");
 * null when nothing searchable is left.
 */
export function ftsMatch(text: string): string | null {
	const words = normalizeSearchText(text).split(" ").filter(Boolean).slice(0, 12);
	return words.length === 0 ? null : words.map((w) => `"${w}"*`).join(" ");
}

/**
 * bm25 with the title, the original title and the author weighing most, then the series, subtitle,
 * subjects and the rest (one weight per column of `FTS_COLUMNS`).
 */
export const ftsRank: SQL<number> = sql<number>`bm25(biblio_fts, 10.0, 10.0, 4.0, 8.0, 2.0, 1.0, 3.0, 1.0, 6.0)`;
