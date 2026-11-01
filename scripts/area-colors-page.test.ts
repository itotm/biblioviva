// SPDX-License-Identifier: GPL-3.0-or-later
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { buildTokens, THEMES } from "#lib/shared/theme-palette.js";
import { toHex } from "#lib/shared/color.js";
import { AREA_COLORS_PAGE, areaColorsData, renderAreaColorsPage } from "./area-colors-page.js";

describe("area colours reference page", () => {
	it("is committed with the data the palette produces (run `bun run themes:generate`)", () => {
		const page = readFileSync(AREA_COLORS_PAGE, "utf8");
		expect(renderAreaColorsPage(page)).toBe(page);
	});

	it("carries every set with the generated area colours and both languages", () => {
		const data = areaColorsData() as {
			themes: Record<string, { areas: Record<string, { strong: string }> }>;
			labels: Record<
				string,
				{ areas: Record<string, string>; themes: Record<string, string> }
			>;
		};
		expect(Object.keys(data.themes)).toEqual([...THEMES]);
		const ocean = buildTokens("ocean").areas.catalog.strong;
		expect(data.themes.ocean?.areas.catalog?.strong).toBe(toHex(ocean));
		expect(data.labels.it?.areas.catalog).toBe("Catalogo");
		expect(data.labels.en?.themes.ocean).toBe("Ocean");
	});

	it("refuses a page without the generated markers", () => {
		expect(() => renderAreaColorsPage("<p>no markers</p>")).toThrow(/markers/);
	});
});
