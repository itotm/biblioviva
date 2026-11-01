// SPDX-License-Identifier: GPL-3.0-or-later
// Code patterns (PLAN.md Phase 12, Q90): a format is a row of fixed-width tokens, never a free
// regex, so every format has a known length and a known set of characters at every position —
// which is what makes two formats comparable (compare.ts).
//
//   YYYY, YY   calendar year of creation          N…N   zero-padded counter (one run)
//   C          check character (check.ts)          {lib} the library code (barcodes.libraryCode)
//   0-9, -     literal digits and dashes           'AB'  literal upper-case letters, quoted
import { checkAlphabet, checkCharacter, CODE_LETTERS, type CheckAlgorithm } from "./check.js";

export type FormatCheck = CheckAlgorithm | "none";

/** A format as written in the configuration. */
export interface FormatDef {
	pattern: string;
	check: FormatCheck;
}

export type PatternErrorCode =
	| "empty"
	| "tooLong"
	| "badToken"
	| "badLetter"
	| "unclosedQuote"
	| "year"
	| "twoYears"
	| "twoCounters"
	| "noCounter"
	| "twoChecks"
	| "checkWithoutAlgorithm"
	| "algorithmWithoutCheck"
	| "noLibraryCode"
	| "badLibraryCode";

export class PatternError extends Error {
	constructor(
		readonly code: PatternErrorCode,
		readonly pattern: string,
	) {
		super(`pattern "${pattern}": ${code}`);
		this.name = "PatternError";
	}
}

export const MAX_CODE_LENGTH = 24;

/** What may stand at one position of a code. */
export type Slot =
	| { type: "digit"; role: "year" | "counter" | "check" | "literal" }
	| { type: "letter"; role: "check"; letters: string }
	| { type: "char"; role: "literal" | "library"; char: string };

export interface CompiledFormat {
	def: FormatDef;
	slots: Slot[];
	length: number;
	/** Start and length of the year digits, when the pattern has a year. */
	year: { start: number; length: 2 | 4 } | null;
	/** Start and length of the counter, when the pattern has one. */
	counter: { start: number; length: number } | null;
	/** Position of the check character. */
	check: number | null;
}

export interface CompileOptions {
	/** `barcodes.libraryCode`, required when the pattern has `{lib}`. */
	libraryCode?: string;
	/** Legacy formats may have no counter (a fixed shape of digits). */
	counterOptional?: boolean;
}

function isCodeLetter(c: string): boolean {
	return c.length === 1 && CODE_LETTERS.includes(c);
}

/** Parses and checks a pattern; throws `PatternError` with a code the editor can translate. */
export function compileFormat(def: FormatDef, options: CompileOptions = {}): CompiledFormat {
	const p = def.pattern;
	if (!p) {
		throw new PatternError("empty", p);
	}
	const slots: Slot[] = [];
	let year: CompiledFormat["year"] = null;
	let counter: CompiledFormat["counter"] = null;
	let check: number | null = null;
	let i = 0;
	while (i < p.length) {
		const c = p.charAt(i);
		if (c === "Y") {
			let n = 0;
			while (p[i + n] === "Y") {
				n++;
			}
			if (n !== 2 && n !== 4) {
				throw new PatternError("year", p);
			}
			if (year) {
				throw new PatternError("twoYears", p);
			}
			year = { start: slots.length, length: n };
			for (let k = 0; k < n; k++) {
				slots.push({ type: "digit", role: "year" });
			}
			i += n;
		} else if (c === "N") {
			let n = 0;
			while (p[i + n] === "N") {
				n++;
			}
			if (counter) {
				throw new PatternError("twoCounters", p);
			}
			counter = { start: slots.length, length: n };
			for (let k = 0; k < n; k++) {
				slots.push({ type: "digit", role: "counter" });
			}
			i += n;
		} else if (c === "C") {
			if (check !== null) {
				throw new PatternError("twoChecks", p);
			}
			if (def.check === "none") {
				throw new PatternError("checkWithoutAlgorithm", p);
			}
			check = slots.length;
			slots.push(
				def.check === "mod23"
					? { type: "letter", role: "check", letters: checkAlphabet("mod23") }
					: { type: "digit", role: "check" },
			);
			i++;
		} else if (/\d/.test(c)) {
			slots.push({ type: "char", role: "literal", char: c });
			i++;
		} else if (c === "-") {
			slots.push({ type: "char", role: "literal", char: "-" });
			i++;
		} else if (c === "'") {
			const end = p.indexOf("'", i + 1);
			if (end < 0) {
				throw new PatternError("unclosedQuote", p);
			}
			const letters = p.slice(i + 1, end);
			if (!letters || !Array.from(letters).every(isCodeLetter)) {
				throw new PatternError("badLetter", p);
			}
			for (const l of letters) {
				slots.push({ type: "char", role: "literal", char: l });
			}
			i = end + 1;
		} else if (p.startsWith("{lib}", i)) {
			const code = options.libraryCode ?? "";
			if (!code) {
				throw new PatternError("noLibraryCode", p);
			}
			if (!Array.from(code).every((l) => /\d/.test(l) || isCodeLetter(l))) {
				throw new PatternError("badLibraryCode", p);
			}
			for (const l of code) {
				slots.push({ type: "char", role: "library", char: l });
			}
			i += "{lib}".length;
		} else {
			throw new PatternError("badToken", p);
		}
	}
	if (def.check !== "none" && check === null) {
		throw new PatternError("algorithmWithoutCheck", p);
	}
	if (!counter && !options.counterOptional) {
		throw new PatternError("noCounter", p);
	}
	if (slots.length > MAX_CODE_LENGTH) {
		throw new PatternError("tooLong", p);
	}
	return { def, slots, length: slots.length, year, counter, check };
}

