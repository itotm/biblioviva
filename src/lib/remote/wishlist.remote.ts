// SPDX-License-Identifier: GPL-3.0-or-later
// The wishlist (step 9.15, Q88): for the desk (`loans`) and the cataloguers (`catalog`). Who asked
// for a book is a patron (mostly a minor): only accounts that see patrons at the desk or in the
// patron list (`loans`, `patrons`) read it or set it.
import { command, query } from "$app/server";
import * as v from "valibot";
import { requireAnyUser, requireUser } from "#lib/server/auth/guard.js";
import { canSeePatrons } from "#lib/server/auth/rbac.js";
import { refusing } from "#lib/server/http/errors.js";
import type { AuthUser } from "#lib/server/auth/types.js";
import { getConfig } from "#lib/server/config/index.js";
import { getDb } from "#lib/server/db/index.js";
import { catalogRules } from "#lib/server/services/catalog.js";
import {
	addWishRequests,
	createWish,
	deleteWishes,
	fulfilWish,
	getWish as getWishService,
	listWishes,
	similarToWish,
	updateWish,
	WishNotFoundError,
	WishValidationError,
	type WishRow,
} from "#lib/server/services/wishlist.js";

import { dbId as id, dbIds } from "#lib/shared/input-schemas.js";

const ids = dbIds(1000);
const t120 = v.optional(v.pipe(v.string(), v.maxLength(120)), "");
const t20 = v.optional(v.pipe(v.string(), v.maxLength(20)), "");
const t200 = v.optional(v.pipe(v.string(), v.maxLength(200)), "");
const t300 = v.optional(v.pipe(v.string(), v.maxLength(300)), "");
const t500 = v.optional(v.pipe(v.string(), v.maxLength(500)), "");

/** The wishlist is open to the desk and to the cataloguers. */
const WISHLIST = ["loans", "catalog"] as const;

/** The requester left out for accounts that do not see patrons. */
function forUser(user: AuthUser, rows: WishRow[]): WishRow[] {
	return canSeePatrons(user)
		? rows
		: rows.map((r) => ({ ...r, patronId: null, patronName: null }));
}

export const getWishes = query(
	v.object({
		q: t120,
		sort: v.optional(v.picklist(["recent", "requests", "title", "author"]), "recent"),
	}),
	({ q, sort }) => {
		const user = requireAnyUser(WISHLIST);
		return forUser(user, listWishes(getDb(), { q, sort }));
	},
);

export const getWish = query(id, (wishId) => {
	const user = requireAnyUser(WISHLIST);
	return refusing(
		() => forUser(user, [getWishService(getDb(), wishId)])[0] ?? null,
		WishNotFoundError,
		() => null,
	);
});

/** What the catalogue and the list already have, while a wish is typed. */
export const getWishSimilar = query(
	v.object({ title: t300, author: t200, series: t200 }),
	(input) => {
		const user = requireAnyUser(WISHLIST);
		const found = similarToWish(getDb(), input, catalogRules(getConfig()));
		return { catalog: found.catalog, wishes: forUser(user, found.wishes) };
	},
);

const wishInput = v.object({
	id: v.optional(id),
	title: t300,
	author: t200,
	series: t200,
	seriesNumber: t20,
	note: t500,
	patronId: v.optional(v.nullable(id), null),
});

/** Adds a wish (or one more request for the same book) or saves the changes of one. */
export const saveWish = command(wishInput, (input) => {
	const user = requireAnyUser(WISHLIST);
	const db = getDb();
	const patronId = canSeePatrons(user) ? (input.patronId ?? null) : null;
	return refusing(
		() => {
			if (input.id) {
				// an account that does not see requesters keeps the one already set
				const keep = canSeePatrons(user) ? patronId : getWishService(db, input.id).patronId;
				updateWish(db, input.id, { ...input, patronId: keep }, user);
				void getWishes({ q: "", sort: "recent" }).refresh();
				return { ok: true as const, id: input.id, merged: false };
			}
			const r = createWish(db, { ...input, patronId }, user);
			return { ok: true as const, ...r };
		},
		WishValidationError,
		(e) => ({ ok: false as const, error: e.code }),
	);
});

export const addWishRequest = command(v.object({ ids }), ({ ids: list }) => {
	const user = requireAnyUser(WISHLIST);
	return { counted: addWishRequests(getDb(), list, user) };
});

export const removeWishes = command(v.object({ ids }), ({ ids: list }) => {
	const user = requireAnyUser(WISHLIST);
	return { removed: deleteWishes(getDb(), list, user) };
});

/** "Cataloga": the record was saved in "Nuovo libro", the wish leaves the list. */
export const fulfilWishWith = command(v.object({ id, biblioId: id }), (input) => {
	const user = requireUser("catalog");
	return { removed: fulfilWish(getDb(), input.id, input.biblioId, user) };
});
