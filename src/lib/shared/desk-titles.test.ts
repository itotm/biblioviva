// SPDX-License-Identifier: GPL-3.0-or-later
import { describe, expect, it } from "vitest";
import { deskTitles, shortTitle } from "./desk-titles.js";

describe("desk titles", () => {
	it("cuts a title to 40 characters and lists the loans in guillemets", () => {
		expect(shortTitle("Il gatto con gli stivali e altre storie di animali parlanti")).toBe(
			"Il gatto con gli stivali e altre storie…",
		);
		expect(shortTitle("Breve")).toBe("Breve");
		expect(deskTitles([{ title: "Breve" }, { title: " Pinocchio " }])).toBe(
			"«Breve», «Pinocchio»",
		);
	});
});
