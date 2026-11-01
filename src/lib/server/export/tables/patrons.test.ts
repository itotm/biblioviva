// SPDX-License-Identifier: GPL-3.0-or-later
import * as v from "valibot";
import { describe, expect, it } from "vitest";
import { createTestDb } from "../../../../../tests/helpers/db.js";
import { staffUser } from "#lib/server/db/schema.js";
import { createPatron } from "#lib/server/services/patrons.js";
import { toCsv } from "../csv.js";
import { getExport } from "../registry.js";
import { patronsExportSchema, registerPatronsExport } from "./patrons.js";
import { classId, PATRON_RULES } from "../../../../../tests/helpers/school.js";

describe("patrons export", () => {
	it("exports the filtered grid with localized labels and values", async () => {
		const db = createTestDb();
		const actor = db
			.insert(staffUser)
			.values({ username: "u", passwordHash: "x", roles: [] })
			.returning({ id: staffUser.id })
			.get();
		const rules = PATRON_RULES;
		classId(db, "2", "A");
		const input = {
			patronType: "student" as const,
			firstName: "Anna",
			lastName: "Rossi",
			levelCode: "3",
			groupId: String(classId(db, "3", "A")),
			groupName: "",
			cardNumber: "0000000018",
			externalId: "",
			email: "",
			circulationNote: "",
			notes: "",
		};
		createPatron(db, input, actor, rules);
		createPatron(
			db,
			{
				...input,
				lastName: "Verdi",
				levelCode: "2",
				groupId: "",
				groupName: "A",
				cardNumber: "",
			},
			actor,
			rules,
		);
		registerPatronsExport(() => ({
			lastName: "Cognome",
			firstName: "Nome",
			type_student: "Studente",
			status_active: "Attivo",
		}));
		const definition = getExport("patrons");
		if (!definition) {
			throw new Error("patrons export not registered");
		}
		expect(definition.permission).toBe("patrons");
		const params = v.parse(patronsExportSchema, { levelCode: "3" });
		const csv = toCsv(
			await definition.build(db, params, { id: actor.id } as never, "Europe/Rome"),
		);
		const lines = csv.slice(1).split("\r\n");
		expect(lines[0]).toBe(
			"Cognome;Nome;patronType;classLabel;cardNumber;status;openLoans;overdueLoans",
		);
		expect(lines[1]).toBe("Rossi;Anna;Studente;3 A;0000000018;Attivo;0;0");
		expect(lines).toHaveLength(3);
	});
});
