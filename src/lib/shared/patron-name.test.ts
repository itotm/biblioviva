// SPDX-License-Identifier: GPL-3.0-or-later
import { describe, expect, it } from "vitest";
import { patronFullName, patronSortName } from "./patron-name.js";

describe("patron names", () => {
	it("says a name first name first and lists it surname first", () => {
		const p = { firstName: "Mario", lastName: "Rossi" };
		expect(patronFullName(p)).toBe("Mario Rossi");
		expect(patronSortName(p)).toBe("Rossi Mario");
	});

	it("leaves no stray space when a part is missing", () => {
		expect(patronFullName({ firstName: null, lastName: "Rossi" })).toBe("Rossi");
		expect(patronSortName({ firstName: "Mario", lastName: undefined })).toBe("Mario");
	});
});
