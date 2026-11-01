// SPDX-License-Identifier: GPL-3.0-or-later
import { describe, expect, it } from "vitest";
import { AREAS } from "#lib/shared/theme-palette.js";
import { docsBase, HELP_PAGES, helpHref } from "./help-links.js";

describe("help links", () => {
	it("open the documentation in the installation's language, English for the others", () => {
		expect(docsBase("it")).toBe("https://docs.biblioviva.org/it/");
		expect(docsBase("en")).toBe("https://docs.biblioviva.org/en/");
		expect(docsBase("de")).toBe("https://docs.biblioviva.org/en/");
		expect(docsBase("it-CH")).toBe("https://docs.biblioviva.org/it/");
	});

	it("have a page for every area and for the dashboard", () => {
		for (const area of AREAS) {
			expect(HELP_PAGES[area]).toMatch(/^[a-z-]+\/([a-z-]+\/)?$/);
		}
		const base = docsBase("it");
		expect(helpHref(base, "circulation")).toBe(
			"https://docs.biblioviva.org/it/manual/checkout/",
		);
		expect(helpHref(base, null)).toBe("https://docs.biblioviva.org/it/manual/dashboard/");
	});
});
