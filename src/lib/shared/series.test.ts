// SPDX-License-Identifier: GPL-3.0-or-later
import { describe, expect, it } from "vitest";
import { formatSeries, parseSeries } from "./series.js";

describe("series", () => {
	it("splits the usual series statements", () => {
		expect(parseSeries("Harry Potter ; 3")).toEqual({ series: "Harry Potter", number: "3" });
		expect(parseSeries("Harry Potter #3")).toEqual({ series: "Harry Potter", number: "3" });
		expect(parseSeries("Harry Potter (3)")).toEqual({ series: "Harry Potter", number: "3" });
		expect(parseSeries("Harry Potter, book 3")).toEqual({
			series: "Harry Potter",
			number: "3",
		});
		expect(parseSeries("Discworld -- 12")).toEqual({ series: "Discworld", number: "12" });
		expect(parseSeries("Le cronache di Narnia, vol. II")).toEqual({
			series: "Le cronache di Narnia",
			number: "II",
		});
		expect(parseSeries("Warriors ; 1.5")).toEqual({ series: "Warriors", number: "1.5" });
	});

	it("keeps a series without a number, and nothing for an empty statement", () => {
		expect(parseSeries("Piccoli brividi.")).toEqual({
			series: "Piccoli brividi",
			number: null,
		});
		expect(parseSeries("Fahrenheit 451")).toEqual({ series: "Fahrenheit 451", number: null });
		expect(parseSeries("  ")).toBeNull();
		expect(parseSeries(null)).toBeNull();
	});

	it("shows the pair", () => {
		expect(formatSeries("Harry Potter", "3")).toBe("Harry Potter · 3");
		expect(formatSeries("Harry Potter", null)).toBe("Harry Potter");
		expect(formatSeries(null, "3")).toBe("");
	});
});
