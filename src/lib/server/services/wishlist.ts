// SPDX-License-Identifier: GPL-3.0-or-later
// The wishlist (step 9.15, Q88): books the library would like to have, noted at the desk or by the
// cataloguers. At least one of title, author and series; the same book asked again adds a request
// instead of a second row; the patron who asked is optional and erased with the patron; "Cataloga"
// ends a wish once its record is saved. Audit rows carry ids and counts, never names or titles.
import { patronSortName } from "#lib/shared/patron-name.js";
import { NotFoundError, ServiceError } from "#lib/server/errors.js";
import { desc, eq, inArray, sql } from "drizzle-orm";
import type { DbOrTx } from "#lib/server/db/client.js";
import { patron, wish } from "#lib/server/db/schema.js";
import { normalizeSearchText } from "#lib/shared/text.js";
import { demoWish } from "#lib/server/demo/content.js";
import { audit, type AuditActor } from "./audit.js";
import { type CatalogRules } from "./catalog.js";
import { searchBiblios, type BiblioListRow } from "./catalog-search.js";

export interface WishInput {
	title: string;
	author: string;
	series: string;
	seriesNumber: string;
	note: string;
	patronId: number | null;
}

export interface WishRow {
	id: number;
	title: string | null;
	author: string | null;
	series: string | null;
	seriesNumber: string | null;
	note: string | null;
	patronId: number | null;
	/** "Surname Name" of the patron who asked, when there is one. */
	patronName: string | null;
	requests: number;
	createdAt: string;
	updatedAt: string;
}

export type WishSort = "recent" | "requests" | "title" | "author";

export class WishValidationError extends ServiceError {
	constructor(override readonly code: "empty" | "tooLong") {
		super(code, `wish: ${code}`);
		this.name = "WishValidationError";
	}
}

export class WishNotFoundError extends NotFoundError {
	constructor(readonly id: number) {
		super("wish", `wish ${String(id)} not found`);
		this.name = "WishNotFoundError";
	}
}

const LIMITS = { title: 300, author: 200, series: 200, seriesNumber: 20, note: 500 } as const;
const clean = (s: string): string | null => {
	const t = s.replace(/\s+/g, " ").trim();
	return t === "" ? null : t;
};

/** Trims the fields, checks their length and that at least one of title, author, series is set. */
export function validateWish(input: WishInput): {
	title: string | null;
	author: string | null;
	series: string | null;
	seriesNumber: string | null;
	note: string | null;
	patronId: number | null;
} {
	const out = {
		title: clean(input.title),
		author: clean(input.author),
		series: clean(input.series),
		seriesNumber: clean(input.seriesNumber),
		note: clean(input.note),
	};
	for (const key of Object.keys(LIMITS) as (keyof typeof LIMITS)[]) {
		if ((out[key]?.length ?? 0) > LIMITS[key]) {
			throw new WishValidationError("tooLong");
		}
	}
	if (!out.title && !out.author && !out.series) {
		throw new WishValidationError("empty");
	}
	// a number without a series means nothing
	return { ...out, seriesNumber: out.series ? out.seriesNumber : null, patronId: input.patronId };
}

/** The same book: title, author and series compared without case, accents and punctuation. */
export function wishKey(w: {
	title: string | null;
	author: string | null;
	series: string | null;
	seriesNumber?: string | null;
}): string {
	return [w.title, w.author, w.series, w.seriesNumber]
		.map((v) => normalizeSearchText(v ?? ""))
		.join("|");
}

const rowSelect = {
	id: wish.id,
	title: wish.title,
	author: wish.author,
	series: wish.series,
	seriesNumber: wish.seriesNumber,
	note: wish.note,
	patronId: wish.patronId,
	lastName: patron.lastName,
	firstName: patron.firstName,
	requests: wish.requests,
	createdAt: wish.createdAt,
	updatedAt: wish.updatedAt,
};

type Selected = {
	[K in keyof typeof rowSelect]: (typeof rowSelect)[K]["_"]["data"] | null;
};

const toRow = ({ lastName, firstName, ...r }: Selected): WishRow => ({
	...(r as Omit<WishRow, "patronName">),
	patronName: lastName ? patronSortName({ lastName, firstName }) : null,
});

/** The whole list (a few hundred rows at most), searched and sorted. */
export function listWishes(db: DbOrTx, options: { q?: string; sort?: WishSort } = {}): WishRow[] {
	const order = {
		recent: [desc(wish.createdAt), desc(wish.id)],
		requests: [desc(wish.requests), desc(wish.createdAt)],
		title: [sql`${wish.title} is null`, sql`${wish.title} collate nocase`],
		author: [sql`${wish.author} is null`, sql`${wish.author} collate nocase`],
	}[options.sort ?? "recent"];
	const rows = db
		.select(rowSelect)
		.from(wish)
		.leftJoin(patron, eq(patron.id, wish.patronId))
		.orderBy(...order)
		.all()
		.map((r) => toRow(r as Selected));
	const words = normalizeSearchText(options.q ?? "")
		.split(" ")
		.filter(Boolean);
	if (words.length === 0) {
		return rows;
	}
	return rows.filter((r) => {
		const text = normalizeSearchText(
			[r.title, r.author, r.series, r.note].filter(Boolean).join(" "),
		);
		return words.every((w) => text.includes(w));
	});
}

export function getWish(db: DbOrTx, id: number): WishRow {
	const r = db
		.select(rowSelect)
		.from(wish)
		.leftJoin(patron, eq(patron.id, wish.patronId))
		.where(eq(wish.id, id))
		.get();
	if (!r) {
		throw new WishNotFoundError(id);
	}
	return toRow(r);
}

