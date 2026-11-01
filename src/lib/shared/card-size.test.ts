// SPDX-License-Identifier: GPL-3.0-or-later
import { describe, expect, it } from "vitest";
import { readCardSize, writeCardSize } from "./card-size.js";

const SHIPPED = `{
	"name": "default",
	"patronTypes": ["student", "teacher"],
	"bleedMm": 0
}
`;

describe("the size of a card template (step 11.17)", () => {
	it("adds, changes and takes out cardMm, keeping the rest of the file", () => {
		expect(readCardSize(SHIPPED)).toBeNull();
		const portrait = writeCardSize(SHIPPED, { width: 54, height: 85.6 });
		expect(portrait).toBe(`{
	"cardMm": { "width": 54, "height": 85.6 },
	"name": "default",
	"patronTypes": ["student", "teacher"],
	"bleedMm": 0
}
`);
		expect(readCardSize(portrait)).toEqual({ width: 54, height: 85.6 });
		const bigger = writeCardSize(portrait, { width: 90, height: 60 });
		expect(readCardSize(bigger)).toEqual({ width: 90, height: 60 });
		expect(bigger.replace(/"cardMm".*\n/, "")).toBe(portrait.replace(/"cardMm".*\n/, ""));
		expect(writeCardSize(bigger, null)).toBe(SHIPPED);
		// the last key of the object
		const last = `{\n\t"name": "x",\n\t"cardMm": { "width": 54, "height": 86 }\n}\n`;
		expect(writeCardSize(last, null)).toBe(`{\n\t"name": "x"\n}\n`);
		expect(JSON.parse(writeCardSize("{}", { width: 1, height: 2 }))).toEqual({
			cardMm: { width: 1, height: 2 },
		});
		expect(readCardSize("not json")).toBeNull();
	});
});
