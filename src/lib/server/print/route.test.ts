// SPDX-License-Identifier: GPL-3.0-or-later
import { isHttpError } from "@sveltejs/kit";
import { describe, expect, it } from "vitest";
import { createTestDb } from "../../../../tests/helpers/db.js";
import { staffUser } from "#lib/server/db/schema.js";
import { addEntries, createPrintList } from "#lib/server/services/print-lists.js";
import { LabelGeometryError, StockNotFoundError } from "#lib/server/services/labels.js";
import { TemplateError } from "#lib/server/templates/engine.js";
import { htmlResponse, printSelection, rethrowPrintError } from "./route.js";

function statusOf(run: () => unknown): number | null {
	try {
		run();
		return null;
	} catch (e) {
		if (isHttpError(e)) {
			return e.status;
		}
		throw e;
	}
}

describe("the selection of a print route", () => {
	it("takes the ids of the query, or of a print list of the kind the route prints", () => {
		const db = createTestDb();
		const actor = db
			.insert(staffUser)
			.values({ username: "u", passwordHash: "x", roles: [] })
			.returning({ id: staffUser.id })
			.get();
		const patrons = createPrintList(db, "patrons", "Classe", actor);
		addEntries(db, patrons, [7, 3], actor);
		const empty = createPrintList(db, "items", "Vuota", actor);

		expect(printSelection(db, { ids: "4,5" }, "patrons")).toEqual({ ids: [4, 5] });
		expect(printSelection(db, {}, "patrons")).toEqual({});
		expect(printSelection(db, { list: String(patrons) }, "patrons")).toEqual({
			ids: [7, 3],
			orderedIds: [7, 3],
		});
		// a list of patrons sent to the labels of copies, and the other way round
		expect(statusOf(() => printSelection(db, { list: String(patrons) }, "items"))).toBe(422);
		expect(statusOf(() => printSelection(db, { list: String(empty) }, "patrons"))).toBe(422);
		expect(statusOf(() => printSelection(db, { list: String(empty) }, "items"))).toBe(422);
		expect(statusOf(() => printSelection(db, { list: "999" }, "items"))).toBe(404);
	});

	it("answers with an HTML page that is never cached", async () => {
		const res = htmlResponse("<p>x</p>", { "X-Cards-Count": "2" });
		expect(res.headers.get("Content-Type")).toBe("text/html; charset=utf-8");
		expect(res.headers.get("Cache-Control")).toBe("no-store");
		expect(res.headers.get("X-Cards-Count")).toBe("2");
		expect(await res.text()).toBe("<p>x</p>");
	});

	it("answers a job that cannot print: 422 with its reason, 404 for a missing stock", () => {
		expect(statusOf(() => rethrowPrintError(new TemplateError("default", ["no face"])))).toBe(
			422,
		);
		expect(
			statusOf(() =>
				rethrowPrintError(new LabelGeometryError("a4", "overflowX", "too wide")),
			),
		).toBe(422);
		expect(statusOf(() => rethrowPrintError(new StockNotFoundError("a4")))).toBe(404);
		expect(() => rethrowPrintError(new TypeError("bug"))).toThrow(TypeError);
	});
});
