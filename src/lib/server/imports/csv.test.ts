// SPDX-License-Identifier: GPL-3.0-or-later
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { csvField } from "#lib/server/export/csv.js";
import { cleanCell, decodeCsvBytes, parseCsv, readCsv, writeCsv } from "./csv.js";

const fixture = (name: string): Uint8Array<ArrayBuffer> =>
	new Uint8Array(readFileSync(`tests/fixtures/import/${name}`));

describe("csv reading", () => {
	it("decodes UTF-8 (with or without BOM) and falls back to Windows-1252", () => {
		expect(decodeCsvBytes(fixture("students.csv")).encoding).toBe("utf-8");
		const bom = decodeCsvBytes(fixture("bom.csv"));
		expect(bom.encoding).toBe("utf-8");
		expect(bom.text.startsWith("first_name")).toBe(true);
		const legacy = readCsv(fixture("windows1252.csv"));
		expect(legacy.encoding).toBe("windows-1252");
		expect(legacy.delimiter).toBe(",");
		expect(legacy.rows[1]).toEqual(["Niccolò", "D'Amico", "2", "B"]);
		expect(legacy.rows[2]).toEqual(["Zoë", "Müller", "3", "A"]);
	});

	it("guesses the delimiter, trims cells and drops blank lines", () => {
		const semicolon = readCsv(fixture("students.csv"));
		expect(semicolon.delimiter).toBe(";");
		expect(semicolon.rows).toHaveLength(5);
		expect(semicolon.lines).toEqual([1, 2, 3, 5, 6]);
		expect(semicolon.rows[3]).toEqual(["Niccolò", "D'Amico", "2", "B"]);
		const comma = readCsv(fixture("students-external-id.csv"));
		expect(comma.delimiter).toBe(",");
		expect(comma.rows[0]).toEqual([
			"external_id",
			"first_name",
			"last_name",
			"level",
			"section",
		]);
		expect(parseCsv(" a ;b \n").rows).toEqual([["a", "b"]]);
		expect(parseCsv("solo\nuna\n").delimiter).toBe(";");
		expect(parseCsv("").rows).toEqual([]);
	});

	it("writes ; separated rows with a BOM for spreadsheets", () => {
		const out = writeCsv([
			["first_name", "last_name"],
			["Zoë", "D'Amico; jr"],
		]);
		expect(out.startsWith("﻿")).toBe(true);
		expect(out).toContain("first_name;last_name\r\n");
		expect(out).toContain('"D\'Amico; jr"');
		expect(parseCsv(out.slice(1)).rows[1]).toEqual(["Zoë", "D'Amico; jr"]);
	});

	it("drops control characters and the apostrophe the exports put before a formula", () => {
		expect(cleanCell("  Ro\u0000ssi\u001B ")).toBe("Rossi");
		expect(cleanCell("riga uno\nriga due")).toBe("riga uno\nriga due");
		expect(cleanCell("'=SUM(A1)")).toBe("=SUM(A1)");
		expect(cleanCell("'-ciao")).toBe("-ciao");
		expect(cleanCell("D'Amico")).toBe("D'Amico");
		expect(cleanCell("'Ndrangheta")).toBe("'Ndrangheta");
	});

	it("writes the template headers safe for spreadsheets", () => {
		expect(writeCsv([["=cmd"]])).toContain("'=cmd");
	});

	it("reads back what the exports write", () => {
		const exported = ["=SUM(A1)", "-ciao", "+39 333", "@x"].map((t) => csvField(t)).join(";");
		expect(parseCsv(exported).rows[0]).toEqual(["=SUM(A1)", "-ciao", "+39 333", "@x"]);
	});
});
