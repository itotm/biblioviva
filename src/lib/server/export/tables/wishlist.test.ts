// SPDX-License-Identifier: GPL-3.0-or-later
import * as v from "valibot";
import { describe, expect, it } from "vitest";
import { createTestDb } from "../../../../../tests/helpers/db.js";
import type { AuthUser } from "#lib/server/auth/types.js";
import { staffUser } from "#lib/server/db/schema.js";
import { createPatron } from "#lib/server/services/patrons.js";
import { createWish } from "#lib/server/services/wishlist.js";
import { toCsv } from "../csv.js";
import { getExport } from "../registry.js";
import type { TableExport } from "../types.js";
import { registerWishlistExport, wishlistExportSchema } from "./wishlist.js";
import { classId, PATRON_RULES } from "../../../../../tests/helpers/school.js";

const user = (permissions: AuthUser["permissions"]): AuthUser => ({
	id: 1,
	username: "u",
	displayName: "U",
	roles: [],
	permissions,
});

describe("wishlist export", () => {
	it("exports the wishes with the grid's search and sort, never who asked", async () => {
		const db = createTestDb();
		const actor = db
			.insert(staffUser)
			.values({ username: "u", passwordHash: "x", roles: [] })
			.returning({ id: staffUser.id })
			.get();
		const asker = createPatron(
			db,
			{
				patronType: "student",
				firstName: "Anna",
				lastName: "Rossi",
				levelCode: "3",
				groupId: String(classId(db, "3", "A")),
				groupName: "",
				cardNumber: "",
				externalId: "",
				email: "",
				circulationNote: "",
				notes: "",
			},
			actor,
			PATRON_RULES,
		);
		const wish = { series: "", seriesNumber: "", note: "", patronId: null };
		createWish(db, { ...wish, title: "Wonder", author: "Palacio", patronId: asker }, actor);
		createWish(db, { ...wish, title: "Wonder", author: "Palacio" }, actor);
		createWish(
			db,
			{ ...wish, title: "", author: "", series: "Geronimo Stilton", seriesNumber: "12" },
			actor,
		);
		createWish(
			db,
			{ ...wish, title: "Il piccolo principe", author: "", note: "2 copie" },
			actor,
		);
		registerWishlistExport(() => ({ title: "Titolo", requests: "Richieste" }));
		const definition = getExport("wishlist");
		if (!definition) {
			throw new Error("wishlist export not registered");
		}
		const build = async (raw: Record<string, string>, who: AuthUser): Promise<TableExport> =>
			definition.build(db, v.parse(wishlistExportSchema, raw), who, "Europe/Rome");

		const table = await build({ sort: "requests" }, user(["catalog"]));
		expect(table.name).toBe("lista-desideri");
		expect(table.columns.map((c) => c.id)).toEqual([
			"title",
			"author",
			"series",
			"seriesNumber",
			"requests",
			"note",
			"createdAt",
		]);
		const rows = [...table.rows];
		expect(rows).toHaveLength(3);
		expect(rows[0]).toMatchObject({ title: "Wonder", author: "Palacio", requests: 2 });
		for (const row of rows) {
			expect(Object.keys(row)).not.toContain("patronId");
			expect(Object.keys(row)).not.toContain("patronName");
		}
		expect(toCsv(table)).toContain("Titolo;author;series;seriesNumber;Richieste");

		const found = [...(await build({ q: "stilton" }, user(["loans"]))).rows];
		expect(found).toEqual([expect.objectContaining({ series: "Geronimo Stilton" })]);

		await expect(build({}, user(["patrons", "reports"]))).rejects.toMatchObject({
			status: 403,
		});
		expect(() => v.parse(wishlistExportSchema, { sort: "patron" })).toThrow();
	});
});
