// SPDX-License-Identifier: GPL-3.0-or-later
import { describe, expect, it } from "vitest";
import { areaOf, hasAny, isCurrent, NAV_ITEMS, visibleNavItems } from "./nav.js";

describe("navigation model", () => {
	it("shows only the areas the account may use", () => {
		// Stampe needs `patrons` or `catalog` (9.13, round 16)
		// Segnalazioni is for every account (9.18)
		expect(visibleNavItems({ permissions: ["loans"] }).map((i) => i.key)).toEqual([
			"circulation",
			"catalog",
			"notes",
		]);
		expect(visibleNavItems({ permissions: ["catalog"] }).map((i) => i.key)).toEqual([
			"catalog",
			"printing",
			"notes",
		]);
		// the cards' account does not see the catalogue (owner)
		expect(visibleNavItems({ permissions: ["patrons"] }).map((i) => i.key)).toEqual([
			"patrons",
			"printing",
			"notes",
		]);
		expect(visibleNavItems({ permissions: ["reports"] }).map((i) => i.key)).toEqual([
			"catalog",
			"notes",
			"reports",
		]);
		expect(
			visibleNavItems({ permissions: ["admin", "reports", "patrons", "loans"] }),
		).toHaveLength(NAV_ITEMS.length);
		expect(visibleNavItems(null).map((i) => i.key)).toEqual(["notes"]);
		expect(hasAny(null, undefined)).toBe(true);
	});

	it("marks the current area including sub-pages, home only exactly", () => {
		expect(isCurrent("/", "/")).toBe(true);
		expect(isCurrent("/catalog/12", "/")).toBe(false);
		expect(isCurrent("/catalog/12", "/catalog")).toBe(true);
		expect(isCurrent("/catalogue", "/catalog")).toBe(false);
	});

	it("tells the area of a page, tabs and sub-pages included (9.16)", () => {
		expect(areaOf("/")).toBeNull();
		expect(areaOf("/about")).toBeNull();
		expect(areaOf("/circulation/checkout")).toBe("circulation");
		expect(areaOf("/wishlist")).toBe("circulation");
		expect(areaOf("/catalog/12")).toBe("catalog");
		expect(areaOf("/cataloging/new")).toBe("catalog");
		expect(areaOf("/inventory")).toBe("catalog");
		expect(areaOf("/census")).toBe("patrons");
		expect(areaOf("/patrons/3/edit")).toBe("patrons");
		expect(areaOf("/print-lists/4")).toBe("printing");
		expect(areaOf("/notes")).toBe("notes");
		expect(areaOf("/reports/top-titles")).toBe("reports");
		expect(areaOf("/admin/config/school")).toBe("admin");
		// every area of the menu has its colour
		expect(NAV_ITEMS.every((i) => areaOf(i.href) === i.key)).toBe(true);
	});

	it("keeps at most four items in the mobile bar", () => {
		expect(NAV_ITEMS.filter((i) => i.mobile).length).toBeLessThanOrEqual(4);
	});
});
