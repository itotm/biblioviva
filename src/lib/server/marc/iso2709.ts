// SPDX-License-Identifier: GPL-3.0-or-later
// ISO 2709 files (what `yaz-client -m` writes) split into records and parsed with marcjs into a
// small, typed shape the UNIMARC mapper reads (PLAN.md step 3.4, Appendix D).
import { Iso2709Parser } from "marcjs";

export interface ControlField {
	tag: string;
	value: string;
}

export interface DataField {
	tag: string;
	ind1: string;
	ind2: string;
	subfields: { code: string; value: string }[];
}

export type MarcField = ControlField | DataField;

export interface MarcRecord {
	leader: string;
	fields: MarcField[];
}

const RECORD_TERMINATOR = 0x1d;

/** Splits a file into the byte ranges of its records (the terminator ends each one). */
export function splitIso2709(bytes: Uint8Array): Uint8Array[] {
	const records: Uint8Array[] = [];
	let start = 0;
	for (let i = 0; i < bytes.length; i++) {
		if (bytes[i] === RECORD_TERMINATOR) {
			const chunk = bytes.subarray(start, i + 1);
			if (chunk.length > 24) {
				records.push(chunk);
			}
			start = i + 1;
		}
	}
	// a last record without terminator (truncated download) is still worth a try
	if (bytes.length - start > 24) {
		records.push(bytes.subarray(start));
	}
	return records;
}

export function isDataField(field: MarcField): field is DataField {
	return "subfields" in field;
}

function fromRaw(raw: string[]): MarcField | null {
	const [tag, ...rest] = raw;
	if (!tag) {
		return null;
	}
	if (rest.length === 1) {
		return { tag, value: rest[0] ?? "" };
	}
	const indicators = rest[0] ?? "  ";
	const subfields: { code: string; value: string }[] = [];
	for (let i = 1; i + 1 < rest.length; i += 2) {
		subfields.push({ code: rest[i] ?? "", value: (rest[i + 1] ?? "").trim() });
	}
	return { tag, ind1: indicators.charAt(0) || " ", ind2: indicators.charAt(1) || " ", subfields };
}

/** Parses every record of an ISO 2709 file; a record that cannot be parsed is skipped. */
export function parseIso2709(bytes: Uint8Array): MarcRecord[] {
	const out: MarcRecord[] = [];
	for (const chunk of splitIso2709(bytes)) {
		try {
			const record = Iso2709Parser.parse(Buffer.from(chunk));
			out.push({
				leader: record.leader,
				fields: record.fields.map(fromRaw).filter((f): f is MarcField => f !== null),
			});
		} catch {
			// malformed record: skip it, the others are still useful
		}
	}
	return out;
}

export function fieldsOf(record: MarcRecord, tag: string): DataField[] {
	return record.fields.filter((f): f is DataField => f.tag === tag && isDataField(f));
}

export function controlField(record: MarcRecord, tag: string): string | null {
	const f = record.fields.find((x) => x.tag === tag && !isDataField(x));
	return f && !isDataField(f) ? f.value.trim() : null;
}

export function subfield(field: DataField, code: string): string | null {
	const s = field.subfields.find((x) => x.code === code && x.value !== "");
	return s ? s.value : null;
}

export function subfieldsOf(field: DataField, code: string): string[] {
	return field.subfields.filter((x) => x.code === code && x.value !== "").map((x) => x.value);
}
