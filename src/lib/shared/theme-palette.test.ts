// SPDX-License-Identifier: GPL-3.0-or-later
import { describe, expect, it } from "vitest";
import { backgroundColor, DEFAULT_THEME, themeColor, THEMES } from "./theme-palette.js";

describe("themes", () => {
	it("recognises the offered presets only", () => {
		expect(THEMES).toContain(DEFAULT_THEME);
		expect(THEMES).toContain("sunset");
		expect(THEMES).not.toContain("dracula");
		expect(THEMES).toHaveLength(15);
	});

	it("gives the title bar and splash colours of a set", () => {
		// the generated ocean.css has primary 500 #006edc
		expect(themeColor("ocean")).toBe("#006edc");
		expect(backgroundColor("ocean")).toMatch(/^#f[0-9a-f]{5}$/);
	});
});
