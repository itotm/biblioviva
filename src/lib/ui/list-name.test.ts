// SPDX-License-Identifier: GPL-3.0-or-later
import { describe, expect, it } from "vitest";
import { createFormat } from "./format.js";
import { proposedListName } from "./list-name.js";

const it_ = (n: number, date: string): string => `Lista ${String(n)} del ${date}`;
const now = new Date("2026-10-29T23:30:00Z");
const rome = createFormat(() => ({ locale: "it", timezone: "Europe/Rome" }));
const utc = createFormat(() => ({ locale: "it", timezone: "UTC" }));

describe("proposedListName", () => {
	it("numbers the next list and dates it on the library's day", () => {
		expect(proposedListName([], it_, rome, now)).toBe("Lista 1 del 30/10/2026");
		expect(proposedListName(["Classe 1A", "Docenti"], it_, utc, now)).toBe(
			"Lista 3 del 29/10/2026",
		);
	});

	it("skips a name already used", () => {
		expect(proposedListName(["lista 2 del 29/10/2026", "X"], it_, utc, now)).toBe(
			"Lista 3 del 29/10/2026",
		);
	});
});