/**
 * Adds a wish; the same book already in the list gets one more request instead (its requester is
 * kept, or taken from this request when it had none).
 */
export function createWish(
	db: DbOrTx,
	input: WishInput,
	actor: AuditActor,
	now = new Date(),
): { id: number; merged: boolean } {
	// the public demo stores its example wish (Q121)
	const data = validateWish(demoWish(input, undefined, now));
	const key = wishKey(data);
	const same = db
		.select({
			id: wish.id,
			title: wish.title,
			author: wish.author,
			series: wish.series,
			seriesNumber: wish.seriesNumber,
			patronId: wish.patronId,
		})
		.from(wish)
		.all()
		.find((w) => wishKey(w) === key);
	if (same) {
		db.update(wish)
			.set({
				requests: sql`${wish.requests} + 1`,
				patronId: same.patronId ?? data.patronId,
				note: data.note ? sql`coalesce(${wish.note}, ${data.note})` : undefined,
				updatedAt: now.toISOString(),
			})
			.where(eq(wish.id, same.id))
			.run();
		audit(db, actor, "wish.request", "wish", same.id, { merged: true }, now);
		return { id: same.id, merged: true };
	}
	const id = db
		.insert(wish)
		.values({
			...data,
			createdBy: actor.id,
			createdAt: now.toISOString(),
			updatedAt: now.toISOString(),
		})
		.returning({ id: wish.id })
		.get().id;
	audit(db, actor, "wish.create", "wish", id, undefined, now);
	return { id, merged: false };
}

export function updateWish(
	db: DbOrTx,
	id: number,
	input: WishInput,
	actor: AuditActor,
	now = new Date(),
): void {
	const stored = db
		.select({ title: wish.title, author: wish.author, series: wish.series, note: wish.note })
		.from(wish)
		.where(eq(wish.id, id))
		.get();
	const data = validateWish(demoWish(input, stored, now));
	const changed = db
		.update(wish)
		.set({ ...data, updatedAt: now.toISOString() })
		.where(eq(wish.id, id))
		.run().changes;
	if (changed === 0) {
		throw new WishNotFoundError(id);
	}
	audit(db, actor, "wish.update", "wish", id, undefined, now);
}

/** "+1 richiesta" on the selected wishes; returns how many were counted. */
export function addWishRequests(
	db: DbOrTx,
	ids: readonly number[],
	actor: AuditActor,
	now = new Date(),
): number {
	if (ids.length === 0) {
		return 0;
	}
	const changed = db
		.update(wish)
		.set({ requests: sql`${wish.requests} + 1`, updatedAt: now.toISOString() })
		.where(inArray(wish.id, [...ids]))
		.run().changes;
	audit(db, actor, "wish.request", "wish", null, { count: changed }, now);
	return changed;
}

export function deleteWishes(
	db: DbOrTx,
	ids: readonly number[],
	actor: AuditActor,
	now = new Date(),
): number {
	if (ids.length === 0) {
		return 0;
	}
	const deleted = db
		.delete(wish)
		.where(inArray(wish.id, [...ids]))
		.run().changes;
	audit(db, actor, "wish.delete", "wish", null, { count: deleted }, now);
	return deleted;
}

/** The wish became a record ("Cataloga"): it leaves the list, the audit keeps the record's id. */
export function fulfilWish(
	db: DbOrTx,
	id: number,
	biblioId: number,
	actor: AuditActor,
	now = new Date(),
): boolean {
	const deleted = db.delete(wish).where(eq(wish.id, id)).run().changes > 0;
	if (deleted) {
		audit(db, actor, "wish.fulfil", "wish", id, { biblioId }, now);
	}
	return deleted;
}

/** A removed patron's requests stay, without the patron (the anonymization of step 2.8). */
export function forgetWishRequester(db: DbOrTx, patronId: number): number {
	return db.update(wish).set({ patronId: null }).where(eq(wish.patronId, patronId)).run().changes;
}

/**
 * What the library already has or already wishes for, while a wish is typed: the catalogue
 * records matching the words of the title and author, the records of the series, and the wishes
 * sharing a title, an author or a series. Short words (under 3 letters) are ignored.
 */
export function similarToWish(
	db: DbOrTx,
	input: { title: string; author: string; series: string },
	rules: CatalogRules,
	limit = 5,
): { catalog: BiblioListRow[]; wishes: WishRow[] } {
	const long = (s: string): string => (normalizeSearchText(s).length >= 3 ? s.trim() : "");
	const title = long(input.title);
	const author = long(input.author);
	const series = long(input.series);
	const catalog = new Map<number, BiblioListRow>();
	if (title || author) {
		for (const r of searchBiblios(
			db as Parameters<typeof searchBiblios>[0],
			{ q: `${title} ${author}`.trim(), limit },
			rules,
		).rows) {
			catalog.set(r.id, r);
		}
	}
	if (series) {
		for (const r of searchBiblios(
			db as Parameters<typeof searchBiblios>[0],
			{ series, limit },
			rules,
		).rows) {
			catalog.set(r.id, r);
		}
	}
	const has = (value: string | null, wanted: string): boolean =>
		wanted !== "" &&
		value !== null &&
		normalizeSearchText(value).includes(normalizeSearchText(wanted));
	const wishes = listWishes(db).filter(
		(w) => has(w.title, title) || has(w.author, author) || has(w.series, series),
	);
	return { catalog: [...catalog.values()].slice(0, limit), wishes: wishes.slice(0, limit) };
}
