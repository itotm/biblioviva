// SPDX-License-Identifier: GPL-3.0-or-later
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { createTestDb, sequenceValue } from "../../../../tests/helpers/db.js";
import { openDatabase } from "#lib/server/db/client.js";
import { runMigrations } from "#lib/server/db/migrate.js";
import { biblio, item, patron, staffUser } from "#lib/server/db/schema.js";
import { createPatron, getPatron, reassignCard } from "#lib/server/services/patrons.js";
import { checkCharacter } from "#lib/shared/barcodes/check.js";
import { buildCodeTable } from "#lib/shared/barcodes/table.js";
import { recognise } from "#lib/shared/scan.js";
import { nextCardNumber } from "./cards.js";
import { sequenceName, shapeGlob } from "./counters.js";
import { nextItemBarcode } from "./items.js";
import { BarcodeError, renderBarcodeSvg } from "./render.js";
import { cardCode, itemCode, TEST_CODES, FORMATS_2026 } from "../../../../tests/helpers/codes.js";
import { classId, PATRON_RULES } from "../../../../tests/helpers/school.js";

const dirs: string[] = [];
afterEach(() => {
	for (const d of dirs.splice(0)) {
		rmSync(d, { recursive: true, force: true });
	}
});

const input = {
	patronType: "student" as const,
	firstName: "Anna",
	lastName: "Rossi",
	levelCode: "3",
	groupId: "",
	groupName: "A",
	cardNumber: "",
	externalId: "",
	email: "",
	circulationNote: "",
	notes: "",
};
const rules = PATRON_RULES;

describe("card numbers", () => {
	it("continue above the stored numbers of the same shape and of the older formats", () => {
		const db = createTestDb();
		const teacher = (cardNumber: string): void => {
			db.insert(patron)
				.values({ firstName: "a", lastName: "b", patronType: "teacher", cardNumber })
				.run();
		};
		// an old 10-digit card and a plain one of another shape
		teacher("0000001240");
		teacher("K-77");
		const first = nextCardNumber(db, TEST_CODES, "afterLegacyMax", 2026);
		expect(first).toBe(cardCode(1241));
		expect(recognise(first, TEST_CODES).kind).toBe("card");
		teacher(first);
		expect(nextCardNumber(db, TEST_CODES, "afterLegacyMax", 2026)).toBe(cardCode(1242));
		// an explicit start pushes the counter forward, never back
		expect(nextCardNumber(db, TEST_CODES, 500_000, 2026)).toBe(cardCode(500_000));
		expect(nextCardNumber(db, TEST_CODES, 10, 2026)).toBe(cardCode(500_001));
		expect(sequenceValue(db, sequenceName("card", TEST_CODES.card.current, null))).toBe(
			500_001,
		);
	});

	it("follow the formats of 2026 the same way", () => {
		const db = createTestDb();
		const classic = buildCodeTable(FORMATS_2026);
		db.insert(patron)
			.values({
				firstName: "a",
				lastName: "b",
				patronType: "teacher",
				cardNumber: "0000001240",
			})
			.run();
		const first = nextCardNumber(db, classic, "afterLegacyMax", 2026);
		expect(first).toMatch(/^\d{10}$/);
		expect(checkCharacter("luhn", first.slice(0, -1))).toBe(first.at(-1));
		expect(Number(first.slice(0, 9))).toBe(1241);
	});

	it("ignore older numbers too large for the new counter", () => {
		const db = createTestDb();
		db.insert(patron)
			.values({
				firstName: "a",
				lastName: "b",
				patronType: "teacher",
				cardNumber: "9000001240",
			})
			.run();
		expect(nextCardNumber(db, TEST_CODES, "afterLegacyMax", 2026)).toBe(cardCode(1));
	});
});

describe("copy barcodes", () => {
	it("count per year, above the old codes of the same year", () => {
		const db = createTestDb();
		const actor = db
			.insert(staffUser)
			.values({ username: "u", passwordHash: "x", roles: [] })
			.returning({ id: staffUser.id })
			.get();
		const biblioId = db
			.insert(biblio)
			.values({ title: "T", author: "A", publisher: "P", kind: "fiction" })
			.returning({ id: biblio.id })
			.get().id;
		const copy = (barcode: string): void => {
			db.insert(item).values({ biblioId, barcode }).run();
		};
		copy("2026-0042");
		copy("2025-0900");
		copy(itemCode(2026, 7));
		expect(nextItemBarcode(db, TEST_CODES, 2026)).toBe(itemCode(2026, 43));
		expect(nextItemBarcode(db, TEST_CODES, 2025)).toBe(itemCode(2025, 901));
		expect(nextItemBarcode(db, TEST_CODES, 2027)).toBe(itemCode(2027, 1));
		expect(sequenceName("item", TEST_CODES.item.current, 2026)).toBe("item:YYYY-CNNNN:2026");
		expect(shapeGlob(TEST_CODES.item.current, 2026)).toBe(
			"2026-[ABCDEFGHJKLMNPRSTUVWXYZ][0-9][0-9][0-9][0-9]",
		);
		expect(actor.id).toBeGreaterThan(0);
	});
});

