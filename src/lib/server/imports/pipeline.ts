// SPDX-License-Identifier: GPL-3.0-or-later
// The three-phase import pipeline shared by every import (PLAN.md §3.22): validate the whole
// file into rows with a status and plain reasons, confirm (zero errors, questions answered),
// commit in one transaction. This module holds the shape, the detection of the format, the mapping
// of the cells, the counting, the `import_batch` shell of every commit and the reading of the
// batches; each import kind provides its own validation and the writes of its commit.
import { desc, eq } from "drizzle-orm";
import type { DbOrTx } from "#lib/server/db/client.js";
import { importBatch, type IMPORT_KINDS } from "#lib/server/db/schema.js";
import { audit, type AuditActor, type AuditDetails } from "#lib/server/services/audit.js";
import {
	headerMapping,
	isComplete,
	missingColumns,
	type ImportSpec,
} from "#lib/shared/import-columns.js";

export type RowStatus = "new" | "update" | "unchanged" | "error";

/** A reason shown to the operator: an i18n key under `<kind>.import.reasons` plus parameters. */
export interface RowReason {
	code: string;
	params?: Record<string, string | number>;
}

export interface ImportRow<T> {
	/** 1-based line in the file (header included), so the operator can find it. */
	line: number;
	status: RowStatus;
	data: T;
	reasons: RowReason[];
}

export interface ImportCounts {
	new: number;
	update: number;
	unchanged: number;
	error: number;
	total: number;
}

export function countRows(rows: readonly { status: RowStatus }[]): ImportCounts {
	const counts: ImportCounts = { new: 0, update: 0, unchanged: 0, error: 0, total: rows.length };
	for (const row of rows) {
		counts[row.status]++;
	}
	return counts;
}

/** "Importa" is enabled only with zero errors; there is no "skip errors" (§3.22). */
export function canCommit(counts: ImportCounts): boolean {
	return counts.error === 0 && counts.total > 0;
}

/**
 * A cell longer than the cap of its field (the cap of the form, `#lib/shared/text-limits.ts`):
 * one reason per column, with the column's header and the cap.
 */
export function tooLongReasons<F extends string>(
	input: Readonly<Partial<Record<F, string>>>,
	limits: Readonly<Partial<Record<F, number>>>,
	spec: ImportSpec<F>,
): RowReason[] {
	const reasons: RowReason[] = [];
	for (const column of spec.columns) {
		const max = limits[column.field];
		const value = input[column.field];
		if (max !== undefined && value !== undefined && value.length > max) {
			reasons.push({ code: "tooLong", params: { column: column.header, max } });
		}
	}
	return reasons;
}

/** The format detected in a file: header or not, the column mapping and the width of the file. */
export interface DetectedFormat<F extends string> {
	header: boolean;
	mapping: (F | null)[];
	/** False when the operator must look at the columns before validating. */
	certain: boolean;
	columns: number;
}

/** Whether a mapping has every column the import needs (the rest has defaults or keys). */
export function mappingComplete<F extends string>(
	spec: ImportSpec<F>,
	mapping: readonly (F | null)[],
): boolean {
	return isComplete(missingColumns(spec, mapping));
}

/**
 * Detects the format from the first rows: a header row has the English names of the import and
 * decides the mapping; without one, `fallback` maps the columns by their number (a documented
 * order), or every column is ignored until mapped. A file without a header is never certain.
 */
export function detectFormat<F extends string>(
	spec: ImportSpec<F>,
	rows: readonly string[][],
	fallback?: (columns: number) => (F | null)[] | null,
): DetectedFormat<F> {
	const columns = Math.max(0, ...rows.slice(0, 20).map((r) => r.length));
	const fromHeader = headerMapping(spec, rows[0] ?? []);
	if (fromHeader) {
		return {
			header: true,
			mapping: fromHeader,
			certain: mappingComplete(spec, fromHeader),
			columns,
		};
	}
	return {
		header: false,
		mapping: fallback?.(columns) ?? Array.from({ length: columns }, () => null),
		certain: false,
		columns,
	};
}

/** One row of the file per input: the cells of the mapped columns (empty when unmapped) and its line. */
export type MappedRow<F extends string> = { line: number } & Record<F, string>;

