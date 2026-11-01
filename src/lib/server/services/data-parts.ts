// SPDX-License-Identifier: GPL-3.0-or-later
// The library's data cut into parts (PLAN.md step 11.12): which tables and rows belong to the
// patrons, the catalogue, the loans, the print lists, the staff notes and the audit log. A database copy for an
// archive keeps only the parts chosen (`pruneSnapshot`: the others emptied, sessions and the
// metadata cache always dropped); a restore replaces only the chosen parts of the live database
// with those of a copy (`restoreDataParts`), in one transaction whose references are checked
// before it commits: loans without their patrons or copies are refused with what to add. Photos
// and covers are files (DATA_DIR/uploads/patrons, /covers), restored by the archive services; the
// class pictures of the census (Phase 13) are files too (uploads/class-sheets) with their rows in the
// photos part. The classes (Phase 12) travel with the patrons. Every table of the database is in a
// part or in `TABLES_THAT_NEVER_TRAVEL`, which a test checks.
import { Database } from "bun:sqlite";
import type { Db } from "#lib/server/db/client.js";
import { DATA_PARTS, type DataPart } from "#lib/shared/archive-parts.js";

/** The rows of a part: whole tables, or the rows of shared tables matching a condition. */
interface PartRows {
	/** Children first (the order rows are deleted in; inserted in the reverse order). */
	tables: string[];
	/** The table whose rows the restore counts, when not the last one. */
	counted?: string;
	/** Rows of shared tables: `[table, where]`. */
	rows: [string, string][];
}

const PART_ROWS: Record<Exclude<DataPart, "covers">, PartRows> = {
	// the class pictures and their frames (Phase 13): they point at patrons, classes and lists
	photos: { tables: ["class_photo_frame", "class_photo_sheet"], rows: [] },
	printLists: { tables: ["print_list_entry", "print_list"], rows: [] },
	loans: { tables: ["loan_event", "loan"], rows: [["import_batch", "kind = 'loans'"]] },
	catalog: {
		// the stocktaking campaigns (9.8) belong to the copies they counted, the wishlist (9.15) to
		// the books the library has and wants
		tables: ["wish", "inventory_scan", "inventory", "item", "biblio"],
		rows: [
			["import_batch", "kind = 'catalog'"],
			["sequence", "name LIKE 'item\\_%' ESCAPE '\\'"],
		],
	},
	// the classes (Phase 12) the patrons are in: archived ones included, the teachers groups too
	patrons: {
		tables: ["patron", "class_group_level", "class_group"],
		counted: "patron",
		rows: [
			["import_batch", "kind = 'patrons'"],
			["sequence", "name = 'patron_card'"],
		],
	},
	// the staff notes (9.18) point at staff accounts only
	notes: { tables: ["note"], rows: [] },
	// the notable dates of the calendar (9.25) point at staff accounts only
	dates: { tables: ["calendar_event"], rows: [] },
	audit: { tables: ["audit_log"], rows: [] },
};

/**
 * The tables no part carries: the sessions and the metadata cache (dropped from every copy), the
 * staff accounts (from `config.json`; those a copy names are added as inactive), the mirrors of the
 * configuration (rebuilt at startup and on every reload), the full-text index of the catalogue (kept
 * by triggers), and SQLite's and Drizzle's own bookkeeping.
 */
export const TABLES_THAT_NEVER_TRAVEL: readonly string[] = [
	"session",
	"metadata_cache",
	"staff_user",
	"school_level",
	"school_setting",
	"reading_level",
	"biblio_fts",
	"biblio_fts_config",
	"biblio_fts_data",
	"biblio_fts_docsize",
	"biblio_fts_idx",
	"sqlite_sequence",
	"__drizzle_migrations",
];

/** Every table a part carries, whole or some of its rows. */
export function tablesOfParts(): string[] {
	return [
		...new Set(
			Object.values(PART_ROWS).flatMap((p) => [...p.tables, ...p.rows.map((r) => r[0])]),
		),
	];
}

/** Delete order across parts: what points at others goes first. */
const ORDER: (keyof typeof PART_ROWS)[] = [
	"photos",
	"printLists",
	"loans",
	"catalog",
	"patrons",
	"notes",
	"dates",
	"audit",
];

/** Columns that name the staff account that did something (nullable). */
const STAFF_COLUMNS: [string, string][] = [
	["biblio", "created_by"],
	["biblio", "updated_by"],
	["loan", "issued_by"],
	["loan", "returned_by"],
	["loan_event", "by_user_id"],
	["audit_log", "user_id"],
	["import_batch", "by_user_id"],
	["print_list", "created_by"],
	["inventory", "started_by"],
	["inventory", "closed_by"],
	["inventory_scan", "scanned_by"],
	["wish", "created_by"],
	["note", "created_by"],
	["note", "archived_by"],
	["calendar_event", "created_by"],
	["calendar_event", "updated_by"],
];

