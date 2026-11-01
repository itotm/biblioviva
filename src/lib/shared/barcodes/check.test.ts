// SPDX-License-Identifier: GPL-3.0-or-later
import { describe, expect, it } from "vitest";
import {
	CHECK_ALGORITHMS,
	checkAlphabet,
	checkCharacter,
	dammCheckDigit,
	luhnCheckDigit,
	MOD23_LETTERS,
	mod23CheckLetter,
} from "./check.js";

/** Deterministic payloads of 8 digits (the copy payload `YYYYNNNN`) and of 6 digits (cards). */
function payloads(length: number, count: number): string[] {
	const out: string[] = [];
	let x = 20260919;
	for (let i = 0; i < count; i++) {
		x = (x * 1103515245 + 12345) % 2147483648;
		out.push(String(x).padStart(length, "0").slice(-length));
	}
	return out;
}

describe("luhn", () => {
	it("computes the classic vectors", () => {
		expect(luhnCheckDigit("7992739871")).toBe(3);
		expect(luhnCheckDigit("000000001")).toBe(8);
		expect(() => luhnCheckDigit("12a")).toThrow();
	});
});

describe("damm", () => {
	it("computes the published vector", () => {
		// Wikipedia, "Damm algorithm": 572 → 4
		expect(dammCheckDigit("572")).toBe(4);
		expect(dammCheckDigit("5724")).toBe(0);
		expect(() => dammCheckDigit("5x")).toThrow();
	});
});

describe("mod23", () => {
	it("uses the 23 letters without I, O and Q", () => {
		expect(MOD23_LETTERS).toHaveLength(23);
		expect(MOD23_LETTERS).not.toMatch(/[IOQ]/);
		expect(new Set(MOD23_LETTERS).size).toBe(23);
	});

	it("maps the remainder to its letter", () => {
		expect(mod23CheckLetter("0")).toBe("A");
		expect(mod23CheckLetter("22")).toBe("Z");
		expect(mod23CheckLetter("23")).toBe("A");
		// 20260267 = 23 × 880881 + 4
		expect(mod23CheckLetter("20260267")).toBe("E");
		expect(() => mod23CheckLetter("")).toThrow();
	});
});

describe("error detection", () => {
	const strong = ["damm", "mod23"] as const;

	it.each(strong)("%s catches every single-digit error", (algorithm) => {
		for (const p of payloads(8, 200)) {
			const check = checkCharacter(algorithm, p);
			for (let i = 0; i < p.length; i++) {
				for (let d = 0; d <= 9; d++) {
					if (String(d) === p[i]) {
						continue;
					}
					const wrong = `${p.slice(0, i)}${d}${p.slice(i + 1)}`;
					expect(checkCharacter(algorithm, wrong)).not.toBe(check);
				}
			}
		}
	});

	it.each(strong)("%s catches every adjacent transposition", (algorithm) => {
		for (const p of payloads(8, 400)) {
			const check = checkCharacter(algorithm, p);
			for (let i = 0; i + 1 < p.length; i++) {
				if (p[i] === p[i + 1]) {
					continue;
				}
				const swapped = `${p.slice(0, i)}${p[i + 1]}${p[i]}${p.slice(i + 2)}`;
				expect(checkCharacter(algorithm, swapped)).not.toBe(check);
			}
		}
	});

	it("mod23 also catches jump transpositions and twin errors", () => {
		for (const p of payloads(8, 300)) {
			const check = mod23CheckLetter(p);
			for (let i = 0; i + 2 < p.length; i++) {
				if (p[i] !== p[i + 2]) {
					const jumped = `${p.slice(0, i)}${p[i + 2]}${p[i + 1]}${p[i]}${p.slice(i + 3)}`;
					expect(mod23CheckLetter(jumped)).not.toBe(check);
				}
			}
			for (let i = 0; i + 1 < p.length; i++) {
				if (p[i] === p[i + 1]) {
					for (let d = 0; d <= 9; d++) {
						if (String(d) !== p[i]) {
							const twin = `${p.slice(0, i)}${d}${d}${p.slice(i + 2)}`;
							expect(mod23CheckLetter(twin)).not.toBe(check);
						}
					}
				}
			}
		}
	});

	it("gives a character of the algorithm's alphabet", () => {
		for (const algorithm of CHECK_ALGORITHMS) {
			for (const p of payloads(6, 50)) {
				expect(checkAlphabet(algorithm)).toContain(checkCharacter(algorithm, p));
			}
		}
	});
});
