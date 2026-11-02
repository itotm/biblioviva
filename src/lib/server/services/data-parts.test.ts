// SPDX-License-Identifier: GPL-3.0-or-later
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { eq, sql } from "drizzle-orm";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { createTestDb } from "../../../../tests/helpers/db.js";
import { getConfig, resetConfigCache } from "#lib/server/config/index.js";
import type { Db } from "#lib/server/db/client.js";
import type { printList } from "#lib/server/db/schema.js";
import {
	auditLog,
	biblio,
	calendarEvent,
	classGroup,
	classPhotoFrame,
	classPhotoSheet,
	item,
	loan,
	patron,
	staffUser,
} from "#lib/server/db/schema.js";
import { resetEnvCache } from "#lib/server/env.js";
import { createCalendarEvent } from "./calendar-events.js";
import { catalogRules, createBiblio } from "./catalog.js";
import { addItems } from "./catalog-items.js";
import { checkoutItem } from "./circulation.js";
import { setUiTheme } from "../../../../tests/helpers/config.js";
import {
	DataRestoreError,
	pruneSnapshot,
	restoreDataParts,
	tablesOfParts,
	TABLES_THAT_NEVER_TRAVEL,
} from "./data-parts.js";
import { createPatron } from "./patrons.js";
import { addEntries, createPrintList } from "./print-lists.js";
import { PATRON_RULES, classId } from "../../../../tests/helpers/school.js";

let dir = "";
const previous = process.env.CONFIG_DIR;
beforeEach(() => {
	dir = mkdtempSync(join(tmpdir(), "bv-data-parts-"));
	process.env.CONFIG_DIR = join(dir, "config");
	resetEnvCache();
	resetConfigCache();
	setUiTheme(join(dir, "config"), "ocean");
});
afterEach(() => {
	process.env.CONFIG_DIR = previous;
	resetEnvCache();
	resetConfigCache();
	rmSync(dir, { recursive: true, force: true });
});

const NOW = new Date("2026-09-25T09:00:00Z");

