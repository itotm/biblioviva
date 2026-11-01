// SPDX-License-Identifier: GPL-3.0-or-later
import { existsSync, mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { eq, sql } from "drizzle-orm";
import { afterEach, describe, expect, it } from "vitest";
import { createTestDb } from "../../../../tests/helpers/db.js";
import { exampleRaw, parseConfig } from "#lib/server/config/load.js";
import { auditLog, biblio, item, loan, patron, staffUser } from "#lib/server/db/schema.js";
import {
	anonymizePatron,
	anonymizePatrons,
	openLoanCount,
	PatronHasOpenLoansError,
} from "./anonymize.js";
import { savePatronPhoto } from "./media.js";
import { createPatron, PatronNotFoundError } from "./patrons.js";
import { searchPatrons } from "./patron-search.js";
import type { Db } from "#lib/server/db/client.js";
import { classId, PATRON_RULES } from "../../../../tests/helpers/school.js";

const dirs: string[] = [];
const temp = (): string => {
	const d = mkdtempSync(join(tmpdir(), "bv-anon-"));
	dirs.push(d);
	return d;
};
afterEach(() => {
	for (const d of dirs.splice(0)) {
		rmSync(d, { recursive: true, force: true });
	}
});

const config = parseConfig(exampleRaw()).config;
const rules = PATRON_RULES;

async function seeded(): Promise<{ db: Db; dataDir: string; actor: { id: number }; id: number }> {
	const db = createTestDb();
	const dataDir = temp();
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
			lastName: "Verdi",
			levelCode: "3",
			groupId: String(classId(db, "3", "A")),
			groupName: "",
			cardNumber: "0000001240",
			externalId: "M1",
			email: "anna@example.org",
			circulationNote: "nota",
			notes: "note",
		},
		actor,
		rules,
	);
	await savePatronPhoto(
		db,
		dataDir,
		id,
		new Uint8Array(readFileSync("tests/fixtures/images/portrait-exif.jpg")),
		config.photos,
		actor,
	);
	return { db, dataDir, actor, id };
}

describe("anonymizePatron", () => {
	it("erases the personal data and the photo, keeps class and type, retires the card", async () => {
		const { db, dataDir, actor, id } = await seeded();
		const photo = db
			.select({ photoPath: patron.photoPath })
			.from(patron)
			.where(eq(patron.id, id))
			.get()!.photoPath!;
		expect(existsSync(join(dataDir, photo))).toBe(true);
		expect(anonymizePatron(db, dataDir, id, actor, new Date("2026-09-20T10:00:00Z"))).toBe(
			true,
		);
		const after = db.select().from(patron).where(eq(patron.id, id)).get()!;
		expect(after).toMatchObject({
			firstName: "Studente",
			lastName: `Rimosso #${id}`,
			searchName: `rimosso ${id} studente`,
			email: null,
			notes: null,
			circulationNote: null,
			externalId: null,
			cardNumber: null,
			photoPath: null,
			status: "anonymized",
			anonymizedAt: "2026-09-20T10:00:00.000Z",
			levelCode: "3",
			classGroupId: classId(db, "3", "A"),
			patronType: "student",
		});
		expect(existsSync(join(dataDir, photo))).toBe(false);
		expect(searchPatrons(db, { q: "verdi" }, "2026-09-19", "it").rows).toHaveLength(0);
		const rows = db.select().from(auditLog).all();
		const anon = rows.find((r) => r.action === "patron.anonymize");
		expect(anon?.details).toEqual({ patronType: "student" });
		expect(JSON.stringify(rows)).not.toContain("Verdi");
		// a second call changes nothing
		expect(anonymizePatron(db, dataDir, id, actor)).toBe(false);
	});

	it("refuses a patron with open loans and unknown ids", async () => {
		const { db, dataDir, actor, id } = await seeded();
		const b = db
			.insert(biblio)
			.values({ title: "T", author: "A", publisher: "P", kind: "fiction" })
			.returning({ id: biblio.id })
			.get();
		const it1 = db
			.insert(item)
			.values({ biblioId: b.id, barcode: "2026-00011", itemType: "book" })
			.returning({ id: item.id })
			.get();
		db.insert(loan)
			.values({
				itemId: it1.id,
				patronId: id,
				dueDate: "2026-10-01",
				patronTypeSnapshot: "student",
				schoolYear: "2026/2027",
			})
			.run();
		expect(openLoanCount(db, id)).toBe(1);
		expect(() => anonymizePatron(db, dataDir, id, actor)).toThrow(PatronHasOpenLoansError);
		expect(db.select().from(patron).where(eq(patron.id, id)).get()?.status).toBe("active");
		expect(() => anonymizePatron(db, dataDir, 999, actor)).toThrow(PatronNotFoundError);
	});

	it("removes a selection one by one, keeping those with open loans, and leaves the class statistics untouched", async () => {
		const { db, dataDir, actor, id } = await seeded();
		const other = createPatron(
			db,
			{
				patronType: "student",
				firstName: "Bruno",
				lastName: "Neri",
				levelCode: "3",
				groupId: "",
				groupName: "A",
				cardNumber: "",
				externalId: "",
				email: "",
				circulationNote: "",
				notes: "",
			},
			actor,
			rules,
		);
		const b = db
			.insert(biblio)
			.values({ title: "T", author: "A", publisher: "P", kind: "fiction" })
			.returning({ id: biblio.id })
			.get();
		const it1 = db
			.insert(item)
			.values({ biblioId: b.id, barcode: "2026-00011", itemType: "book" })
			.returning({ id: item.id })
			.get();
		db.insert(loan)
			.values({
				itemId: it1.id,
				patronId: other,
				dueDate: "2026-10-01",
				patronTypeSnapshot: "student",
				schoolYear: "2026/2027",
			})
			.run();
		// what the statistics see (Phase 7): loans with their class snapshots, patrons per class/type
		const stats = (): {
			loansByClass: { c: string | null; g: number | null; n: number }[];
			patronsByClass: { c: string | null; g: number | null; t: string; n: number }[];
		} => ({
			loansByClass: db
				.select({
					c: loan.levelSnapshot,
					g: loan.groupIdSnapshot,
					n: sql<number>`count(*)`,
				})
				.from(loan)
				.groupBy(loan.levelSnapshot, loan.groupIdSnapshot)
				.all(),
			patronsByClass: db
				.select({
					c: patron.levelCode,
					g: patron.classGroupId,
					t: patron.patronType,
					n: sql<number>`count(*)`,
				})
				.from(patron)
				.groupBy(patron.levelCode, patron.classGroupId, patron.patronType)
				.all(),
		});
		const before = stats();

		const result = anonymizePatrons(db, dataDir, [id, other, 999, id], actor);
		expect(result).toEqual({ removed: [id], keptOpenLoans: [other], skipped: [999] });
		expect(anonymizePatrons(db, dataDir, [id], actor)).toEqual({
			removed: [],
			keptOpenLoans: [],
			skipped: [id],
		});
		expect(stats()).toEqual(before);
	});
});
