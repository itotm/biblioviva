// SPDX-License-Identifier: GPL-3.0-or-later
import * as v from "valibot";
import { describe, expect, it } from "vitest";
import { patronEditSchema, patronFiltersSchema, patronFormSchema } from "./patron-schema.js";

describe("patron schemas", () => {
	it("trims the text and defaults optional fields", () => {
		const parsed = v.parse(patronFormSchema, {
			patronType: "student",
			firstName: " Anna ",
			lastName: "Rossi",
			groupName: " b ",
		});
		expect(parsed).toMatchObject({
			firstName: "Anna",
			groupName: "b",
			groupId: "",
			levelCode: "",
			notes: "",
		});
		expect(v.safeParse(patronFormSchema, { ...parsed, groupId: "x1" }).success).toBe(false);
		expect(
			v.safeParse(patronFormSchema, { patronType: "alien", firstName: "A", lastName: "B" })
				.success,
		).toBe(false);
		expect(
			v.safeParse(patronFormSchema, { patronType: "teacher", firstName: "", lastName: "B" })
				.success,
		).toBe(false);
	});

	it("requires a numeric id for edits and validates grid filters", () => {
		expect(
			v.safeParse(patronEditSchema, {
				id: "x",
				patronType: "teacher",
				firstName: "A",
				lastName: "B",
			}).success,
		).toBe(false);
		expect(
			v.parse(patronEditSchema, {
				id: "12",
				patronType: "teacher",
				firstName: "A",
				lastName: "B",
			}).id,
		).toBe("12");
		expect(v.parse(patronFiltersSchema, {})).toEqual({
			q: "",
			patronType: "",
			levelCode: "",
			groupId: "",
			stage: "",
			status: "",
			sort: "name",
			limit: 500,
			offset: 0,
		});
		expect(v.safeParse(patronFiltersSchema, { groupId: "3A" }).success).toBe(false);
		expect(v.safeParse(patronFiltersSchema, { levelCode: "P 1" }).success).toBe(false);
		expect(v.safeParse(patronFiltersSchema, { limit: 5000 }).success).toBe(false);
	});
});
