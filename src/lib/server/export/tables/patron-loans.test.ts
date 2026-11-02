// SPDX-License-Identifier: GPL-3.0-or-later
import * as v from "valibot";
import { describe, expect, it } from "vitest";
import { createTestDb } from "../../../../../tests/helpers/db.js";
import { biblio, item, loan, staffUser } from "#lib/server/db/schema.js";
import { createPatron } from "#lib/server/services/patrons.js";
import { toCsv } from "../csv.js";
import { getExport } from "../registry.js";
import { patronLoansExportSchema, registerPatronLoansExport } from "./patron-loans.js";
import { classId, PATRON_RULES } from "../../../../../tests/helpers/school.js";

describe("patron loans export", () => {
	it("exports one patron history with localized outcomes", async () => {
		const db = createTestDb();
		const actor = db
			.insert(staffUser)
			.values({ username: "u", passwordHash: "x", roles: [] })
			.returning({ id: staffUser.id })
			.get();
		const id = createPatron(
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
		const b = db
			.insert(biblio)
			.values({ title: "Il libro", author: "Autore", publisher: "P", kind: "fiction" })
			.returning({ id: biblio.id })
			.get();
		const copy = db
			.insert(item)
			.values({ biblioId: b.id, barcode: "2026-00011" })
			.returning({ id: item.id })
			.get();
		db.insert(loan)
			.values({
				itemId: copy.id,
				patronId: id,
				issuedAt: "2026-09-01T08:00:00.000Z",
				dueDate: "2026-09-15",
				returnedAt: "2026-09-10T08:00:00.000Z",
				patronTypeSnapshot: "student",
				schoolYear: "2026/2027",
			})
			.run();
		registerPatronLoansExport(() => ({ title: "Titolo", outcome_returned: "Restituito" }));
		const definition = getExport("patron-loans");
		if (!definition) {
			throw new Error("patron-loans export not registered");
		}
		expect(definition.permission).toBe("patrons");
		const params = v.parse(patronLoansExportSchema, { patron: String(id) });
		const table = await definition.build(db, params, { id: actor.id } as never, "Europe/Rome");
		expect(table.name).toBe(`patron-${id}-loans`);
		const lines = toCsv(table).slice(1).split("\r\n");
		expect(lines[0]).toBe(
			"issuedAt;dueDate;returnedAt;outcome;Titolo;author;barcode;renewals;schoolYear",
		);
		expect(lines[1]).toContain(";Restituito;Il libro;Autore;2026-00011;0;2026/2027");
		expect(() => v.parse(patronLoansExportSchema, { patron: "x" })).toThrow();
	});
});
