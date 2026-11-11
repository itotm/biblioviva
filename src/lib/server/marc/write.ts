// SPDX-License-Identifier: GPL-3.0-or-later
// MARC records written as files (PLAN.md step 9.65): ISO 2709 (the exchange format of Koha,
// SebinaNEXT, Clavis, in UTF-8) and MARCXML (the `MARC21/slim` schema, which Koha reads for UNIMARC
// too). Lengths are counted in bytes, as ISO 2709 wants.
import { isDataField, type MarcRecord } from "./iso2709.js";

const FIELD_TERMINATOR = "\x1e";
const RECORD_TERMINATOR = "\x1d";
const SUBFIELD_DELIMITER = "\x1f";

// the three separators (and every other control character) can never be part of a value
// eslint-disable-next-line no-control-regex -- the control characters are what it removes
const CONTROL = /[\u0000-\u001f\u007f]/g;
const clean = (value: string): string => value.replace(CONTROL, " ");

const encoder = new TextEncoder();
const byteLength = (text: string): number => encoder.encode(text).length;

/** The leader with the record's length and base address in place (`2` and `2` for the codes). */
function leaderOf(leader: string, recordLength: number, baseAddress: number): string {
	const base = leader.padEnd(24, " ").slice(0, 24);
	const length = String(recordLength).padStart(5, "0");
	const address = String(baseAddress).padStart(5, "0");
	return `${length}${base.slice(5, 10)}22${address}${base.slice(17, 20)}4500`;
}

/** One record in ISO 2709. */
export function iso2709Record(record: MarcRecord): string {
	let directory = "";
	let data = "";
	let offset = 0;
	for (const field of record.fields) {
		const subfields = isDataField(field)
			? field.subfields
					.filter((s) => s.value !== "")
					.map((s) => `${SUBFIELD_DELIMITER}${s.code}${clean(s.value)}`)
					.join("")
			: "";
		const body = isDataField(field)
			? `${field.ind1 || " "}${field.ind2 || " "}${subfields}${FIELD_TERMINATOR}`
			: `${clean(field.value)}${FIELD_TERMINATOR}`;
		const length = byteLength(body);
		directory +=
			field.tag.padStart(3, "0") +
			String(length).padStart(4, "0") +
			String(offset).padStart(5, "0");
		data += body;
		offset += length;
	}
	directory += FIELD_TERMINATOR;
	const baseAddress = 24 + directory.length;
	const recordLength = baseAddress + offset + 1;
	return (
		leaderOf(record.leader, recordLength, baseAddress) + directory + data + RECORD_TERMINATOR
	);
}

/** A file of records in ISO 2709, UTF-8. */
export function toIso2709(records: Iterable<MarcRecord>): Uint8Array {
	let text = "";
	for (const r of records) {
		text += iso2709Record(r);
	}
	return encoder.encode(text);
}

const XML_ESCAPES: Record<string, string> = {
	"&": "&amp;",
	"<": "&lt;",
	">": "&gt;",
	'"': "&quot;",
	"'": "&apos;",
};
const xml = (text: string): string => clean(text).replace(/[&<>"']/g, (c) => XML_ESCAPES[c] ?? c);

/** One `<record>` of MARCXML. */
export function marcxmlRecord(record: MarcRecord): string {
	const lines = ["  <record>", `    <leader>${xml(record.leader.padEnd(24, " "))}</leader>`];
	for (const field of record.fields) {
		if (isDataField(field)) {
			const subfields = field.subfields.filter((s) => s.value !== "");
			if (subfields.length === 0) {
				continue;
			}
			lines.push(
				`    <datafield tag="${xml(field.tag)}" ind1="${xml(field.ind1 || " ")}" ind2="${xml(field.ind2 || " ")}">`,
				...subfields.map(
					(s) => `      <subfield code="${xml(s.code)}">${xml(s.value)}</subfield>`,
				),
				"    </datafield>",
			);
		} else {
			lines.push(
				`    <controlfield tag="${xml(field.tag)}">${xml(field.value)}</controlfield>`,
			);
		}
	}
	lines.push("  </record>");
	return lines.join("\n");
}

/** A MARCXML collection. */
export function toMarcxml(records: Iterable<MarcRecord>): string {
	const parts = [
		'<?xml version="1.0" encoding="UTF-8"?>',
		'<collection xmlns="http://www.loc.gov/MARC21/slim">',
	];
	for (const r of records) {
		parts.push(marcxmlRecord(r));
	}
	parts.push("</collection>", "");
	return parts.join("\n");
}