const TABLE_PART: Record<string, DataPart> = {
	patron: "patrons",
	class_group: "patrons",
	class_group_level: "patrons",
	biblio: "catalog",
	item: "catalog",
	loan: "loans",
	loan_event: "loans",
	print_list: "printLists",
	print_list_entry: "printLists",
	audit_log: "audit",
	inventory: "catalog",
	inventory_scan: "catalog",
	wish: "catalog",
	note: "notes",
	calendar_event: "dates",
	class_photo_sheet: "photos",
	class_photo_frame: "photos",
};

const isDbPart = (p: DataPart): p is keyof typeof PART_ROWS => p in PART_ROWS;

/**
 * Keeps in a database copy only the chosen parts: the others emptied, the sessions and the metadata
 * cache always dropped (they never travel), then compacted.
 */
export function pruneSnapshot(path: string, parts: readonly DataPart[]): void {
	const db = new Database(path);
	try {
		db.run("PRAGMA foreign_keys = OFF");
		db.run("DELETE FROM session");
		db.run("DELETE FROM metadata_cache");
		for (const part of ORDER) {
			if (parts.includes(part)) {
				continue;
			}
			const { tables, rows } = PART_ROWS[part];
			for (const t of tables) {
				db.run(`DELETE FROM ${t}`);
			}
			for (const [t, where] of rows) {
				db.run(`DELETE FROM ${t} WHERE ${where}`);
			}
		}
		db.run("VACUUM");
	} finally {
		db.close();
	}
}

export interface ReferenceGap {
	/** The part whose rows point at missing ones. */
	part: DataPart;
	/** The part they need. */
	needs: DataPart;
	rows: number;
}

export class DataRestoreError extends Error {
	constructor(
		readonly code: "schema" | "references",
		readonly gaps: ReferenceGap[] = [],
		readonly tables: string[] = [],
	) {
		super(
			code === "schema"
				? `the archive's database has another structure (${tables.join(", ")})`
				: `the restore would leave rows without what they point at (${gaps
						.map((g) => `${g.part} → ${g.needs}: ${g.rows}`)
						.join(", ")})`,
		);
		this.name = "DataRestoreError";
	}
}

function columns(db: Database, schema: string, table: string): string[] {
	return (db.query(`PRAGMA ${schema}.table_info(${table})`).all() as { name: string }[]).map(
		(c) => c.name,
	);
}

/** What the chosen parts' rows of a copy would change, before anything is written. */
export interface DataRestorePlan {
	counts: Partial<Record<DataPart, { live: number; archive: number }>>;
}

const count = (db: Database, schema: string, table: string, where = "1"): number =>
	(db.query(`SELECT COUNT(*) AS n FROM ${schema}.${table} WHERE ${where}`).get() as { n: number })
		.n;

function partCount(db: Database, schema: string, part: keyof typeof PART_ROWS): number {
	const main = PART_ROWS[part].counted ?? PART_ROWS[part].tables.at(-1);
	return main ? count(db, schema, main) : 0;
}

/**
 * Replaces the chosen parts of the live database with those of a database copy, in one
 * transaction: the rows of those parts deleted, the copy's inserted, staff accounts the copy names
 * and the live database lacks added as inactive (or their references cleared when the name is
 * taken), then every reference checked — anything left pointing at a missing patron, copy or loan
 * rolls everything back with what the selection lacks. `dryRun` checks and rolls back.
 */
