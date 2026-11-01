// SPDX-License-Identifier: GPL-3.0-or-later
import { describe, expect, it } from "vitest";
import { Z3950_HOST, Z3950_WORD } from "./z3950.js";

describe("Z39.50 target values", () => {
	it("accepts host names and addresses, single words, nothing that could break a command", () => {
		for (const ok of ["opac.sbn.it", "192.168.1.10", "z3950-1.example.org"]) {
			expect(Z3950_HOST.test(ok)).toBe(true);
		}
		for (const bad of ["", "opac.sbn.it\nquit", "host name", "a/b", "x".repeat(254)]) {
			expect(Z3950_HOST.test(bad)).toBe(false);
		}
		for (const ok of ["nopac", "utf-8", "F", "ISO-8859-1"]) {
			expect(Z3950_WORD.test(ok)).toBe(true);
		}
		for (const bad of ["", "a b", "a\nb", "a\rb", "a\u0000b"]) {
			expect(Z3950_WORD.test(bad)).toBe(false);
		}
	});
});
