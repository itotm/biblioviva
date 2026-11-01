// SPDX-License-Identifier: GPL-3.0-or-later
import { describe, expect, it } from "vitest";
import {
	DIGITS,
	DIGITS_AND_HYPHENS,
	hasFilter,
	ListFilters,
	searchText,
} from "./list-filters.svelte.js";

describe("list filters", () => {
	it("searches words from three characters and codes at any length", () => {
		expect(searchText("ro", DIGITS)).toBe("");
		expect(searchText(" ros ", DIGITS)).toBe("ros");
		expect(searchText("12", DIGITS)).toBe("12");
		expect(searchText("1-", DIGITS)).toBe("");
		expect(searchText("1-", DIGITS_AND_HYPHENS)).toBe("1-");
	});

	it("tells whether anything is set", () => {
		expect(hasFilter({ q: "", kind: "", overdue: "" })).toBe(false);
		expect(hasFilter({ q: "", kind: "fiction" })).toBe(true);
		expect(hasFilter({ q: "", withdrawn: false })).toBe(false);
		expect(hasFilter({ q: "", withdrawn: true })).toBe(true);
	});

	it("opens with the initial values and clears back to empty", () => {
		const f = new ListFilters({ q: "", series: "", withdrawn: false }, { series: "Gol" });
		expect(f.values.series).toBe("Gol");
		f.values.q = "rossi";
		f.values.withdrawn = true;
		f.clear();
		expect(f.values).toEqual({ q: "", series: "", withdrawn: false });
	});

	it("keeps its values in the page's snapshot and gives them back", () => {
		const left = new ListFilters({ q: "", withdrawn: false });
		left.values.q = "rossi";
		left.values.withdrawn = true;
		const kept = left.capture();
		left.values.q = "changed";
		expect(kept).toEqual({ q: "rossi", withdrawn: true });
		const back = new ListFilters({ q: "", withdrawn: false });
		back.restore(kept);
		expect(back.values).toEqual({ q: "rossi", withdrawn: true });
	});
});
