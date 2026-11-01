// SPDX-License-Identifier: GPL-3.0-or-later
// marcjs 3.0.2 ships no type declarations: only the parser entry point the app uses (step 3.4).
declare module "marcjs" {
	/** `[tag, value]` for control fields, `[tag, indicators, code, value, code, value, …]` otherwise. */
	export type RawField = string[];

	export class Record {
		leader: string;
		fields: RawField[];
	}

	/** Parses exactly one ISO 2709 record (leader, directory, fields) from its bytes. */
	export const Iso2709Parser: { parse(data: Buffer): Record };
}
