// SPDX-License-Identifier: GPL-3.0-or-later
import { describe, expect, it } from "vitest";
import {
	cleanIsbn,
	ean13Valid,
	isbn10To13,
	isbn10Valid,
	isbn13To10,
	isIsbnBarcode,
	normalizeIsbn,
	toIsbn13,
} from "./isbn.js";

describe("isbn", () => {
	it("validates EAN-13 check digits", () => {
		expect(ean13Valid("9788804668237")).toBe(true);
		expect(ean13Valid("9788804668238")).toBe(false);
		expect(ean13Valid("978880466823")).toBe(false);
	});

	it("validates and converts ISBN-10", () => {
		expect(isbn10Valid("8804668237")).toBe(true);
		expect(isbn10Valid("080442957X")).toBe(true);
		expect(isbn10Valid("8804668230")).toBe(false);
		expect(isbn10Valid("880466823")).toBe(false);
		expect(isbn10To13("8804668237")).toBe("9788804668237");
		expect(isbn13To10("9788804668237")).toBe("8804668237");
		expect(isbn13To10("9780804429573")).toBe("080442957X");
		expect(isbn13To10("9791220012349")).toBeNull();
	});

	it("normalises any valid form to ISBN-13", () => {
		expect(toIsbn13("978-88-04-66823-7")).toBe("9788804668237");
		expect(toIsbn13("88-04-66823-7")).toBe("9788804668237");
		expect(toIsbn13("080442957x")).toBe("9780804429573");
		expect(toIsbn13("1234")).toBeNull();
		expect(toIsbn13("9798804668237")).toBeNull();
		expect(cleanIsbn(" 88 04-x")).toBe("8804X");
	});

	it.each([
		["978-88-04-66823-7", "9788804668237"],
		["9788804668237", "9788804668237"],
		["88-04-66823-7", "9788804668237"],
		["080442957X", "9780804429573"],
		["0-8044-2957-x", "9780804429573"],
		["979-12-200-1234-9", null],
		["9791220012349", null],
		["9788804668238", null],
		["9788804668237 12345", null],
		["978880466823712345", null],
		["", null],
		["abc", null],
	])("normalizeIsbn(%s) → %s", (input, expected) => {
		expect(normalizeIsbn(input)).toBe(expected);
	});

	it("accepts a valid 979 ISBN-13 and refuses other EAN-13", () => {
		// 979-12-200-0000-x with a computed check digit
		const digits = "979122000000";
		let sum = 0;
		for (let i = 0; i < digits.length; i++) {
			sum += Number(digits[i]) * (i % 2 === 0 ? 1 : 3);
		}
		const isbn = digits + String((10 - (sum % 10)) % 10);
		expect(normalizeIsbn(isbn)).toBe(isbn);
		expect(isIsbnBarcode(isbn)).toBe(true);
		expect(isIsbnBarcode("9788804668237")).toBe(true);
		expect(isIsbnBarcode("9788804668238")).toBe(false);
		expect(isIsbnBarcode("4006381333931")).toBe(false);
	});
});
