// SPDX-License-Identifier: GPL-3.0-or-later
import { TEST_CODES } from "../../../../tests/helpers/codes.js";
import { PATRON_RULES, classId } from "../../../../tests/helpers/school.js";
import { eq } from "drizzle-orm";
import { describe, expect, it } from "vitest";
import { createTestDb } from "../../../../tests/helpers/db.js";
import { exampleRaw, parseConfig } from "#lib/server/config/load.js";
import type { AppConfig } from "#lib/server/config/schema.js";
import type { Db } from "#lib/server/db/client.js";
import { auditLog, item, loan, loanEvent, patron, staffUser } from "#lib/server/db/schema.js";
import { resolveScan } from "#lib/server/barcodes/lookup.js";
import { anonymizePatron } from "./anonymize.js";
import { catalogRules, createBiblio } from "./catalog.js";
import { addItems, setItemStatus } from "./catalog-items.js";
import {
	checkinItem,
	checkoutItem,
	deskPatron,
	markLoanLost,
	DeskNotFoundError,
	findDeskPatrons,
	renewAllLoans,
	renewInsteadOfReturn,
	renewLoan,
	undoCheckout,
} from "./circulation.js";
import { createPatron } from "./patrons.js";
const CODES = TEST_CODES;

const config = parseConfig(exampleRaw()).config;
const rules = catalogRules(config);
// Friday 25 September 2026, 10:00 in Rome
const NOW = new Date("2026-09-25T08:00:00Z");

interface Fixture {
	db: Db;
	actor: { id: number };
	student: number;
	teacher: number;
	studentCard: string;
	items: { id: number; barcode: string }[];
}