export function restoreDataParts(
	db: Db,
	archivePath: string,
	parts: readonly DataPart[],
	options: { dryRun?: boolean } = {},
): DataRestorePlan {
	const chosen = ORDER.filter((p) => parts.includes(p));
	const sqlite = db.$client;
	sqlite.run("ATTACH DATABASE ? AS archive", [archivePath]);
	try {
		// the same structure for every table taken
		const tables = [
			...new Set(
				chosen.flatMap((p) => [
					...PART_ROWS[p].tables,
					...PART_ROWS[p].rows.map((r) => r[0]),
				]),
			),
		];
		const different = tables.filter(
			(t) => columns(sqlite, "main", t).join(",") !== columns(sqlite, "archive", t).join(","),
		);
		if (different.length > 0) {
			throw new DataRestoreError("schema", [], different);
		}
		const plan: DataRestorePlan = {
			counts: Object.fromEntries(
				chosen.map((p) => [
					p,
					{
						live: partCount(sqlite, "main", p),
						archive: partCount(sqlite, "archive", p),
					},
				]),
			),
		};
		const rollback = new Error("dry run");
		try {
			sqlite.transaction(() => {
				sqlite.run("PRAGMA defer_foreign_keys = ON");
				for (const part of chosen) {
					const { tables: ts, rows } = PART_ROWS[part];
					for (const t of ts) {
						sqlite.run(`DELETE FROM main.${t}`);
					}
					for (const [t, where] of rows) {
						sqlite.run(`DELETE FROM main.${t} WHERE ${where}`);
					}
				}
				// the accounts the copy's rows name
				const staffCols = columns(sqlite, "main", "staff_user").join(", ");
				sqlite.run(
					`INSERT INTO main.staff_user (${staffCols})
					 SELECT ${columns(sqlite, "main", "staff_user")
							.map((c) => (c === "active" ? "0" : c))
							.join(", ")}
					 FROM archive.staff_user a
					 WHERE a.id NOT IN (SELECT id FROM main.staff_user)
					   AND a.username NOT IN (SELECT username FROM main.staff_user)`,
				);
				for (const part of [...chosen].reverse()) {
					const { tables: ts, rows } = PART_ROWS[part];
					for (const t of [...ts].reverse()) {
						const cols = columns(sqlite, "main", t).join(", ");
						sqlite.run(
							`INSERT INTO main.${t} (${cols}) SELECT ${cols} FROM archive.${t}`,
						);
					}
					for (const [t, where] of rows) {
						const cols = columns(sqlite, "main", t).join(", ");
						sqlite.run(
							`INSERT INTO main.${t} (${cols}) SELECT ${cols} FROM archive.${t} WHERE ${where}`,
						);
					}
				}
				for (const [t, c] of STAFF_COLUMNS) {
					if (tables.includes(t)) {
						sqlite.run(
							`UPDATE main.${t} SET ${c} = NULL WHERE ${c} IS NOT NULL AND ${c} NOT IN (SELECT id FROM main.staff_user)`,
						);
					}
				}
				const gaps = referenceGaps(sqlite);
				if (gaps.length > 0) {
					throw new DataRestoreError("references", gaps);
				}
				if (options.dryRun) {
					throw rollback;
				}
			})();
		} catch (e) {
			if (e !== rollback) {
				throw e;
			}
		}
		return plan;
	} finally {
		sqlite.run("DETACH DATABASE archive");
	}
}

/** Rows pointing at missing ones, by part: foreign keys and the entries of the print lists. */
function referenceGaps(sqlite: Database): ReferenceGap[] {
	const found = new Map<string, ReferenceGap>();
	const add = (part: DataPart | undefined, needs: DataPart | undefined, rows: number): void => {
		if (!part || !needs || rows === 0) {
			return;
		}
		const key = `${part}>${needs}`;
		const gap = found.get(key) ?? { part, needs, rows: 0 };
		gap.rows += rows;
		found.set(key, gap);
	};
	const violations = sqlite.query("PRAGMA main.foreign_key_check").all() as {
		table: string;
		parent: string;
	}[];
	for (const v of violations) {
		add(TABLE_PART[v.table], TABLE_PART[v.parent], 1);
	}
	add(
		"printLists",
		"patrons",
		count(
			sqlite,
			"main",
			"print_list_entry e",
			"(SELECT kind FROM main.print_list l WHERE l.id = e.list_id) = 'patrons' AND e.entity_id NOT IN (SELECT id FROM main.patron)",
		),
	);
	add(
		"printLists",
		"catalog",
		count(
			sqlite,
			"main",
			"print_list_entry e",
			"(SELECT kind FROM main.print_list l WHERE l.id = e.list_id) = 'items' AND e.entity_id NOT IN (SELECT id FROM main.item)",
		),
	);
	return [...found.values()];
}

/** The data parts of the database file, in their usual order. */
export const dbPartsOf = (parts: readonly DataPart[]): DataPart[] =>
	DATA_PARTS.filter((p) => parts.includes(p) && isDbPart(p));

/**
 * The folders of DATA_DIR/uploads and the data part each belongs to: the patron photos with the
 * class pictures of the census (Phase 13), the covers.
 */
export const UPLOAD_FOLDERS: Readonly<Record<string, DataPart>> = {
	patrons: "photos",
	"class-sheets": "photos",
	covers: "covers",
};

/** The upload folders of a data part (none for the parts of the database alone). */
export function uploadFoldersOf(part: DataPart): string[] {
	return Object.keys(UPLOAD_FOLDERS).filter((folder) => UPLOAD_FOLDERS[folder] === part);
}
