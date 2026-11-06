// SPDX-License-Identifier: GPL-3.0-or-later
// The segnatura of the copies (PLAN.md §3.17, step 9.50, Q143): computed by the server from the
// scheme `classification.callNumber`, the record (classification, level, author, title, the
// title's text) and the copy (its level with `classPerItem`, its text), and stored on the copy
// with its shelf part. Every change that can alter it ends with `refreshCallNumbers`; a changed
// segnatura puts the copy's labels back among those to print (9.42).
import { eq, inArray, sql } from "drizzle-orm";
import type { DbOrTx } from "#lib/server/db/client.js";
import { biblio, item } from "#lib/server/db/schema.js";
import { computeCallNumber, type ClassificationScheme } from "#lib/shared/classification.js";

type Scheme = Pick<ClassificationScheme, "callNumber" | "classPerItem" | "specialAuthors">;

interface Row {
	id: number;
	biblioId: number;
	callNumber: string | null;
	callHead: string | null;
	callText: string | null;
	readingLevel: string | null;
	kind: string | null;
	genreCode: string | null;
	classCode: string | null;
	biblioLevel: string | null;
	author: string;
	title: string;
	biblioText: string | null;
}

export interface CallNumberChange {
	id: number;
	from: string | null;
	full: string | null;
	head: string | null;
}

function rowsOf(db: DbOrTx, biblioIds: readonly number[] | "all"): Row[] {
	if (biblioIds !== "all" && biblioIds.length === 0) {
		return [];
	}
	const q = db
		.select({
			id: item.id,
			biblioId: item.biblioId,
			callNumber: item.callNumber,
			callHead: item.callHead,
			callText: item.callText,
			readingLevel: item.readingLevel,
			kind: biblio.kind,
			genreCode: biblio.genreCode,
			classCode: biblio.classCode,
			biblioLevel: biblio.readingLevel,
			author: biblio.author,
			title: biblio.title,
			biblioText: biblio.callText,
		})
		.from(item)
		.innerJoin(biblio, eq(biblio.id, item.biblioId));
	return biblioIds === "all"
		? q.all()
		: q.where(inArray(item.biblioId, [...new Set(biblioIds)])).all();
}

/** The segnatura of one copy under `scheme`. */
export function callNumberOfRow(
	scheme: Scheme,
	r: Omit<Row, "id" | "biblioId" | "callNumber" | "callHead">,
): { full: string; head: string } | null {
	return computeCallNumber(scheme, {
		kind: r.kind,
		genreCode: r.genreCode,
		classCode: r.classCode,
		readingLevel: scheme.classPerItem ? r.readingLevel : r.biblioLevel,
		author: r.author,
		title: r.title,
		text: r.biblioText,
		copyText: r.callText,
	});
}

/** The copies whose stored segnatura differs from the one computed under `scheme` (no writes). */
export function callNumberChanges(
	db: DbOrTx,
	scheme: Scheme,
	biblioIds: readonly number[] | "all" = "all",
	/** Changes the data of a row before computing (the taxonomy plan's renames and moves). */
	adjust: (r: Row) => Row = (r) => r,
): CallNumberChange[] {
	const changes: CallNumberChange[] = [];
	for (const stored of rowsOf(db, biblioIds)) {
		const r = adjust(stored);
		const next = callNumberOfRow(scheme, r);
		const full = next?.full ?? null;
		const head = next?.head ?? null;
		if (full !== stored.callNumber || head !== stored.callHead) {
			changes.push({ id: r.id, from: stored.callNumber, full, head });
		}
	}
	return changes;
}

/**
 * Computes the segnatura of the copies of `biblioIds` (or of all) and stores the ones that
 * changed. A copy whose printed segnatura changes gets its labels back among those to print; a
 * copy that had none (a record just classified) only gains its spine band, which waited (9.21).
 * Returns the number of copies whose segnatura changed.
 */
export function refreshCallNumbers(
	tx: DbOrTx,
	scheme: Scheme,
	biblioIds: readonly number[] | "all",
	now = new Date(),
): number {
	const at = now.toISOString();
	let changed = 0;
	for (const c of callNumberChanges(tx, scheme, biblioIds)) {
		const reprint = c.from !== null && c.from !== c.full;
		tx.update(item)
			.set({
				callNumber: c.full,
				callHead: c.head,
				...(reprint ? { spineLabelPrintedAt: null, barcodeLabelPrintedAt: null } : {}),
				updatedAt: at,
			})
			.where(eq(item.id, c.id))
			.run();
		if (c.from !== c.full) {
			changed++;
		}
	}
	return changed;
}

/**
 * Before a change to a scheme whose patterns are only `{{copytext}}` (the free one), the copies keep
 * their segnatura as their written text, so nothing changes until the operator edits it.
 */
export function keepCallNumbersAsText(tx: DbOrTx, now = new Date()): number {
	return tx.run(
		sql`UPDATE item SET call_text = call_number, updated_at = ${now.toISOString()}
			WHERE call_text IS NULL AND call_number IS NOT NULL`,
	).changes;
}
