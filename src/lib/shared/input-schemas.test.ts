// SPDX-License-Identifier: GPL-3.0-or-later
import * as v from "valibot";
import { describe, expect, it } from "vitest";
import {
	base64Image,
	configCode,
	configCodeOrEmpty,
	dbId,
	dbIds,
	draftCode,
	entryId,
	groupOrListSchema,
	isoDay,
	isoDayOrEmpty,
	levelCode,
	levelCodeOrEmpty,
	patronSetSchema,
	scannedCode,
	textId,
	uploadedFile,
	uploadId,
} from "./input-schemas.js";

const ok = (schema: v.GenericSchema, value: unknown): boolean => v.safeParse(schema, value).success;

describe("ids", () => {
	it("accepts integers from 1 only", () => {
		expect(ok(dbId, 1)).toBe(true);
		expect(ok(dbId, 0)).toBe(false);
		expect(ok(dbId, -3)).toBe(false);
		expect(ok(dbId, 1.5)).toBe(false);
		expect(ok(dbId, "1")).toBe(false);
	});

	it("bounds a list of ids", () => {
		expect(ok(dbIds(2), [1, 2])).toBe(true);
		expect(ok(dbIds(2), [1, 2, 3])).toBe(false);
		expect(ok(dbIds(2), [1, 0])).toBe(false);
	});

	it("reads an id of a form as digits", () => {
		expect(ok(textId, "42")).toBe(true);
		expect(ok(textId, "4a")).toBe(false);
		expect(ok(textId, "")).toBe(false);
	});
});

describe("uploadedFile", () => {
	it("accepts any Blob", () => {
		expect(ok(uploadedFile, new Blob(["x"]))).toBe(true);
		expect(ok(uploadedFile, new File(["x"], "a.png"))).toBe(true);
		expect(ok(uploadedFile, "a.png")).toBe(false);
	});
});

describe("isoDay", () => {
	it("is a real month and day", () => {
		expect(ok(isoDay, "2026-09-14")).toBe(true);
		expect(ok(isoDay, "2026-13-01")).toBe(false);
		expect(ok(isoDay, "2026-9-14")).toBe(false);
		expect(ok(isoDay, "")).toBe(false);
		expect(ok(isoDayOrEmpty, "")).toBe(true);
		expect(ok(isoDayOrEmpty, "2026-09-14")).toBe(true);
	});
});

describe("codes", () => {
	it("keeps a level to 8 letters, digits or dashes", () => {
		expect(ok(levelCode, "3")).toBe(true);
		expect(ok(levelCode, "1-2")).toBe(true);
		expect(ok(levelCode, "123456789")).toBe(false);
		expect(ok(levelCode, "3 B")).toBe(false);
		expect(ok(levelCode, "")).toBe(false);
		expect(ok(levelCodeOrEmpty, "")).toBe(true);
		expect(ok(levelCodeOrEmpty, "3.1")).toBe(false);
	});

	it("keeps a configuration code to 32 safe characters", () => {
		expect(ok(configCode, "primaria")).toBe(true);
		expect(ok(configCode, "dvd.blu-ray_2")).toBe(true);
		expect(ok(configCode, "a".repeat(33))).toBe(false);
		expect(ok(configCode, "con spazio")).toBe(false);
		expect(ok(configCode, "")).toBe(false);
		expect(ok(configCodeOrEmpty, "")).toBe(true);
	});

	it("leaves a code of a draft loose for the plan to explain, within 64 characters", () => {
		expect(ok(draftCode, "con spazio")).toBe(true);
		expect(ok(draftCode, "")).toBe(true);
		expect(ok(draftCode, "a".repeat(65))).toBe(false);
	});

	it("starts an entry id with a letter or a digit, without dots", () => {
		expect(ok(entryId, "sbn")).toBe(true);
		expect(ok(entryId, "A4-70x48")).toBe(true);
		expect(ok(entryId, "-sbn")).toBe(false);
		expect(ok(entryId, "sbn.it")).toBe(false);
		expect(ok(entryId, "a".repeat(33))).toBe(false);
	});
});

describe("scannedCode", () => {
	it("trims the reading and leaves its case to the recognition", () => {
		expect(v.parse(scannedCode, "  c0000123x\r\n")).toBe("c0000123x");
		expect(v.parse(scannedCode, "2026-e0267")).toBe("2026-e0267");
		expect(ok(scannedCode, "x".repeat(65))).toBe(false);
	});
});

describe("base64Image", () => {
	it("accepts base64 without the data: prefix", () => {
		expect(ok(base64Image, "iVBORw0KGgo=")).toBe(true);
		expect(ok(base64Image, "data:image/png;base64,iVBORw0KGgo=")).toBe(false);
	});
});

describe("uploadId", () => {
	it("is the id of a staged file", () => {
		expect(ok(uploadId, "0f8e2c4a-1b2c-4d5e-8f90-123456789abc")).toBe(true);
		expect(ok(uploadId, "../config")).toBe(false);
	});
});

describe("patron sets", () => {
	it("names a class, the patrons without one or a list", () => {
		expect(ok(patronSetSchema, { group: 3 })).toBe(true);
		expect(ok(patronSetSchema, { group: null })).toBe(true);
		expect(ok(patronSetSchema, { list: 2 })).toBe(true);
		expect(ok(patronSetSchema, { list: 0 })).toBe(false);
	});

	it("keeps class pictures to a class or a list", () => {
		expect(ok(groupOrListSchema, { group: 3 })).toBe(true);
		expect(ok(groupOrListSchema, { list: 2 })).toBe(true);
		expect(ok(groupOrListSchema, { group: null })).toBe(false);
	});
});