/** A library with a patron, a book with a copy on loan, a print list and some audit rows. */
function library(name: string): { db: Db; actor: { id: number } } {
	const db = createTestDb();
	const actor = db
		.insert(staffUser)
		.values({ username: "admin", passwordHash: "x", roles: ["admin"] })
		.returning({ id: staffUser.id })
		.get();
	const rules = catalogRules(getConfig());
	const b = createBiblio(
		db,
		{
			title: `Libro ${name}`,
			subtitle: "",
			originalTitle: "",
			responsibility: "",
			author: "Rossi, Anna",
			publisher: "Einaudi",
			publicationPlace: "",
			publicationYear: "",
			isbn: "",
			issn: "",
			ean: "",
			physicalDescription: "",
			series: "",
			seriesNumber: "",
			dewey: "",
			kind: "fiction",
			genreCode: "B",
			classCode: "",
			readingLevel: "",
			subjects: "",
			notes: "",
		},
		actor,
		rules,
	);
	const { ids } = addItems(
		db,
		b,
		{
			callNumber: "",
			readingLevel: "",
			enumeration: "",
			acquisitionDate: "2020-01-01",
			notes: "",
			notForLoan: false,
		},
		1,
		actor,
		rules,
		NOW,
	);
	const p = createPatron(
		db,
		{
			patronType: "student",
			firstName: "Anna",
			lastName: `Utente ${name}`,
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
	checkoutItem(db, getConfig(), { patronId: p, itemId: ids[0] ?? 0 }, actor, NOW);
	const list = createPrintList(db, "patrons", `Lista ${name}`, actor, NOW);
	addEntries(db, list, [p], actor, NOW);
	return { db, actor };
}

function snapshot(db: Db, name: string): string {
	const path = join(dir, `${name}.db`);
	db.$client.run("VACUUM INTO ?", [path]);
	return path;
}

const titles = (db: Db): string[] =>
	db
		.select({ t: biblio.title })
		.from(biblio)
		.all()
		.map((r) => r.t);
const surnames = (db: Db): string[] =>
	db
		.select({ n: patron.lastName })
		.from(patron)
		.all()
		.map((r) => r.n);
const rows = (db: Db, table: typeof loan | typeof printList | typeof auditLog): number =>
	db
		.select({ n: sql<number>`count(*)` })
		.from(table)
		.get()?.n ?? 0;

describe("data parts", () => {
	it("puts every table of the database in a part or in the list of those that never travel", () => {
		const db = createTestDb();
		const tables = (
			db.$client
				.query("SELECT name FROM sqlite_master WHERE type = 'table' ORDER BY name")
				.all() as { name: string }[]
		).map((t) => t.name);
		const parted = tablesOfParts();
		const homeless = tables.filter(
			(t) => !parted.includes(t) && !TABLES_THAT_NEVER_TRAVEL.includes(t),
		);
		expect(homeless).toEqual([]);
		expect(parted.filter((t) => TABLES_THAT_NEVER_TRAVEL.includes(t))).toEqual([]);
		expect(parted.filter((t) => !tables.includes(t))).toEqual([]);
	});

	it("restores the patrons with their classes, even classes the live database lacks", () => {
		const source = library("archivio");
		createPatron(
			source.db,
			{
				patronType: "student",
				firstName: "Bruno",
				lastName: "Nuovo",
				levelCode: "5",
				groupId: String(classId(source.db, "5", "C")),
				groupName: "",
				cardNumber: "",
				externalId: "",
				email: "",
				circulationNote: "",
				notes: "",
			},
			source.actor,
			PATRON_RULES,
		);
		const path = snapshot(source.db, "classes");
		const { db } = library("vivo");
		const parts = ["patrons", "catalog", "loans", "printLists"] as const;
		expect(() => restoreDataParts(db, path, parts, { dryRun: true })).not.toThrow();
		restoreDataParts(db, path, parts);
		const placed = db
			.select({ name: classGroup.name, last: patron.lastName })
			.from(patron)
			.innerJoin(classGroup, eq(classGroup.id, patron.classGroupId))
			.where(eq(patron.lastName, "Nuovo"))
			.get();
		expect(placed).toEqual({ name: "C", last: "Nuovo" });
	});

	it("keeps the class pictures' rows with the photos part, and needs the patrons for them", () => {
		const { db } = library("A");
		const p = db.select({ id: patron.id }).from(patron).get()?.id ?? 0;
		const sheet = db
			.insert(classPhotoSheet)
			.values({ classGroupId: classId(db, "3", "A"), path: "x.jpg", width: 10, height: 10 })
			.returning({ id: classPhotoSheet.id })
			.get();
		db.insert(classPhotoFrame)
			.values({
				sheetId: sheet.id,
				position: 1,
				corners: [],
				cropPath: "f.webp",
				patronId: p,
			})
			.run();
		const withPhotos = snapshot(db, "with-photos");
		pruneSnapshot(withPhotos, ["patrons", "photos"]);
		const without = snapshot(db, "without-photos");
		pruneSnapshot(without, ["patrons"]);
		const count = (path: string): number => {
			const copy = createTestDb();
			copy.$client.run("ATTACH DATABASE ? AS c", [path]);
			return (
				copy.$client.query("SELECT COUNT(*) AS n FROM c.class_photo_frame").get() as {
					n: number;
				}
			).n;
		};
		expect([count(withPhotos), count(without)]).toEqual([1, 0]);
		// the photos alone into a library whose patrons are others: the frames point at nobody
		const other = library("vivo");
		other.db.$client.run("DELETE FROM loan_event");
		other.db.$client.run("DELETE FROM loan");
		other.db.$client.run("DELETE FROM print_list_entry");
		other.db.$client.run("DELETE FROM patron");
		let error: unknown = null;
		try {
			restoreDataParts(other.db, withPhotos, ["photos"]);
		} catch (e) {
			error = e;
		}
		expect((error as DataRestoreError).gaps).toEqual(
			expect.arrayContaining([expect.objectContaining({ part: "photos", needs: "patrons" })]),
		);
	});

	it("prunes a copy to the chosen parts, sessions and cache never kept", () => {
		const { db } = library("A");
		const path = snapshot(db, "catalogue-only");
		pruneSnapshot(path, ["catalog"]);
		const copy = createTestDb();
		copy.$client.run("ATTACH DATABASE ? AS c", [path]);
		const n = (t: string): number =>
			(copy.$client.query(`SELECT COUNT(*) AS n FROM c.${t}`).get() as { n: number }).n;
		expect([
			n("biblio"),
			n("item"),
			n("patron"),
			n("loan"),
			n("print_list"),
			n("audit_log"),
			n("session"),
		]).toEqual([1, 1, 0, 0, 0, 0, 0]);
		expect(n("sequence")).toBeGreaterThan(0);
	});

	it("replaces only the chosen parts of the live database", () => {
		const source = library("archivio");
		const path = snapshot(source.db, "full");
		const { db } = library("vivo");
		const auditBefore = rows(db, auditLog);
		restoreDataParts(db, path, ["patrons", "catalog", "loans", "printLists"]);
		expect(titles(db)).toEqual(["Libro archivio"]);
		expect(surnames(db)).toEqual(["Utente archivio"]);
		expect(rows(db, loan)).toBe(1);
		// the audit log was not chosen: as it was
		expect(rows(db, auditLog)).toBe(auditBefore);
		// the search index follows the catalogue
		expect(
			db.$client
				.query("SELECT rowid FROM biblio_fts WHERE biblio_fts MATCH 'archivio'")
				.all(),
		).toHaveLength(1);
	});

	it("restores the notable dates of the calendar on their own (9.25)", () => {
		const source = library("archivio");
		createCalendarEvent(
			source.db,
			{ title: "Concorso archivio", notes: "", startsOn: "2026-11-02", endsOn: "" },
			source.actor,
		);
		const path = snapshot(source.db, "dates");
		const live = library("vivo");
		createCalendarEvent(
			live.db,
			{ title: "Data viva", notes: "", startsOn: "2026-11-03", endsOn: "" },
			live.actor,
		);
		restoreDataParts(live.db, path, ["dates"]);
		expect(
			live.db
				.select({ t: calendarEvent.title })
				.from(calendarEvent)
				.all()
				.map((r) => r.t),
		).toEqual(["Concorso archivio"]);
		// the other parts as they were
		expect(titles(live.db)).toEqual(["Libro vivo"]);
	});

	it("refuses a selection that leaves loans without their patrons or copies", () => {
		const source = library("archivio");
		const path = snapshot(source.db, "full");
		// an archive without patrons: the live loans and lists would point at nobody
		for (const t of ["loan_event", "loan", "print_list_entry", "patron"]) {
			source.db.$client.run(`DELETE FROM ${t}`);
		}
		const empty = snapshot(source.db, "no-patrons");
		const { db } = library("vivo");
		let error: unknown = null;
		try {
			restoreDataParts(db, empty, ["patrons"]);
		} catch (e) {
			error = e;
		}
		expect(error).toBeInstanceOf(DataRestoreError);
		expect((error as DataRestoreError).gaps).toEqual(
			expect.arrayContaining([
				expect.objectContaining({ part: "loans", needs: "patrons" }),
				expect.objectContaining({ part: "printLists", needs: "patrons" }),
			]),
		);
		// nothing changed
		expect(surnames(db)).toEqual(["Utente vivo"]);
		// the same with a dry run of a consistent selection: checked, nothing written
		const plan = restoreDataParts(db, path, ["patrons", "catalog", "loans", "printLists"], {
			dryRun: true,
		});
		expect(plan.counts.patrons).toEqual({ live: 1, archive: 1 });
		expect(surnames(db)).toEqual(["Utente vivo"]);
	});

	it("adds the staff accounts the copy names, inactive, and refuses another structure", () => {
		const source = library("archivio");
		source.db
			.insert(staffUser)
			.values({ username: "vecchio", passwordHash: "x", roles: [] })
			.run();
		const old = source.db
			.select()
			.from(staffUser)
			.where(eq(staffUser.username, "vecchio"))
			.get();
		source.db.update(item).set({ notes: "x" }).run();
		source.db
			.update(biblio)
			.set({ updatedBy: old?.id ?? null })
			.run();
		const path = snapshot(source.db, "full");
		const { db } = library("vivo");
		restoreDataParts(db, path, ["catalog", "patrons", "loans", "printLists"]);
		expect(
			db.select().from(staffUser).where(eq(staffUser.username, "vecchio")).get()?.active,
		).toBe(0);

		const other = join(dir, "other.db");
		source.db.$client.run("VACUUM INTO ?", [other]);
		const odd = createTestDb();
		odd.$client.run("ATTACH DATABASE ? AS o", [other]);
		odd.$client.run("ALTER TABLE o.audit_log ADD COLUMN extra TEXT");
		odd.$client.run("DETACH DATABASE o");
		expect(() => restoreDataParts(db, other, ["audit"])).toThrow(DataRestoreError);
	});
});
