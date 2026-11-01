// SPDX-License-Identifier: GPL-3.0-or-later
import * as v from "valibot";
import { describe, expect, it } from "vitest";
import { biblioFormSchema } from "./catalog-schema.js";
import { patronFormSchema } from "./patron-schema.js";
import { maxLengthOf, maxLengths } from "./text-limits.js";

describe("text limits", () => {
	it("reads the cap of plain, piped, optional and nullable schemas", () => {
		expect(maxLengthOf(v.pipe(v.string(), v.maxLength(5)))).toBe(5);
		expect(maxLengthOf(v.optional(v.pipe(v.string(), v.trim(), v.maxLength(7)), ""))).toBe(7);
		expect(maxLengthOf(v.nullable(v.pipe(v.string(), v.maxLength(9))))).toBe(9);
		expect(maxLengthOf(v.string())).toBeNull();
		expect(maxLengthOf(biblioFormSchema.entries.title)).toBe(300);
	});

	it("keeps only the fields with a cap", () => {
		expect(
			maxLengths({
				firstName: patronFormSchema.entries.firstName,
				notes: patronFormSchema.entries.notes,
				type: patronFormSchema.entries.patronType,
			}),
		).toEqual({ firstName: 80, notes: 2000 });
	});
});
