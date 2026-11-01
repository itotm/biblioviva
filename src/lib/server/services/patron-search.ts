// SPDX-License-Identifier: GPL-3.0-or-later
// The patron search (PLAN.md steps 2.1, 5.2, 9.24): the grid with its filters and loan counts, the
// quick search of the desk and the census, the name and card condition every patron search shares,
// and the approximate matches that forgive typing mistakes. Plain functions `(db, …)`.
import { openLoansOfPatronSql } from "#lib/server/db/conditions.js";
import { collatorFor } from "#lib/shared/collation.js";
import { and, asc, desc, eq, inArray, ne, sql, type SQL } from "drizzle-orm";
import type { Db, DbOrTx } from "#lib/server/db/client.js";
import { patron, patronClass } from "#lib/server/db/schema.js";
import type { PatronFilters, PatronType } from "#lib/shared/patron-schema.js";
import { normalizeSearchText, SEARCH_MIN_CHARS } from "#lib/shared/text.js";
import {
	byCloseness,
	closeness,
	maxEdits,
	searchWords,
	SIMILAR_THRESHOLD,
} from "#lib/shared/fuzzy.js";

export interface PatronListRow {
	id: number;
	cardNumber: string | null;
	firstName: string;
	lastName: string;
	patronType: PatronType;
	/** `3 B`, the teachers group's name, or "" (Phase 12). */
	classLabel: string;
	levelCode: string | null;
	groupId: number | null;
	status: "active" | "anonymized";
	hasPhoto: boolean;
	openLoans: number;
	overdueLoans: number;
	/** An approximate result, found by forgiving typing mistakes (step 9.24). */
	similar: boolean;
}

const openLoansSql = openLoansOfPatronSql;
const overdueSql = (today: string): SQL<number> =>
	sql<number>`(select count(*) from loan l where l.patron_id = patron.id and l.returned_at is null and l.due_date < ${today})`;

/**
 * The condition shared by every patron search (step 5.2): a part of the normalised "surname name"
 * anywhere, as the catalogue searches titles (9.13 round 33), or of the whole name without spaces,
 * so "de luca", "deluca", "uca" and "luca" all find "De Luca Mario"; or the card number (9.24): its
 * beginning, or for digits alone the digits typed anywhere in it (`000302` finds `D000302`). Null
 * when the text has nothing searchable.
 */
export function patronNameCondition(text: string): SQL | null {
	const q = normalizeSearchText(text);
	if (!q) {
		return null;
	}
	const compact = q.replaceAll(" ", "");
	// letters, digits and dashes only, so nothing typed acts as a LIKE wildcard
	const card = text
		.trim()
		.toUpperCase()
		.replace(/[^A-Z0-9-]/g, "");
	const cardCondition = !card
		? sql`0`
		: /^\d+$/.test(card)
			? sql`${patron.cardNumber} LIKE ${`%${card}%`}`
			: sql`${patron.cardNumber} LIKE ${`${card}%`}`;
	return sql`(${patron.searchName} LIKE ${`%${q}%`} OR replace(${patron.searchName}, ' ', '') LIKE ${`%${compact}%`} OR ${cardCondition})`;
}

export interface QuickPatron {
	id: number;
	firstName: string;
	lastName: string;
	patronType: string;
	classLabel: string;
	groupId: number | null;
	hasPhoto: boolean;
	/** An approximate result, found by forgiving typing mistakes (step 9.24). */
	similar: boolean;
}

/**
 * The active patrons closest to a search with mistakes (step 9.24, Q124), the closest first: the
 * words are compared with the words of the normalised name (and each two neighbouring words
 * joined, so "delcua" finds "De Luca") by `closeness`; at most 50. A school has at most a
 * thousand patrons, so their names are scored in memory.
 */
export function similarPatronIds(db: DbOrTx, text: string, locale: string): number[] {
	const words = searchWords(text);
	if (!words.some((w) => maxEdits(w) > 0)) {
		return [];
	}
	const names = collatorFor(locale);
	return db
		.select({ id: patron.id, name: patron.searchName })
		.from(patron)
		.where(eq(patron.status, "active"))
		.all()
		.flatMap((r) => {
			const parts = r.name.split(" ").filter(Boolean);
			const joined = parts.slice(1).map((p, i) => `${parts[i] ?? ""}${p}`);
			const close = closeness(words, [...parts, ...joined]);
			return close ? [{ id: r.id, name: r.name, close }] : [];
		})
		.sort((a, b) => byCloseness(a.close, b.close) || names.compare(a.name, b.name))
		.slice(0, 50)
		.map((r) => r.id);
}

/** A row of the quick search before it is shaped. */
interface QuickRow {
	id: number;
	firstName: string;
	lastName: string;
	patronType: string;
	classLabel: string | null;
	groupId: number | null;
	photoPath: string | null;
}

/** Orders rows like the ids of a ranking. */
function inRankOrder<T extends { id: number }>(rows: T[], ranked: readonly number[]): T[] {
	const position = new Map(ranked.map((id, i) => [id, i]));
	return rows.sort((a, b) => (position.get(a.id) ?? 0) - (position.get(b.id) ?? 0));
}

/**
 * The patron quick search of the desk and the census (step 5.2): at most `limit` (20) patrons
 * whose name or card matches `patronNameCondition`, optionally in one class, never anonymized
 * ones, alphabetical; from `SEARCH_MIN_CHARS` characters, as the catalogue. Fewer than three
 * found: the closest names follow, marked (9.24).
 */
