// SPDX-License-Identifier: GPL-3.0-or-later
// A MARC file as the catalogue import receives it (PLAN.md step 9.65): ISO 2709 or MARCXML,
// recognised from the bytes, and UNIMARC or MARC 21, recognised from the records' fields.
import { isDataField, parseIso2709, type MarcField, type MarcRecord } from "./iso2709.js";

export type MarcSyntax = "iso2709" | "marcxml";
export type MarcFlavour = "unimarc" | "marc21";

const ENTITIES: Record<string, string> = {
	amp: "&",
	lt: "<",
	gt: ">",
	quot: '"',
	apos: "'",
};

/** The text of an XML element: the five entities and the numeric references decoded. */
function decodeXml(text: string): string {
	return text.replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);/gi, (whole, ref: string) => {
		if (ref.startsWith("#x") || ref.startsWith("#X")) {
			return String.fromCodePoint(parseInt(ref.slice(2), 16));
		}
		if (ref.startsWith("#")) {
			return String.fromCodePoint(parseInt(ref.slice(1), 10));
		}
		return ENTITIES[ref.toLowerCase()] ?? whole;
	});
}

const attribute = (tag: string, name: string): string =>
	new RegExp(`\\b${name}\\s*=\\s*("([^"]*)"|'([^']*)')`)
		.exec(tag)
		?.slice(2)
		.find((x) => x !== undefined) ?? "";

/**
 * The records of a MARCXML document, with or without a namespace prefix (`marc:record`) and in
 * any order of the attributes; a record without a leader is skipped.
 */
export function parseMarcxml(text: string): MarcRecord[] {
	const records: MarcRecord[] = [];
	const recordRe = /<(?:[\w-]+:)?record\b[^>]*>([\s\S]*?)<\/(?:[\w-]+:)?record>/g;
	for (const m of text.matchAll(recordRe)) {
		const body = m[1] ?? "";
		const leader = /<(?:[\w-]+:)?leader\b[^>]*>([\s\S]*?)<\/(?:[\w-]+:)?leader>/.exec(body);
		if (!leader) {
			continue;
		}
		const fields: MarcField[] = [];
		const fieldRe =
			/<(?:[\w-]+:)?(controlfield|datafield)\b([^>]*)>([\s\S]*?)<\/(?:[\w-]+:)?\1>/g;
		for (const f of body.matchAll(fieldRe)) {
			const tag = attribute(f[2] ?? "", "tag");
			if (f[1] === "controlfield") {
				fields.push({ tag, value: decodeXml(f[3] ?? "") });
				continue;
			}
			const subfields: { code: string; value: string }[] = [];
			const subRe = /<(?:[\w-]+:)?subfield\b([^>]*)>([\s\S]*?)<\/(?:[\w-]+:)?subfield>/g;
			for (const s of (f[3] ?? "").matchAll(subRe)) {
				subfields.push({
					code: attribute(s[1] ?? "", "code"),
					value: decodeXml(s[2] ?? "").trim(),
				});
			}
			fields.push({
				tag,
				ind1: attribute(f[2] ?? "", "ind1") || " ",
				ind2: attribute(f[2] ?? "", "ind2") || " ",
				subfields,
			});
		}
		records.push({ leader: decodeXml(leader[1] ?? ""), fields });
	}
	return records;
}

/** ISO 2709 starts with the record length (five digits) and holds record terminators. */
function looksIso2709(bytes: Uint8Array): boolean {
	if (bytes.length < 25) {
		return false;
	}
	for (let i = 0; i < 5; i++) {
		const b = bytes[i] ?? 0;
		if (b < 0x30 || b > 0x39) {
			return false;
		}
	}
	return bytes.includes(0x1d);
}

/** A MARCXML document names the MARC21/slim namespace or holds `<record>` with a `<leader>`. */
function looksMarcxml(head: string): boolean {
	return (
		/MARC21\/slim/i.test(head) ||
		(/<(?:[\w-]+:)?record\b/.test(head) && /<(?:[\w-]+:)?leader\b/.test(head))
	);
}

/** The records of a MARC file, or null when the bytes are not MARC (a CSV, a spreadsheet). */
export function readMarcFile(
	bytes: Uint8Array,
): { syntax: MarcSyntax; records: MarcRecord[] } | null {
	if (looksIso2709(bytes)) {
		return { syntax: "iso2709", records: parseIso2709(bytes) };
	}
	const head = new TextDecoder("utf-8").decode(bytes.subarray(0, 4096));
	if (looksMarcxml(head)) {
		return { syntax: "marcxml", records: parseMarcxml(new TextDecoder("utf-8").decode(bytes)) };
	}
	return null;
}

/**
 * UNIMARC or MARC 21, from the fields the records hold: the title is 200 in UNIMARC and 245 in
 * MARC 21 (the copies 995 and 952); a file of the other kind's habits counts by majority.
 */
export function marcFlavour(records: readonly MarcRecord[]): MarcFlavour {
	let unimarc = 0;
	let marc21 = 0;
	for (const r of records) {
		for (const f of r.fields) {
			if (!isDataField(f)) {
				continue;
			}
			if (f.tag === "200" || f.tag === "995" || f.tag === "210") {
				unimarc++;
			} else if (f.tag === "245" || f.tag === "952" || f.tag === "264" || f.tag === "260") {
				marc21++;
			}
		}
	}
	return marc21 > unimarc ? "marc21" : "unimarc";
}
