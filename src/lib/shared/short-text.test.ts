// SPDX-License-Identifier: GPL-3.0-or-later
import { describe, expect, it } from "vitest";
import { authorShort, titleShort } from "./short-text.js";

describe("short forms of a record", () => {
	it("keeps the author's surname and cuts the title by characters", () => {
		expect(authorShort("Anonimo")).toBe("Anonimo");
		expect(authorShort("Rossi, Anna")).toBe("Rossi");
		expect(titleShort("  Una   storia  ", 5)).toBe("Una s");
		expect(titleShort("Città", 4)).toBe("Citt");
	});
});