function setup(): Fixture {
	const db = createTestDb();
	const actor = db
		.insert(staffUser)
		.values({ username: "u", passwordHash: "x", roles: [] })
		.returning({ id: staffUser.id })
		.get();
	const person = (lastName: string, patronType: "student" | "teacher"): number =>
		createPatron(
			db,
			{
				patronType,
				firstName: "Anna",
				lastName,
				levelCode: patronType === "student" ? "3" : "",
				groupId: patronType === "student" ? String(classId(db, "3", "A")) : "",
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
	const studentCard =
		db.select({ c: patron.cardNumber }).from(patron).where(eq(patron.id, student)).get()?.c ??
		"";
	const record = createBiblio(
		db,
		{
			title: "Il gatto con gli stivali e altre storie di animali parlanti",
			subtitle: "",
			originalTitle: "",
			responsibility: "",
			author: "Perrault, Charles",
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
			readingLevel: "3",
			subjects: "",
			notes: "",
		},
		actor,
		rules,
	);
	const copy = {
		itemType: "libro",
		callNumber: "",
		readingLevel: "",
		enumeration: "",
		acquisitionDate: "",
		notes: "",
		notForLoan: false,
	};
	const added = addItems(db, record, copy, 3, actor, rules);
	return {
		db,
		actor,
		student,
		teacher,
		studentCard,
		items: added.ids.map((id, i) => ({ id, barcode: added.barcodes[i] ?? "" })),
	};
}

describe("desk patrons", () => {
	it("finds patrons by surname for the autocomplete", () => {
		const { db } = setup();
		expect(findDeskPatrons(db, "ros", "it").map((p) => p.lastName)).toEqual(["Rossi"]);
		expect(findDeskPatrons(db, "ro", "it")).toEqual([]);
	});
});

describe("checkout", () => {
	it("lends a copy with the calendar's due date, an issue event and snapshots", () => {
		const { db, actor, student, items } = setup();
		const r = checkoutItem(db, config, { patronId: student, itemId: items[0]!.id }, actor, NOW);
		expect(r).toMatchObject({
			ok: true,
			loan: { dueDate: "2026-10-12" },
			infos: [{ code: "calendar_closed_due_date", due: "2026-10-12" }],
		});
		const row = db.select().from(loan).get();
		expect(row).toMatchObject({
			patronId: student,
			levelSnapshot: "3",
			levelPositionSnapshot: 2,
			stageSnapshot: "primaria",
			groupSnapshot: "A",
			classLabelSnapshot: "3 A",
			schoolYear: "2026/2027",
			issuedBy: actor.id,
		});
		expect(
			db
				.select()
				.from(loanEvent)
				.all()
				.map((e) => e.type),
		).toEqual(["issue"]);
		const panel = deskPatron(db, config, student, "2026-09-25");
		expect(panel).toMatchObject({
			lastName: "Rossi",
			maxLoans: 1,
			loans: [{ barcode: items[0]!.barcode, overdue: false }],
		});
	});

	it("explains every refusal with the parameters of its message", () => {
		const { db, actor, student, teacher, items } = setup();
		checkoutItem(db, config, { patronId: student, itemId: items[0]!.id }, actor, NOW);
		// the student is at the limit of one book: the message names it
		expect(
			checkoutItem(db, config, { patronId: student, itemId: items[1]!.id }, actor, NOW),
		).toMatchObject({
			ok: false,
			reason: "loan_limit_reached",
			overridable: false,
			params: {
				n: 1,
				max: 1,
				name: "Anna Rossi",
				titles: "«Il gatto con gli stivali e altre storie…»",
			},
		});
		expect(
			checkoutItem(db, config, { patronId: teacher, itemId: items[0]!.id }, actor, NOW),
		).toMatchObject({
			reason: "item_on_loan_other_patron",
			params: { other: "Anna Rossi", date: "2026-09-25" },
		});
		const same = checkoutItem(
			db,
			config,
			{ patronId: student, itemId: items[0]!.id },
			actor,
			NOW,
		);
		expect(same).toMatchObject({ reason: "item_on_loan_same_patron" });
		expect(!same.ok && same.loanId).toBeGreaterThan(0);
		setItemStatus(db, items[2]!.id, "in_repair", null, actor);
		expect(
			checkoutItem(db, config, { patronId: teacher, itemId: items[2]!.id }, actor, NOW),
		).toMatchObject({
			reason: "item_status_unavailable",
			overridable: true,
			params: { status: "in_repair" },
		});
		expect(() =>
			checkoutItem(db, config, { patronId: 999, itemId: items[2]!.id }, actor, NOW),
		).toThrow(DeskNotFoundError);
		expect(() =>
			checkoutItem(db, config, { patronId: teacher, itemId: 999 }, actor, NOW),
		).toThrow(DeskNotFoundError);
	});

	it("refuses a removed patron, whose card is no longer found", () => {
		const { db, actor, student, studentCard, items } = setup();
		anonymizePatron(db, "/nonexistent", student, actor);
		expect(resolveScan(db, studentCard, CODES)).toMatchObject({ kind: "unknown" });
		expect(
			checkoutItem(db, config, { patronId: student, itemId: items[0]!.id }, actor, NOW),
		).toMatchObject({ ok: false, reason: "patron_anonymized", overridable: false });
		expect(findDeskPatrons(db, "rimosso", "it")).toEqual([]);
	});

	it("an override lends the copy and records the reason", () => {
		const { db, actor, teacher, items } = setup();
		setItemStatus(db, items[2]!.id, "in_repair", null, actor);
		const r = checkoutItem(
			db,
			config,
			{ patronId: teacher, itemId: items[2]!.id, override: { reason: "riparato ieri" } },
			actor,
			NOW,
		);
		expect(r.ok).toBe(true);
		const events = db.select().from(loanEvent).all();
		expect(events.map((e) => [e.type, e.details])).toEqual([
			["issue", null],
			["override", { reason: "riparato ieri" }],
		]);
		expect(
			db.select().from(auditLog).where(eq(auditLog.action, "loan.override")).all(),
		).toHaveLength(1);
	});

	it("reports the overdue loans as information and the hard due date", () => {
		const { db, actor, teacher, items } = setup();
		checkoutItem(
			db,
			config,
			{ patronId: teacher, itemId: items[0]!.id },
			actor,
			new Date("2026-08-01T08:00:00Z"),
		);
		const hard: AppConfig = {
			...config,
			circulation: { ...config.circulation, hardDueDate: "2026-10-01" },
		};
		const r = checkoutItem(db, hard, { patronId: teacher, itemId: items[1]!.id }, actor, NOW);
		expect(r).toMatchObject({
			ok: true,
			infos: [
				{ code: "hard_due_date_applied", due: "2026-10-01" },
				{ code: "patron_has_overdues", n: 1 },
			],
		});
	});
});

describe("undo and renewal", () => {
	it("undoes today's checkout only", () => {
		const { db, actor, student, items } = setup();
		const r = checkoutItem(db, config, { patronId: student, itemId: items[0]!.id }, actor, NOW);
		const loanId = r.ok ? r.loan.loanId : 0;
		expect(undoCheckout(db, config, loanId, actor, NOW)).toEqual({
			title: "Il gatto con gli stivali e altre storie…",
			name: "Anna Rossi",
		});
		expect(db.select().from(loan).all()).toHaveLength(0);
		expect(db.select().from(loanEvent).all()).toHaveLength(0);
		expect(
			db.select().from(auditLog).where(eq(auditLog.action, "loan.undo")).all(),
		).toHaveLength(1);
		const old = checkoutItem(
			db,
			config,
			{ patronId: student, itemId: items[0]!.id },
			actor,
			new Date("2026-09-20T08:00:00Z"),
		);
		expect(() => undoCheckout(db, config, old.ok ? old.loan.loanId : 0, actor, NOW)).toThrow(
			DeskNotFoundError,
		);
		expect(() => undoCheckout(db, config, 999, actor, NOW)).toThrow(DeskNotFoundError);
	});

	it("renews with a renew event until the limit", () => {
		const { db, actor, teacher, items } = setup();
		const r = checkoutItem(db, config, { patronId: teacher, itemId: items[0]!.id }, actor, NOW);
		const loanId = r.ok ? r.loan.loanId : 0;
		const renewed = renewLoan(db, config, { loanId }, actor, new Date("2026-10-05T08:00:00Z"));
		expect(renewed).toMatchObject({ ok: true, renewals: 1, dueDate: "2026-10-20" });
		expect(
			db.select().from(loanEvent).where(eq(loanEvent.type, "renew")).get()?.details,
		).toEqual({
			from: "2026-10-12",
			to: "2026-10-20",
		});
		db.update(loan).set({ renewals: 5 }).run();
		expect(renewLoan(db, config, { loanId }, actor, NOW)).toMatchObject({
			ok: false,
			reason: "renewal_limit_reached",
			params: { n: 5 },
		});
		expect(() => renewLoan(db, config, { loanId: 999 }, actor, NOW)).toThrow(DeskNotFoundError);
	});

	it("an administrator forces a renewal past the limit, with the reason logged", () => {
		const { db, actor, teacher, items } = setup();
		const r = checkoutItem(db, config, { patronId: teacher, itemId: items[0]!.id }, actor, NOW);
		const loanId = r.ok ? r.loan.loanId : 0;
		db.update(loan).set({ renewals: 5 }).run();
		const later = new Date("2026-10-05T08:00:00Z");
		expect(renewLoan(db, config, { loanId }, actor, later)).toMatchObject({
			ok: false,
			loanId,
			overridable: true,
		});
		expect(
			renewLoan(db, config, { loanId, override: { reason: "gita" } }, actor, later),
		).toMatchObject({ ok: true, renewals: 6, dueDate: "2026-10-20" });
		expect(
			db
				.select()
				.from(loanEvent)
				.all()
				.map((e) => [e.type, e.details]),
		).toEqual([
			["issue", null],
			["renew", { from: "2026-10-12", to: "2026-10-20" }],
			["override", { reason: "gita", renewal: true }],
		]);
		expect(
			db.select().from(auditLog).where(eq(auditLog.action, "loan.override")).all(),
		).toHaveLength(1);
	});

	it("renews all the loans of a patron, each with its own decision", () => {
		const { db, actor, teacher, items } = setup();
		for (const it of items) {
			checkoutItem(db, config, { patronId: teacher, itemId: it.id }, actor, NOW);
		}
		db.update(loan).set({ renewals: 5 }).where(eq(loan.itemId, items[2]!.id)).run();
		const results = renewAllLoans(db, config, teacher, actor, new Date("2026-10-05T08:00:00Z"));
		expect(results.map((r) => (r.ok ? "ok" : r.reason))).toEqual([
			"ok",
			"ok",
			"renewal_limit_reached",
		]);
		expect(() => renewAllLoans(db, config, 999, actor, NOW)).toThrow(DeskNotFoundError);
	});
});

describe("check-in", () => {
	it("returns a loan on time, then explains a second scan the same day", () => {
		const { db, actor, student, items } = setup();
		const r = checkoutItem(db, config, { patronId: student, itemId: items[0]!.id }, actor, NOW);
		const loanId = r.ok ? r.loan.loanId : 0;
		const back = checkinItem(db, config, items[0]!.id, actor, new Date("2026-09-28T09:00:00Z"));
		expect(back).toMatchObject({
			kind: "returned",
			wasLost: false,
			loan: {
				loanId,
				name: "Anna Rossi",
				classLabel: "3 A",
				issuedOn: "2026-09-25",
				dueDate: "2026-10-12",
				overdueDays: 0,
			},
		});
		const row = db.select().from(loan).where(eq(loan.id, loanId)).get();
		expect(row?.returnedAt).toBe("2026-09-28T09:00:00.000Z");
		expect(row?.returnedBy).toBe(actor.id);
		expect(
			db
				.select()
				.from(loanEvent)
				.all()
				.map((e) => e.type),
		).toEqual(["issue", "return"]);
		// 11:00 in Rome
		expect(
			checkinItem(db, config, items[0]!.id, actor, new Date("2026-09-28T10:00:00Z")),
		).toEqual({
			kind: "already_returned_today",
			itemId: items[0]!.id,
			title: "Il gatto con gli stivali e altre storie…",
			time: "11:00",
		});
		expect(
			checkinItem(db, config, items[0]!.id, actor, new Date("2026-09-29T09:00:00Z")),
		).toMatchObject({ kind: "not_on_loan", wasLost: false });
		expect(() => checkinItem(db, config, 999, actor, NOW)).toThrow(DeskNotFoundError);
	});

	it("reports the days late, information only", () => {
		const { db, actor, teacher, items } = setup();
		checkoutItem(db, config, { patronId: teacher, itemId: items[0]!.id }, actor, NOW);
		expect(
			checkinItem(db, config, items[0]!.id, actor, new Date("2026-10-20T09:00:00Z")),
		).toMatchObject({
			kind: "returned",
			loan: { dueDate: "2026-10-12", overdueDays: 8, patronOverdue: 0 },
		});
		// another loan still overdue after this return: the desk offers the reminder
		checkoutItem(db, config, { patronId: teacher, itemId: items[1]!.id }, actor, NOW);
		checkoutItem(db, config, { patronId: teacher, itemId: items[2]!.id }, actor, NOW);
		expect(
			checkinItem(db, config, items[1]!.id, actor, new Date("2026-10-20T09:00:00Z")),
		).toMatchObject({ loan: { patronOverdue: 1 } });
	});

	it("a lost copy comes back available, on loan or not", () => {
		const { db, actor, teacher, items } = setup();
		checkoutItem(db, config, { patronId: teacher, itemId: items[0]!.id }, actor, NOW);
		// data from before step 4.8 (or an import): lost while its loan is still open
		db.update(item).set({ status: "lost" }).where(eq(item.id, items[0]!.id)).run();
		setItemStatus(db, items[1]!.id, "lost", null, actor);
		expect(checkinItem(db, config, items[0]!.id, actor, NOW)).toMatchObject({
			kind: "returned",
			wasLost: true,
		});
		expect(checkinItem(db, config, items[1]!.id, actor, NOW)).toMatchObject({
			kind: "not_on_loan",
			wasLost: true,
		});
		const statuses = db
			.select({ s: item.status })
			.from(item)
			.all()
			.map((r) => r.s);
		expect(statuses).toEqual(["available", "available", "available"]);
		expect(
			db
				.select()
				.from(loanEvent)
				.all()
				.map((e) => e.type),
		).toEqual(["issue", "found", "return"]);
	});

	it("renews instead of returning, only for a return of today", () => {
		const { db, actor, teacher, items } = setup();
		const r = checkoutItem(db, config, { patronId: teacher, itemId: items[0]!.id }, actor, NOW);
		const loanId = r.ok ? r.loan.loanId : 0;
		const when = new Date("2026-10-05T08:00:00Z");
		checkinItem(db, config, items[0]!.id, actor, when);
		expect(renewInsteadOfReturn(db, config, loanId, actor, when)).toMatchObject({
			ok: true,
			renewals: 1,
			dueDate: "2026-10-20",
		});
		const row = db.select().from(loan).where(eq(loan.id, loanId)).get();
		expect(row).toMatchObject({ returnedAt: null, returnedBy: null, renewals: 1 });
		expect(
			db
				.select()
				.from(loanEvent)
				.all()
				.map((e) => e.type),
		).toEqual(["issue", "renew"]);
		// an open loan, or a return of another day, cannot be "renewed instead"
		expect(() => renewInsteadOfReturn(db, config, loanId, actor, when)).toThrow(
			DeskNotFoundError,
		);
		checkinItem(db, config, items[0]!.id, actor, when);
		expect(() =>
			renewInsteadOfReturn(db, config, loanId, actor, new Date("2026-10-06T08:00:00Z")),
		).toThrow(DeskNotFoundError);
		// on the day of the loan the return is simply taken back, no renewal is counted
		const other = checkoutItem(
			db,
			config,
			{ patronId: teacher, itemId: items[1]!.id },
			actor,
			when,
		);
		const otherId = other.ok ? other.loan.loanId : 0;
		checkinItem(db, config, items[1]!.id, actor, when);
		expect(renewInsteadOfReturn(db, config, otherId, actor, when)).toMatchObject({
			ok: true,
			renewals: 0,
			dueDate: "2026-10-20",
		});
		expect(db.select().from(loan).where(eq(loan.id, otherId)).get()?.returnedAt).toBeNull();
		// when the rules refuse, the return stays
		db.update(loan).set({ renewals: 5 }).where(eq(loan.id, loanId)).run();
		expect(renewInsteadOfReturn(db, config, loanId, actor, when)).toMatchObject({
			ok: false,
			reason: "renewal_limit_reached",
		});
		expect(db.select().from(loan).where(eq(loan.id, loanId)).get()?.returnedAt).not.toBeNull();
	});
});

describe("lost, damaged, withdrawn (step 4.8)", () => {
	it("a lost copy closes its loan, leaves the open loans and comes back at check-in", () => {
		const { db, actor, teacher, items } = setup();
		const r = checkoutItem(db, config, { patronId: teacher, itemId: items[0]!.id }, actor, NOW);
		const loanId = r.ok ? r.loan.loanId : 0;
		expect(markLoanLost(db, loanId, "perso in gita", actor, NOW)).toEqual({
			title: "Il gatto con gli stivali e altre storie…",
			patronId: teacher,
		});
		expect(db.select().from(item).where(eq(item.id, items[0]!.id)).get()?.status).toBe("lost");
		expect(db.select().from(loan).where(eq(loan.id, loanId)).get()?.returnedAt).not.toBeNull();
		expect(
			db
				.select()
				.from(loanEvent)
				.all()
				.map((e) => [e.type, e.details]),
		).toEqual([
			["issue", null],
			["lost", { reason: "perso in gita" }],
		]);
		expect(deskPatron(db, config, teacher, "2026-09-25").loans).toEqual([]);
		// a lost copy cannot be lent, an administrator may force it
		expect(
			checkoutItem(db, config, { patronId: teacher, itemId: items[0]!.id }, actor, NOW),
		).toMatchObject({ reason: "item_status_unavailable", overridable: true });
		expect(() => markLoanLost(db, loanId, null, actor, NOW)).toThrow(DeskNotFoundError);
		// found at the returns desk: available again, a found event on the lost loan
		expect(checkinItem(db, config, items[0]!.id, actor, NOW)).toMatchObject({
			kind: "not_on_loan",
			wasLost: true,
		});
		expect(db.select().from(item).where(eq(item.id, items[0]!.id)).get()?.status).toBe(
			"available",
		);
		expect(
			db
				.select()
				.from(loanEvent)
				.all()
				.map((e) => e.type),
		).toEqual(["issue", "lost", "found"]);
	});

	it("a withdrawn copy is never lent and a copy on loan cannot be withdrawn", () => {
		const { db, actor, teacher, items } = setup();
		checkoutItem(db, config, { patronId: teacher, itemId: items[0]!.id }, actor, NOW);
		expect(() => setItemStatus(db, items[0]!.id, "withdrawn", "vecchio", actor)).toThrow();
		setItemStatus(db, items[1]!.id, "withdrawn", "rovinato", actor);
		expect(
			checkoutItem(
				db,
				config,
				{ patronId: teacher, itemId: items[1]!.id, override: { reason: "prova" } },
				actor,
				NOW,
			),
		).toMatchObject({ ok: false, reason: "item_status_unavailable", overridable: false });
	});
});