export function quickSearchPatrons(
	db: DbOrTx,
	text: string,
	/** `locale`: the installation's language, the order of the closest names. */
	options: { groupId?: number; limit?: number; locale: string },
): QuickPatron[] {
	const name = patronNameCondition(text);
	if (!name || normalizeSearchText(text).length < SEARCH_MIN_CHARS) {
		return [];
	}
	const limit = Math.min(options.limit ?? 20, 20);
	const inGroup =
		options.groupId === undefined ? undefined : eq(patron.classGroupId, options.groupId);
	const select = (where: SQL | undefined, max: number): QuickRow[] =>
		db
			.select({
				id: patron.id,
				firstName: patron.firstName,
				lastName: patron.lastName,
				patronType: patron.patronType,
				classLabel: patronClass.classLabel,
				groupId: patron.classGroupId,
				photoPath: patron.photoPath,
			})
			.from(patron)
			.leftJoin(patronClass, eq(patronClass.patronId, patron.id))
			.where(and(ne(patron.status, "anonymized"), where, inGroup))
			.orderBy(asc(patron.searchName))
			.limit(max)
			.all();
	const exact = select(name, limit);
	let similar: QuickRow[] = [];
	if (exact.length < SIMILAR_THRESHOLD) {
		const found = new Set(exact.map((r) => r.id));
		const ranked = similarPatronIds(db, text, options.locale).filter((id) => !found.has(id));
		if (ranked.length > 0) {
			similar = inRankOrder(select(inArray(patron.id, ranked), ranked.length), ranked).slice(
				0,
				limit - exact.length,
			);
		}
	}
	const shape = ({ photoPath, classLabel, ...r }: QuickRow, isSimilar: boolean): QuickPatron => ({
		...r,
		classLabel: classLabel ?? "",
		hasPhoto: photoPath !== null,
		similar: isSimilar,
	});
	return [...exact.map((r) => shape(r, false)), ...similar.map((r) => shape(r, true))];
}

/**
 * The patrons of a stage of the school: pupils of its levels and teachers of its teachers groups
 * (the `stage` of `patron_class`, 12.9).
 */
export function stageCondition(stage: string): SQL {
	return sql`${patron.id} IN (SELECT patron_id FROM patron_class WHERE stage = ${stage})`;
}

/**
 * Prefix search on the normalised "surname name" (any word) or the card, plus the grid filters;
 * fewer than three found: the closest names follow, marked (9.24).
 */
export function searchPatrons(
	db: Db,
	filters: Partial<PatronFilters>,
	/** Today in the library's time zone (`libraryToday`): decides which loans are overdue. */
	today: string,
	/** The installation's language: the order of the closest names. */
	locale: string,
): { rows: PatronListRow[]; total: number; similar: number } {
	// the filters other than the name, shared by the exact and the approximate results
	const conditions: (SQL | undefined)[] = [];
	const name = patronNameCondition(filters.q ?? "") ?? undefined;
	if (filters.patronType) {
		conditions.push(eq(patron.patronType, filters.patronType));
	}
	if (filters.levelCode) {
		conditions.push(eq(patron.levelCode, filters.levelCode));
	}
	if (filters.groupId) {
		conditions.push(eq(patron.classGroupId, Number(filters.groupId)));
	}
	if (filters.stage) {
		conditions.push(stageCondition(filters.stage));
	}
	if (filters.status) {
		conditions.push(eq(patron.status, filters.status));
	}
	const where = and(name, ...conditions);
	const order = {
		name: [asc(patron.searchName)],
		class: [
			sql`case ${patronClass.groupKind} when 'students' then 0 when 'teachers' then 2 else 1 end`,
			asc(patronClass.levelPosition),
			asc(patronClass.groupName),
			asc(patron.searchName),
		],
		card: [asc(patron.cardNumber)],
		status: [desc(patron.status), asc(patron.searchName)],
	}[filters.sort ?? "name"];
	const columns = {
		id: patron.id,
		cardNumber: patron.cardNumber,
		firstName: patron.firstName,
		lastName: patron.lastName,
		patronType: patron.patronType,
		classLabel: patronClass.classLabel,
		levelCode: patron.levelCode,
		groupId: patron.classGroupId,
		status: patron.status,
		photoPath: patron.photoPath,
		openLoans: openLoansSql,
		overdueLoans: overdueSql(today),
	};
	const rows = db
		.select(columns)
		.from(patron)
		.leftJoin(patronClass, eq(patronClass.patronId, patron.id))
		.where(where)
		.orderBy(...order)
		.limit(filters.limit ?? 500)
		.offset(filters.offset ?? 0)
		.all();
	const total =
		db
			.select({ n: sql<number>`count(*)` })
			.from(patron)
			.where(where)
			.get()?.n ?? 0;
	// fewer than three patrons for the words: the closest names follow, marked (9.24, Q124)
	let similar: typeof rows = [];
	if (name && total < SIMILAR_THRESHOLD && !filters.offset) {
		const found = new Set(rows.map((r) => r.id));
		const ranked = similarPatronIds(db, filters.q ?? "", locale).filter((id) => !found.has(id));
		if (ranked.length > 0) {
			similar = inRankOrder(
				db
					.select(columns)
					.from(patron)
					.leftJoin(patronClass, eq(patronClass.patronId, patron.id))
					.where(and(inArray(patron.id, ranked), ...conditions))
					.all(),
				ranked,
			);
		}
	}
	const shape = (
		{ photoPath, classLabel, ...r }: (typeof rows)[number],
		isSimilar: boolean,
	): PatronListRow => ({
		...r,
		classLabel: classLabel ?? "",
		patronType: r.patronType as PatronType,
		status: r.status as PatronListRow["status"],
		hasPhoto: photoPath !== null,
		similar: isSimilar,
	});
	return {
		rows: [...rows.map((r) => shape(r, false)), ...similar.map((r) => shape(r, true))],
		// the exact results; the approximate ones are counted apart
		total,
		similar: similar.length,
	};
}
