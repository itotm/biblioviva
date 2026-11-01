// SPDX-License-Identifier: GPL-3.0-or-later
import { strFromU8, unzipSync } from "fflate";
import { describe, expect, it } from "vitest";
import { toCell } from "./cells.js";
import { CSV_BOM, csvField, toCsv } from "./csv.js";
import { exportBody, exportFileName, exportResponse } from "./index.js";
import { buildContentXml, ODS_MIMETYPE, toOds, xmlEscape } from "./ods.js";
import { exportTables, getExport, registerExport, searchParamsRecord } from "./registry.js";
import type { TableExport } from "./types.js";

const table: TableExport = {
	name: "patrons",
	timezone: "Europe/Rome",
	columns: [
		{ id: "surname", label: "Cognome", type: "string" },
		{ id: "loans", label: "Prestiti", type: "number" },
		{ id: "since", label: "Dal", type: "date" },
		{ id: "at", label: "Quando", type: "datetime" },
		{ id: "active", label: "Attivo", type: "boolean" },
	],
	rows: [
		{
			surname: 'D\'Angelo; "Anna"',
			loans: 3,
			since: "2026-09-01",
			at: "2026-09-19T22:30:00Z",
			active: true,
		},
		{
			surname: "=SUM(A1)",
			loans: null,
			since: new Date("2026-01-15T12:00:00Z"),
			at: null,
			active: 0,
		},
		{ surname: "line\nbreak", loans: "7", since: "not a date", at: "x", active: "true" },
	],
};

describe("cells", () => {
	it("normalises values by type in the library time zone", () => {
		expect(toCell(3.5, "number", "Europe/Rome")).toEqual({
			type: "number",
			text: "3.5",
			value: 3.5,
		});
		expect(toCell("abc", "number", "Europe/Rome").type).toBe("string");
		expect(toCell("2026-09-19T22:30:00Z", "date", "Europe/Rome").text).toBe("2026-09-20");
		expect(toCell("2026-09-19T22:30:00Z", "datetime", "Europe/Rome")).toEqual({
			type: "datetime",
			text: "2026-09-20 00:30",
			value: "2026-09-20T00:30:00",
		});
		expect(toCell(undefined, "string", "Europe/Rome")).toEqual({
			type: "string",
			text: "",
			value: null,
		});
		expect(toCell({ a: 1 }, "string", "Europe/Rome").text).toBe('{"a":1}');
		expect(toCell(1, "boolean", "Europe/Rome").value).toBe(true);
	});
});

describe("csv", () => {
	it("quotes and escapes fields, neutralises formulas", () => {
		expect(csvField("plain")).toBe("plain");
		expect(csvField("a;b")).toBe('"a;b"');
		expect(csvField('say "hi"')).toBe('"say ""hi"""');
		expect(csvField("=SUM(A1)")).toBe('"\'=SUM(A1)"');
		expect(csvField("+39 333")).toBe('"\'+39 333"');
		expect(csvField("@cmd")).toBe('"\'@cmd"');
		expect(csvField("-ciao")).toBe('"\'-ciao"');
		// a number stays a number
		expect(csvField("-3", "number")).toBe("-3");
		expect(csvField(" padded")).toBe('" padded"');
	});

	it("writes BOM, header, ; separator, CRLF and typed text", () => {
		const csv = toCsv(table);
		expect(csv.startsWith(CSV_BOM)).toBe(true);
		const lines = csv.slice(1).split("\r\n");
		expect(lines[0]).toBe("Cognome;Prestiti;Dal;Quando;Attivo");
		expect(lines[1]).toBe('"D\'Angelo; ""Anna""";3;2026-09-01;2026-09-20 00:30;true');
		expect(lines[2]).toBe('"\'=SUM(A1)";;2026-01-15;;false');
		expect(lines[3]).toBe('"line\nbreak";7;not a date;x;true');
		expect(lines[4]).toBe("");
	});
});

describe("ods", () => {
	it("zips mimetype first and uncompressed, with manifest and typed content", () => {
		const bytes = toOds(table);
		// local file header of the first entry: name "mimetype", method 0 (stored)
		expect(strFromU8(bytes.subarray(30, 38))).toBe("mimetype");
		expect(bytes[8]).toBe(0);
		const files = unzipSync(bytes);
		expect(Object.keys(files)).toEqual(["mimetype", "content.xml", "META-INF/manifest.xml"]);
		expect(strFromU8(files.mimetype!)).toBe(ODS_MIMETYPE);
		const content = strFromU8(files["content.xml"]!);
		expect(content).toContain('<table:table table:name="patrons">');
		expect(content).toContain('office:value-type="float" office:value="3"');
		expect(content).toContain('office:value-type="date" office:date-value="2026-09-01"');
		expect(content).toContain('office:date-value="2026-09-20T00:30:00"');
		expect(content).toContain('office:boolean-value="true"');
		expect(content).toContain(
			"<text:p>D&apos;Angelo; &quot;Anna&quot;</text:p>".replace("&apos;", "'"),
		);
		expect(content).toContain('style:column-width="45.0mm"');
		expect((content.match(/<table:table-row>/g) ?? []).length).toBe(4); // header + 3 rows
		expect(strFromU8(files["META-INF/manifest.xml"]!)).toContain(
			'manifest:full-path="content.xml"',
		);
	});

	it("escapes XML and sanitises the sheet name", () => {
		expect(xmlEscape('<a & "b">\u0001')).toBe("&lt;a &amp; &quot;b&quot;&gt;");
		expect(buildContentXml({ ...table, name: "a/b:c" })).toContain('table:name="a b c"');
	});
});

describe("export index", () => {
	it("names files with the local timestamp and builds the HTTP response", async () => {
		expect(
			exportFileName(
				"Prestiti aperti",
				"csv",
				new Date("2026-09-19T22:30:00Z"),
				"Europe/Rome",
			),
		).toBe("Prestiti-aperti-20260920-0030.csv");
		expect(exportFileName("***", "ods", new Date("2026-09-19T22:30:00Z"), "UTC")).toBe(
			"export-20260919-2230.ods",
		);
		const res = exportResponse(table, "csv", new Date("2026-09-19T10:00:00Z"));
		expect(res.headers.get("content-type")).toBe("text/csv; charset=utf-8");
		expect(res.headers.get("content-disposition")).toBe(
			'attachment; filename="patrons-20260919-1200.csv"',
		);
		expect(Number(res.headers.get("content-length"))).toBe(exportBody(table, "csv").byteLength);
		// Response.text() strips the BOM: check the raw bytes (EF BB BF)
		expect([...new Uint8Array(await res.arrayBuffer()).subarray(0, 3)]).toEqual([
			0xef, 0xbb, 0xbf,
		]);
		expect(exportResponse(table, "ods").headers.get("content-type")).toBe(ODS_MIMETYPE);
	});
});

describe("registry", () => {
	it("registers and looks up tables, flattens search params", () => {
		registerExport("demo", {
			permission: "reports",
			schema: { async: false } as never,
			build: () => table,
		});
		expect(getExport("demo")?.permission).toBe("reports");
		expect(getExport("nope")).toBeUndefined();
		expect(exportTables()).toContain("demo");
		expect(searchParamsRecord(new URLSearchParams("a=1&a=2&b=&format=csv"))).toEqual({
			a: "1",
			b: "",
			format: "csv",
		});
	});
});
