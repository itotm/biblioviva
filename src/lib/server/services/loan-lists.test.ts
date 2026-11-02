// SPDX-License-Identifier: GPL-3.0-or-later
import { eq } from "drizzle-orm";
import { describe, expect, it } from "vitest";
import { createTestDb } from "../../../../tests/helpers/db.js";
import { exampleRaw, parseConfig } from "#lib/server/config/load.js";
import { auditLog, loanEvent, staffUser } from "#lib/server/db/schema.js";
import { catalogRules, createBiblio } from "./catalog.js";
import { addItems, setItemStatus } from "./catalog-items.js";
import { checkinItem, checkoutItem } from "./circulation.js";
import {
	markNoticesPrinted,
	openLoanCount,
	openLoanFilterOptions,
	openLoanRows,
	ReceiptError,
	receiptData,
	recordLoanHistory,
	todayActivity,
} from "./loan-lists.js";
import { anonymizePatron } from "./anonymize.js";
import { createPatron, getPatron } from "./patrons.js";
import { patronHistory } from "./loan-lists.js";
import { classId, PATRON_RULES, teacherGroupId } from "../../../../tests/helpers/school.js";

const config = parseConfig(exampleRaw()).config;
const rules = catalogRules(config);

function setup(): {
	db: ReturnType<typeof createTestDb>;
	actor: { id: number };
	student: number;
	teacher: number;
	items: number[];
	biblioId: number;
} {
	const db = createTestDb();
	const actor = db
		.insert(staffUser)
		.values({ username: "u", passwordHash: "x", roles: [] })
		.returning({ id: staffUser.id })
		.get();
	const person = (lastName: string, type: "student" | "teacher"): number =>
		createPatron(
			db,
			{
				patronType: type,
				firstName: "Anna",
				lastName,
				levelCode: type === "student" ? "2" : "",
				groupId: type === "student" ? String(classId(db, "2", "B")) : "",
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
	const student = person("Rossi", "student");
	const teacher = person("Verdi", "teacher");
	const record = createBiblio(
		db,
		{
			title: "Pinocchio",
			subtitle: "",
			originalTitle: "",
			responsibility: "",
			author: "Collodi, Carlo",
			publisher: "Giunti",
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
	const added = addItems(
		db,
		record,
		{
			callNumber: "",
			readingLevel: "",
			enumeration: "",
			acquisitionDate: "",
			notes: "",
			notForLoan: false,
		},
		3,
		actor,
		rules,
	);
	// the student borrowed on 1 September (due 16), the teacher on 1 and 20 October
	checkoutItem(
		db,
		config,
		{ patronId: student, itemId: added.ids[0] ?? 0 },
		actor,
		new Date("2026-09-01T08:00:00Z"),
	);
	checkoutItem(
		db,
		config,
		{ patronId: teacher, itemId: added.ids[1] ?? 0 },
		actor,
		new Date("2026-10-01T08:00:00Z"),
	);
	checkoutItem(
		db,
		config,
		{ patronId: teacher, itemId: added.ids[2] ?? 0 },
		actor,
		new Date("2026-10-20T08:00:00Z"),
	);
	return { db, actor, student, teacher, items: added.ids, biblioId: record };
}

describe("open loans", () => {
	it("lists the open loans with class, delay and filters", () => {
		const { db, student, teacher } = setup();
		const today = "2026-10-21";
		const all = openLoanRows(db, today);
		expect(all.map((r) => [r.lastName, r.dueDate, r.daysOverdue])).toEqual([
			["Rossi", "2026-09-16", 35],
			["Verdi", "2026-10-16", 5],
			["Verdi", "2026-11-04", 0],
		]);
		expect(all[0]).toMatchObject({
			groupId: classId(db, "2", "B"),
			groupName: "B",
			classLabel: "2 B",
			levelPosition: 1,
			title: "Pinocchio",
			lastNoticeAt: null,
		});
		expect(openLoanCount(db)).toBe(all.length);
		expect(openLoanRows(db, today, { overdueOnly: true })).toHaveLength(2);
		expect(openLoanRows(db, today, { patronType: "teacher" })).toHaveLength(2);
		expect(openLoanRows(db, today, { groupId: classId(db, "2", "B") })).toHaveLength(1);
		expect(openLoanRows(db, today, { levelCode: "2" })).toHaveLength(1);
		expect(openLoanRows(db, today, { levelCode: "3" })).toHaveLength(0);
		expect(openLoanRows(db, today, { patronId: student })).toHaveLength(1);
		expect(openLoanRows(db, today, { q: "verd" }).every((r) => r.patronId === teacher)).toBe(
			true,
		);
		const barcode = all[0]?.barcode ?? "";
		expect(openLoanRows(db, today, { q: barcode }).map((r) => r.barcode)).toEqual([barcode]);
		expect(openLoanFilterOptions(db)).toEqual({
			groups: [
				{ id: classId(db, "2", "B"), label: "2 B" },
				{ id: teacherGroupId(db), label: "Docenti" },
			],
		});
	});

	it("searches the patrons as the patron search does, and takes no text as a wildcard", () => {
		const { db, student } = setup();
		const today = "2026-10-21";
		const card = getPatron(db, student, "2026-09-19")?.cardNumber ?? "";
		expect(card).not.toBe("");
		expect(openLoanRows(db, today, { q: card }).map((r) => r.patronId)).toEqual([student]);
		expect(openLoanRows(db, today, { q: "rossianna" }).map((r) => r.patronId)).toEqual([
			student,
		]);
		const barcode = openLoanRows(db, today)[0]?.barcode ?? "";
		expect(openLoanRows(db, today, { q: barcode.slice(0, 5) })).toHaveLength(3);
		expect(openLoanRows(db, today, { q: "%" })).toEqual([]);
		expect(openLoanRows(db, today, { q: `_${barcode.slice(1, 4)}` })).toEqual([]);
	});

	it("marks the notices printed on open loans only", () => {
		const { db, actor, items } = setup();
		const today = "2026-10-21";
		const rows = openLoanRows(db, today);
		checkinItem(db, config, items[2] ?? 0, actor, new Date("2026-10-21T08:00:00Z"));
		const marked = markNoticesPrinted(
			db,
			rows.map((r) => r.loanId),
			actor,
			new Date("2026-10-21T09:00:00Z"),
		);
		expect(marked).toBe(2);
		expect(
			db.select().from(loanEvent).where(eq(loanEvent.type, "notice_printed")).all(),
		).toHaveLength(2);
		expect(openLoanRows(db, today)[0]?.lastNoticeAt).toBe("2026-10-21T09:00:00.000Z");
		expect(
			db.select().from(auditLog).where(eq(auditLog.action, "loan.notices_printed")).get()
				?.details,
		).toEqual({ count: 2 });
		expect(markNoticesPrinted(db, [], actor)).toBe(0);
	});

	it("the last notice and the lost outcome belong to their own loan, with ids that differ", () => {
		const { db, actor, items, biblioId } = setup();
		// events outnumber loans, so event ids and loan ids never coincide
		const rows = openLoanRows(db, "2026-10-21");
		const marked = rows[1]?.loanId ?? 0;
		markNoticesPrinted(db, [marked], actor, new Date("2026-10-21T09:00:00Z"));
		const after = openLoanRows(db, "2026-10-21");
		expect(after.filter((r) => r.lastNoticeAt !== null).map((r) => r.loanId)).toEqual([marked]);
		setItemStatus(db, items[2] ?? 0, "lost", null, actor);
		const outcomes = recordLoanHistory(db, biblioId, "2026-10-21").map((h) => h.outcome);
		expect(outcomes.filter((o) => o === "lost")).toHaveLength(1);
	});

	it("collects the loans of a receipt for one patron", () => {
		const { db } = setup();
		const rows = openLoanRows(db, "2026-10-21");
		const teacherLoans = rows
			.filter((r) => r.lastName === "Verdi")
			.map((r) => r.loanId)
			.reverse();
		const receipt = receiptData(db, teacherLoans);
		expect(receipt.patron).toMatchObject({ lastName: "Verdi", patronType: "teacher" });
		expect(receipt.rows.map((r) => r.dueDate)).toEqual(["2026-11-04", "2026-10-16"]);
		expect(() =>
			receiptData(
				db,
				rows.map((r) => r.loanId),
			),
		).toThrow(ReceiptError);
		expect(() => receiptData(db, [999])).toThrow(ReceiptError);
	});

	it("the history of a record keeps the class of the day and the anonymized names", () => {
		const { db, actor, student, items, biblioId } = setup();
		checkinItem(db, config, items[0] ?? 0, actor, new Date("2026-09-20T08:00:00Z"));
		anonymizePatron(db, "/nonexistent", student, actor);
		const history = recordLoanHistory(db, biblioId, "2026-10-21");
		expect(history.map((h) => [h.name, h.classLabel, h.outcome])).toEqual([
			["Anna Verdi", "", "open"],
			["Anna Verdi", "", "overdue"],
			[`Studente Rimosso #${student}`, "2 B", "returnedLate"],
		]);
		expect(recordLoanHistory(db, 999, "2026-10-21")).toEqual([]);
		// a copy marked lost closes the loan: the history says "lost", the patron page lists it
		const open = openLoanRows(db, "2026-10-21").find((r) => r.lastName === "Verdi");
		setItemStatus(db, open?.itemId ?? 0, "lost", null, actor);
		expect(recordLoanHistory(db, biblioId, "2026-10-21").map((h) => h.outcome)).toContain(
			"lost",
		);
		const teacher = getPatron(db, open?.patronId ?? 0, "2026-10-21");
		expect(teacher.lostItems.map((l) => l.itemId)).toEqual([open?.itemId]);
		expect(
			patronHistory(db, open?.patronId ?? 0, "2026-10-21").map((h) => h.outcome),
		).toContain("lost");
	});

	it("lists today's checkouts and returns in the library's zone", () => {
		const { db, actor, items } = setup();
		// 23:30 in Rome on 19 October is still the 19th there
		checkinItem(db, config, items[1] ?? 0, actor, new Date("2026-10-19T21:30:00Z"));
		checkinItem(db, config, items[2] ?? 0, actor, new Date("2026-10-20T06:00:00Z"));
		const day = todayActivity(db, "2026-10-20", "Europe/Rome");
		expect(day.issued.map((r) => r.name)).toEqual(["Anna Verdi"]);
		expect(day.returned.map((r) => r.at)).toEqual(["2026-10-20T06:00:00.000Z"]);
		expect(todayActivity(db, "2026-10-19", "Europe/Rome").returned).toHaveLength(1);
	});
});