describe("patron cards", () => {
	it("assigns a number on creation, reassigns retiring the old one, never reuses it", () => {
		const db = createTestDb();
		const actor = db
			.insert(staffUser)
			.values({ username: "u", passwordHash: "x", roles: [] })
			.returning({ id: staffUser.id })
			.get();
		classId(db, "3", "A");
		const id = createPatron(db, input, actor, rules);
		const first = getPatron(db, id, "2026-09-19").cardNumber ?? "";
		expect(recognise(first, TEST_CODES).kind).toBe("card");
		const explicit = createPatron(db, { ...input, cardNumber: "0000009999" }, actor, rules);
		expect(getPatron(db, explicit, "2026-09-19").cardNumber).toBe("0000009999");
		const reassigned = reassignCard(db, id, actor, rules);
		expect(reassigned).not.toBe(first);
		// above the old card 0000009999
		expect(reassigned).toBe(cardCode(10_000));
		expect(getPatron(db, id, "2026-09-19")).toMatchObject({
			cardNumber: reassigned,
			cardPrintedAt: null,
		});
		// the retired number is gone from the table and the sequence never returns to it
		const next = createPatron(db, input, actor, rules);
		expect(getPatron(db, next, "2026-09-19").cardNumber).not.toBe(first);
		expect(getPatron(db, next, "2026-09-19").cardNumber).toBe(cardCode(10_001));
		expect(() => reassignCard(db, 999, actor, rules)).toThrow();
	});

	it("stays unique when two connections create patrons concurrently", async () => {
		const dir = mkdtempSync(join(tmpdir(), "bv-cards-"));
		dirs.push(dir);
		mkdirSync(join(dir, "db"));
		const path = join(dir, "db", "test.db");
		const a = openDatabase(path);
		runMigrations(a);
		const b = openDatabase(path);
		const actor = a
			.insert(staffUser)
			.values({ username: "u", passwordHash: "x", roles: [] })
			.returning({ id: staffUser.id })
			.get();
		classId(a, "3", "A");
		writeFileSync(join(dir, "marker"), "");
		const results = await Promise.all(
			Array.from({ length: 40 }, (_, i) =>
				Promise.resolve().then(() => {
					const db = i % 2 === 0 ? a : b;
					return getPatron(
						db,
						createPatron(db, { ...input, firstName: `P${i}` }, actor, rules),
						"2026-09-19",
					).cardNumber;
				}),
			),
		);
		expect(new Set(results).size).toBe(40);
		expect(results.every((c) => c !== null && recognise(c, TEST_CODES).kind === "card")).toBe(
			true,
		);
		a.$client.close();
		b.$client.close();
	});
});

describe("renderBarcodeSvg", () => {
	it("renders Code 128, Code 39 and EAN-13 as SVG with the text", () => {
		const svg = renderBarcodeSvg("0000001240");
		expect(svg.startsWith("<svg")).toBe(true);
		expect(svg).toContain("viewBox=");
		expect(svg).toMatch(/<path stroke="#000000"/);
		// the human-readable text is drawn as glyph paths: without it the image is shorter
		const withoutText = renderBarcodeSvg("0000001240", { text: false });
		const height = (s: string): number => Number(/viewBox="0 0 \d+ (\d+)"/.exec(s)?.[1]);
		expect(height(withoutText)).toBeLessThan(height(svg));
		const code39 = renderBarcodeSvg("2026-0042", { symbology: "code39", text: false });
		expect(code39).not.toBe(svg);
		expect(renderBarcodeSvg("9788804668237", { symbology: "ean13" })).toContain("<svg");
		expect(() => renderBarcodeSvg("è", {})).toThrow(BarcodeError);
		expect(() => renderBarcodeSvg("abc", { symbology: "code39" })).toThrow(BarcodeError);
		expect(() => renderBarcodeSvg("12", { symbology: "ean13" })).toThrow(BarcodeError);
	});

	it("writes the fixtures decoded by the browser test", () => {
		// tests/fixtures/barcodes/*.svg are regenerated here and decoded in scanner.svelte.spec.ts
		mkdirSync("tests/fixtures/barcodes", { recursive: true });
		writeFileSync(
			"tests/fixtures/barcodes/card-code128.svg",
			renderBarcodeSvg("0001000018", { scale: 3 }),
		);
		writeFileSync(
			"tests/fixtures/barcodes/item-code39.svg",
			renderBarcodeSvg("2026-0042", { symbology: "code39", scale: 3 }),
		);
		writeFileSync(
			"tests/fixtures/barcodes/isbn-ean13.svg",
			renderBarcodeSvg("9788804668237", { symbology: "ean13", scale: 3 }),
		);
		expect(true).toBe(true);
	});
});
