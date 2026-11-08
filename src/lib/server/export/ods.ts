// SPDX-License-Identifier: GPL-3.0-or-later
// ODS writer (§3.19) with fflate: `mimetype` stored first and uncompressed (OpenDocument requirement),
// `content.xml` with typed cells and column widths, `META-INF/manifest.xml`. Opens in LibreOffice
// and the other spreadsheet programs.
import { strToU8, zipSync } from "fflate";
import { toCell } from "./cells.js";
import type { ExportColumnType, TableExport } from "./types.js";

export const ODS_MIMETYPE = "application/vnd.oasis.opendocument.spreadsheet";

const DEFAULT_WIDTH_MM: Record<ExportColumnType, number> = {
	string: 45,
	number: 22,
	date: 26,
	datetime: 36,
	boolean: 18,
};

export function xmlEscape(text: string): string {
	return (
		text
			.replace(/&/g, "&amp;")
			.replace(/</g, "&lt;")
			.replace(/>/g, "&gt;")
			.replace(/"/g, "&quot;")
			// eslint-disable-next-line no-control-regex
			.replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, "")
	);
}

function sheetName(name: string): string {
	return xmlEscape(name.replace(/[\\/?*[\]:']/g, " ").slice(0, 31) || "Sheet1");
}

export function buildContentXml(table: TableExport): string {
	const cols = table.columns;
	const styles = cols
		.map(
			(c, i) =>
				`<style:style style:name="co${i + 1}" style:family="table-column"><style:table-column-properties style:column-width="${(c.widthMm ?? DEFAULT_WIDTH_MM[c.type ?? "string"]).toFixed(1)}mm"/></style:style>`,
		)
		.join("");
	const headerStyle =
		'<style:style style:name="ceHead" style:family="table-cell" style:parent-style-name="Default"><style:text-properties fo:font-weight="bold"/></style:style>';
	const dateStyle =
		'<number:date-style style:name="N36"><number:year number:style="long"/><number:text>-</number:text><number:month number:style="long"/><number:text>-</number:text><number:day number:style="long"/></number:date-style>' +
		'<style:style style:name="ceDate" style:family="table-cell" style:parent-style-name="Default" style:data-style-name="N36"/>' +
		'<number:date-style style:name="N37"><number:year number:style="long"/><number:text>-</number:text><number:month number:style="long"/><number:text>-</number:text><number:day number:style="long"/><number:text> </number:text><number:hours number:style="long"/><number:text>:</number:text><number:minutes number:style="long"/></number:date-style>' +
		'<style:style style:name="ceDateTime" style:family="table-cell" style:parent-style-name="Default" style:data-style-name="N37"/>';

	const columnsXml = cols
		.map((_, i) => `<table:table-column table:style-name="co${i + 1}"/>`)
		.join("");
	const headerXml = `<table:table-row>${cols
		.map(
			(c) =>
				`<table:table-cell table:style-name="ceHead" office:value-type="string"><text:p>${xmlEscape(c.label)}</text:p></table:table-cell>`,
		)
		.join("")}</table:table-row>`;

	const rowsXml: string[] = [];
	for (const row of table.rows) {
		const cells = cols.map((c) => {
			const cell = toCell(row[c.id], c.type ?? "string", table.timezone);
			if (cell.value === null) {
				return "<table:table-cell/>";
			}
			switch (cell.type) {
				case "number":
					return `<table:table-cell office:value-type="float" office:value="${cell.value}"><text:p>${cell.text}</text:p></table:table-cell>`;
				case "boolean":
					return `<table:table-cell office:value-type="boolean" office:boolean-value="${cell.value}"><text:p>${cell.text}</text:p></table:table-cell>`;
				case "date":
					return `<table:table-cell table:style-name="ceDate" office:value-type="date" office:date-value="${cell.value}"><text:p>${cell.text}</text:p></table:table-cell>`;
				case "datetime":
					return `<table:table-cell table:style-name="ceDateTime" office:value-type="date" office:date-value="${cell.value}"><text:p>${cell.text}</text:p></table:table-cell>`;
				case "string":
					return `<table:table-cell office:value-type="string"><text:p>${xmlEscape(cell.text)}</text:p></table:table-cell>`;
			}
		});
		rowsXml.push(`<table:table-row>${cells.join("")}</table:table-row>`);
	}

	return (
		'<?xml version="1.0" encoding="UTF-8"?>' +
		'<office:document-content xmlns:office="urn:oasis:names:tc:opendocument:xmlns:office:1.0" ' +
		'xmlns:style="urn:oasis:names:tc:opendocument:xmlns:style:1.0" ' +
		'xmlns:text="urn:oasis:names:tc:opendocument:xmlns:text:1.0" ' +
		'xmlns:table="urn:oasis:names:tc:opendocument:xmlns:table:1.0" ' +
		'xmlns:fo="urn:oasis:names:tc:opendocument:xmlns:xsl-fo-compatible:1.0" ' +
		'xmlns:number="urn:oasis:names:tc:opendocument:xmlns:datastyle:1.0" ' +
		'office:version="1.3">' +
		`<office:automatic-styles>${styles}${headerStyle}${dateStyle}</office:automatic-styles>` +
		"<office:body><office:spreadsheet>" +
		`<table:table table:name="${sheetName(table.name)}">${columnsXml}${headerXml}${rowsXml.join("")}</table:table>` +
		"</office:spreadsheet></office:body></office:document-content>"
	);
}

export const ODS_MANIFEST =
	'<?xml version="1.0" encoding="UTF-8"?>' +
	'<manifest:manifest xmlns:manifest="urn:oasis:names:tc:opendocument:xmlns:manifest:1.0" manifest:version="1.3">' +
	`<manifest:file-entry manifest:full-path="/" manifest:version="1.3" manifest:media-type="${ODS_MIMETYPE}"/>` +
	'<manifest:file-entry manifest:full-path="content.xml" manifest:media-type="text/xml"/>' +
	"</manifest:manifest>";

export function toOds(table: TableExport): Uint8Array {
	// insertion order = zip entry order: `mimetype` must be first and stored (level 0)
	return zipSync(
		{
			mimetype: [strToU8(ODS_MIMETYPE), { level: 0 }],
			"content.xml": strToU8(buildContentXml(table)),
			"META-INF/manifest.xml": strToU8(ODS_MANIFEST),
		},
		{ level: 6 },
	);
}