/** Whether a character may stand at a slot. */
export function slotAccepts(slot: Slot, c: string): boolean {
	switch (slot.type) {
		case "digit":
			return c >= "0" && c <= "9" && c.length === 1;
		case "letter":
			return slot.letters.includes(c);
		case "char":
			return slot.char === c;
	}
}

/** Same length and every character allowed at its position (the check value is not verified). */
export function matchesShape(format: CompiledFormat, code: string): boolean {
	if (code.length !== format.length) {
		return false;
	}
	for (let i = 0; i < code.length; i++) {
		const slot = format.slots[i];
		if (!slot || !slotAccepts(slot, code.charAt(i))) {
			return false;
		}
	}
	return true;
}

/** The digits the check is computed on: every digit of the code but the check, in order. */
export function payloadDigits(format: CompiledFormat, code: string): string {
	let out = "";
	for (let i = 0; i < code.length; i++) {
		const c = code.charAt(i);
		if (i !== format.check && /\d/.test(c)) {
			out += c;
		}
	}
	return out;
}

/** True when the check character is right (always true for a format without one). */
export function checkValid(format: CompiledFormat, code: string): boolean {
	if (format.check === null || format.def.check === "none") {
		return true;
	}
	const digits = payloadDigits(format, code);
	return digits !== "" && checkCharacter(format.def.check, digits) === code[format.check];
}

/** Right shape and right check character. */
export function isValidCode(format: CompiledFormat, code: string): boolean {
	return matchesShape(format, code) && checkValid(format, code);
}

/** The counter's value in a code of this format (null without a counter). */
export function counterOf(format: CompiledFormat, code: string): number | null {
	if (!format.counter) {
		return null;
	}
	return Number(code.slice(format.counter.start, format.counter.start + format.counter.length));
}

/** The year written in a code of this format (two-digit years are read as 20YY). */
export function yearOf(format: CompiledFormat, code: string): number | null {
	if (!format.year) {
		return null;
	}
	const y = Number(code.slice(format.year.start, format.year.start + format.year.length));
	return format.year.length === 2 ? 2000 + y : y;
}

/** The highest counter the format can hold. */
export function capacity(format: CompiledFormat): number {
	return format.counter ? 10 ** format.counter.length - 1 : 0;
}

export class CounterOverflowError extends Error {
	constructor(
		readonly pattern: string,
		readonly counter: number,
	) {
		super(`pattern "${pattern}": counter ${counter} does not fit`);
		this.name = "CounterOverflowError";
	}
}

/** Builds the code of a counter (and a year, for patterns that have one). */
export function generateCode(
	format: CompiledFormat,
	values: { counter: number; year?: number },
): string {
	if (
		!format.counter ||
		!Number.isInteger(values.counter) ||
		values.counter < 0 ||
		values.counter > capacity(format)
	) {
		throw new CounterOverflowError(format.def.pattern, values.counter);
	}
	const chars: string[] = format.slots.map((s) => (s.type === "char" ? s.char : "0"));
	const counter = String(values.counter).padStart(format.counter.length, "0");
	for (let k = 0; k < counter.length; k++) {
		chars[format.counter.start + k] = counter.charAt(k);
	}
	if (format.year) {
		const y = values.year;
		if (y === undefined || y < 1000 || y > 9999) {
			throw new Error(`pattern "${format.def.pattern}": a year is required`);
		}
		const text = String(y).slice(-format.year.length);
		for (let k = 0; k < text.length; k++) {
			chars[format.year.start + k] = text.charAt(k);
		}
	}
	if (format.check !== null && format.def.check !== "none") {
		chars[format.check] = "";
		const digits = chars.join("").replace(/\D/g, "");
		chars[format.check] = checkCharacter(format.def.check, digits);
	}
	return chars.join("");
}

/** The positions of the dashes (the separator pattern). */
export function separatorPositions(format: CompiledFormat): number[] {
	return format.slots.flatMap((s, i) => (s.type === "char" && s.char === "-" ? [i] : []));
}

/** The positions where a letter stands (a check letter or a literal letter). */
export function letterPositions(format: CompiledFormat): number[] {
	return format.slots.flatMap((s, i) =>
		s.type === "letter" || (s.type === "char" && /[A-Z]/.test(s.char)) ? [i] : [],
	);
}

/** The format without its dashes: what a scanner that lost the separator sends. */
export function withoutSeparators(format: CompiledFormat): CompiledFormat {
	const slots = format.slots.filter((s) => !(s.type === "char" && s.char === "-"));
	const remap = (pos: number): number =>
		pos - format.slots.slice(0, pos).filter((s) => s.type === "char" && s.char === "-").length;
	return {
		def: format.def,
		slots,
		length: slots.length,
		year: format.year ? { ...format.year, start: remap(format.year.start) } : null,
		counter: format.counter ? { ...format.counter, start: remap(format.counter.start) } : null,
		check: format.check === null ? null : remap(format.check),
	};
}
