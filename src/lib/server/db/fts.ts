// SPDX-License-Identifier: GPL-3.0-or-later
// FTS5 index over biblio (PLAN.md §4.1). Drizzle cannot model virtual tables, so this is a
// hand-written, idempotent migration applied after the Drizzle ones.
import type { Database } from "bun:sqlite";
import { integer, sqliteTable, text } from "drizzle-orm/sqlite-core";
import { sql, type SQL } from "drizzle-orm";
import { foldForSearch, normalizeSearchText } from "#lib/shared/text.js";

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
/** The SQL function the triggers fold every indexed column with (`foldForSearch`). */
export const FOLD_FUNCTION = "bv_fold";
const folded = (prefix: string): string =>
	FTS_COLUMNS.map((c) => `${FOLD_FUNCTION}(${prefix}.${c})`).join(", ");
const newCols = folded("new");
const oldCols = folded("old");

/**
 * Registers the fold on a connection. The triggers of the index call it, so every connection that
 * writes to `biblio` registers it first (`openDatabase`, the copies pruned before an export): a
 * tool without it, such as the `sqlite3` shell, is refused with "no such function" instead of
 * indexing the text unfolded.
 */
export function registerSearchFunctions(sqlite: Database): void {
	sqlite.function(FOLD_FUNCTION, { deterministic: true }, (value) =>
		value === null || value === undefined ? null : foldForSearch(String(value)),
	);
}

/**
 * The index holds the folded text (`foldForSearch`: marks, tatweel and letter variants of Arabic and
 * Hebrew gone, Latin accents gone) and the query is folded the same way (`ftsMatch`), so a plain
 * word finds its vocalised form and the other way round. The table is external content: the text
 * lives in `biblio`, only the index is folded.
 */
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

const FTS_OBJECTS = ["biblio_fts", "biblio_fts_ai", "biblio_fts_ad", "biblio_fts_au"];
const squeeze = (statement: string): string => statement.replace(/\s+/g, " ").trim();

/**
 * Creates the index and its triggers. An index whose definition differs from the statements above
 * (other columns, another tokenizer, another fold: the text SQLite keeps of the table and of each
 * trigger is compared) is dropped, made again and filled.
 */
export function applyFtsMigration(sqlite: Database): void {
	registerSearchFunctions(sqlite);
	const existing = new Map(
		sqlite
			.query<{ name: string; sql: string }, []>(
				`SELECT name, sql FROM sqlite_master WHERE name IN (${FTS_OBJECTS.map((n) => `'${n}'`).join(", ")})`,
			)
			.all()
			.map((r) => [r.name, squeeze(r.sql)]),
	);
	const stale =
		existing.size > 0 &&
		FTS_STATEMENTS.some(
			(statement, i) =>
				existing.get(FTS_OBJECTS[i] ?? "") !==
				squeeze(statement.replace(" IF NOT EXISTS", "")),
		);
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

/**
 * Rebuilds the index from the content table (after imports or repairs): the folded text of every
 * record, as the triggers write it (FTS5's own `rebuild` would index the text as it is stored).
 */
export function rebuildFts(sqlite: Database): void {
	registerSearchFunctions(sqlite);
	sqlite.run("INSERT INTO biblio_fts(biblio_fts) VALUES ('delete-all')");
	sqlite.run(`INSERT INTO biblio_fts(rowid, ${cols}) SELECT id, ${folded("biblio")} FROM biblio`);
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
 * all required, folded as the index is (`foldForSearch`) and punctuation dropped ("Città" =
 * "citta", "dell'arte" = "dell arte", "أحمد" = "احمد", "שָׁלוֹם" = "שלום");
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
