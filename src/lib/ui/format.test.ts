// SPDX-License-Identifier: GPL-3.0-or-later
import { describe, expect, it } from "vitest";
import { createFormat, formatContext, type FormatSettings } from "./format.js";

describe("format", () => {
	it("formats in the installation's language and the library's zone", () => {
		const fmt = createFormat(() => ({ locale: "it", timezone: "Europe/Rome" }));
		expect(fmt.locale).toBe("it");
		expect(fmt.timezone).toBe("Europe/Rome");
		expect(fmt.day("2026-09-20")).toBe("20/09/26");
		expect(fmt.day("2026-09-20", { weekday: "long" })).toBe("domenica");
		// 23:30 UTC is already the next day in Rome
		expect(fmt.date("2026-09-19T23:30:00Z")).toBe("20/09/26");
		expect(
			fmt.date(new Date("2026-09-19T08:05:00Z"), { hour: "2-digit", minute: "2-digit" }),
		).toBe("10:05");
		expect(fmt.dateTime("2026-09-19T08:05:00Z")).toMatch(/19\/09\/26,? 10:05/);
		expect(fmt.dateTime(new Date("2026-09-19T08:05:00Z"))).toMatch(/19\/09\/26,? 10:05/);
		expect(fmt.number(1234.5)).toBe("1234,5");
		expect(fmt.number(0.25, { style: "percent" })).toBe("25%");
	});

	it("reads the settings at every call", () => {
		const settings: FormatSettings = { locale: "it", timezone: "Europe/Rome" };
		const fmt = createFormat(() => settings);
		settings.locale = "en-GB";
		settings.timezone = "UTC";
		expect(fmt.day("2026-09-20", "medium")).toBe("20 Sept 2026");
		expect(fmt.date("2026-09-19T23:30:00Z")).toBe("19/09/2026");
		expect(fmt.number(1234.5)).toBe("1,234.5");
	});

	it("gives component tests an Italian context by default", () => {
		const [format] = [...formatContext().values()];
		expect(format?.locale).toBe("it");
		expect(format?.timezone).toBe("Europe/Rome");
		const [english] = [...formatContext({ locale: "en", timezone: "UTC" }).values()];
		expect(english?.locale).toBe("en");
	});
});