/**
 * Applies a column mapping (one field or null per column) to the rows of a file; `lines` are the
 * file lines of the rows (from the parser, header included), so blank lines do not shift them.
 */
export function mapRows<F extends string>(
	rows: readonly string[][],
	mapping: readonly (F | null)[],
	header: boolean,
	fields: readonly F[],
	lines?: readonly number[],
): MappedRow<F>[] {
	const start = header ? 1 : 0;
	return rows.slice(start).map((cells, i) => {
		const out = { line: lines?.[i + start] ?? i + start + 1 } as MappedRow<F>;
		for (const field of fields) {
			const index = mapping.indexOf(field);
			(out as Record<F, string>)[field] = index === -1 ? "" : (cells[index] ?? "").trim();
		}
		return out;
	});
}

/** The commit found errors (the data changed since the preview, or no answer yet): validate again. */
export class ImportNotReadyError extends Error {
	constructor() {
		super("the file still has errors: validate again");
		this.name = "ImportNotReadyError";
	}
}

export interface ImportBatchOptions {
	/** The kind of the batch; the audit action is `import.<kind>`. */
	kind: (typeof IMPORT_KINDS)[number];
	filename: string;
	/** The mode of a patron import (`upsert`, `sync`). */
	mode?: string;
	actor: AuditActor;
	now: Date;
	/** Keeps the original file (`DATA_DIR/imports/<batch-id>/…`) and returns its stored path. */
	storeFile: (batchId: number) => string | null;
}

/**
 * The shell of every commit, inside its transaction: the `import_batch` row, the writes of the
 * import (`body`, given the batch id, returning the summary), the original file kept, the batch
 * closed with its summary and the audit row (`details`: what the log keeps of the summary).
 */
export function withImportBatch<S extends AuditDetails>(
	tx: DbOrTx,
	options: ImportBatchOptions,
	body: (batchId: number) => S,
	details: (summary: S) => AuditDetails = (summary) => summary,
): { batchId: number } & S {
	const now = options.now.toISOString();
	const batch = tx
		.insert(importBatch)
		.values({
			kind: options.kind,
			filename: options.filename,
			mode: options.mode,
			startedAt: now,
			byUserId: options.actor.id,
		})
		.returning({ id: importBatch.id })
		.get();
	const summary = body(batch.id);
	const storedPath = options.storeFile(batch.id);
	tx.update(importBatch)
		.set({ storedPath, finishedAt: now, summary })
		.where(eq(importBatch.id, batch.id))
		.run();
	audit(
		tx,
		options.actor,
		`import.${options.kind}`,
		"import_batch",
		batch.id,
		details(summary),
		options.now,
	);
	return { batchId: batch.id, ...summary };
}

/** The ids an import created, kept in its batch's summary under `key`; none for an unknown batch. */
export function createdIdsOfBatch(
	db: DbOrTx,
	batchId: number,
	key: "createdIds" | "createdItemIds",
): number[] {
	const batch = db
		.select({ summary: importBatch.summary })
		.from(importBatch)
		.where(eq(importBatch.id, batchId))
		.get();
	const ids = batch?.summary?.[key];
	return Array.isArray(ids) ? (ids as number[]) : [];
}

/** An import batch as the quick filters of the print lists offer it. */
export interface ImportBatchEntry {
	id: number;
	filename: string;
	finishedAt: string | null;
	/** How many rows the import created, as `countOf` reads it from the summary. */
	created: number;
}

/** The last 20 batches of a kind, newest first, with what each created. */
export function importBatches(
	db: DbOrTx,
	kind: (typeof IMPORT_KINDS)[number],
	countOf: (summary: Record<string, unknown>) => number,
): ImportBatchEntry[] {
	return db
		.select({
			id: importBatch.id,
			filename: importBatch.filename,
			finishedAt: importBatch.finishedAt,
			summary: importBatch.summary,
		})
		.from(importBatch)
		.where(eq(importBatch.kind, kind))
		.orderBy(desc(importBatch.id))
		.limit(20)
		.all()
		.map((b) => ({
			id: b.id,
			filename: b.filename,
			finishedAt: b.finishedAt,
			created: b.summary ? countOf(b.summary) : 0,
		}));
}
