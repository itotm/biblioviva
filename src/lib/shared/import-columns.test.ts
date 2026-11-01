// SPDX-License-Identifier: GPL-3.0-or-later
import { describe, expect, it } from "vitest";
import {
	CATALOG_IMPORT,
	defaultTemplate,
	fieldOfHeader,
	headerKey,
	headerMapping,
	isComplete,
	LOAN_IMPORT,
	missingColumns,
	missingHeaders,
	STUDENT_IMPORT,
	TEACHER_IMPORT,
	templateHeader,
} from "./import-columns.js";

describe("import columns (Q115)", () => {
	it("reads a header without case, spaces or hyphens, and only by its English name", () => {
		expect(headerKey(" First-Name ")).toBe("first_name");
		expect(headerKey("﻿card number")).toBe("card_number");
		expect(fieldOfHeader(STUDENT_IMPORT, "LAST NAME")).toBe("lastName");
		expect(fieldOfHeader(STUDENT_IMPORT, "cognome")).toBeNull();
		expect(fieldOfHeader(TEACHER_IMPORT, "class")).toBeNull();
		expect(fieldOfHeader(CATALOG_IMPORT, "biblionumber")).toBeNull();
	});

	it("takes a first row as a header from two known names, a field feeding its first column", () => {
		expect(headerMapping(STUDENT_IMPORT, ["first_name", "last_name", "notes"])).toEqual([
			"firstName",
			"lastName",
			null,
		]);
		expect(headerMapping(STUDENT_IMPORT, ["first_name", "first_name", "class"])).toEqual([
			"firstName",
			null,
			"class",
		]);
		expect(headerMapping(STUDENT_IMPORT, ["Giulia", "Rossi", "class"])).toBeNull();
		expect(headerMapping(CATALOG_IMPORT, ["title"])).toEqual(["title"]);
		expect(headerMapping(CATALOG_IMPORT, ["Il gatto"])).toBeNull();
	});

	it("says what is missing: the required columns and one complete alternative", () => {
		expect(missingColumns(STUDENT_IMPORT, ["firstName", "lastName", "class"])).toEqual({
			fields: [],
			alternatives: [],
		});
		expect(
			isComplete(
				missingColumns(STUDENT_IMPORT, ["firstName", "lastName", "level", "section"]),
			),
		).toBe(true);
		expect(missingColumns(STUDENT_IMPORT, ["firstName", "level"])).toEqual({
			fields: ["lastName"],
			alternatives: [["class"], ["level", "section"]],
		});
		expect(missingHeaders(STUDENT_IMPORT, ["firstName", "level"])).toBe(
			"last_name, class | level + section",
		);
		expect(missingHeaders(TEACHER_IMPORT, ["firstName", "lastName"])).toBeNull();
		expect(missingHeaders(LOAN_IMPORT, ["barcode"])).toBe("card_number");
		expect(missingHeaders(CATALOG_IMPORT, ["title", "author"])).toBe("publisher");
	});

	it("builds the template header from a valid choice only, in the catalogue's order", () => {
		expect(defaultTemplate(STUDENT_IMPORT)).toEqual(["first_name", "last_name", "class"]);
		expect(defaultTemplate(TEACHER_IMPORT)).toEqual(["first_name", "last_name"]);
		expect(defaultTemplate(CATALOG_IMPORT)).toEqual(["title", "author", "publisher"]);
		expect(defaultTemplate(LOAN_IMPORT)).toEqual(["card_number", "barcode"]);
		expect(
			templateHeader(STUDENT_IMPORT, [
				"email",
				"section",
				"level",
				"last_name",
				"first_name",
			]),
		).toEqual(["first_name", "last_name", "level", "section", "email"]);
		expect(templateHeader(STUDENT_IMPORT, ["first_name", "last_name"])).toBeNull();
		// the two ways of giving the class are never mixed
		expect(
			templateHeader(STUDENT_IMPORT, [
				"first_name",
				"last_name",
				"class",
				"level",
				"section",
			]),
		).toBeNull();
		expect(
			templateHeader(STUDENT_IMPORT, ["first_name", "last_name", "class", "nome"]),
		).toBeNull();
		expect(templateHeader(LOAN_IMPORT, ["card_number", "barcode", "due_on"])).toEqual([
			"card_number",
			"barcode",
			"due_on",
		]);
	});
});
