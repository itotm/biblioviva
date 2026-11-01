// SPDX-License-Identifier: GPL-3.0-or-later
import { describe, expect, it } from "vitest";
import {
	ACCOUNTS_PART,
	CONFIG_PARTS,
	configPart,
	DATA_PARTS,
	dataPart,
	dataPartsOf,
	isPartId,
	sectionPartOf,
	selectParts,
	type PartId,
	withoutAccounts,
} from "./archive-parts.js";

describe("archive parts", () => {
	const available: PartId[] = [
		...new Set([
			...DATA_PARTS.map(dataPart),
			...["library", "classification", "calendar", "circulation"].map(sectionPartOf),
			...CONFIG_PARTS.map(configPart),
		]),
	];

	it("lists every part, classification and calendar as parts of their own", () => {
		expect(available).toContain("data:loans");
		expect(available).toContain("section:library");
		expect(available).not.toContain("section:classification");
		expect(available).toContain("config:calendar");
		expect(isPartId("data:catalog")).toBe(true);
		expect(isPartId("data:nope")).toBe(false);
		expect(isPartId("config:reports")).toBe(true);
		expect(isPartId("section:Bad")).toBe(false);
		expect(dataPartsOf(["data:loans", "config:reports", "data:photos"])).toEqual([
			"loans",
			"photos",
		]);
	});

	it("chooses with --only and --except, by id or by group", () => {
		expect(selectParts(available, ["data:catalog", "config:reports"])).toEqual([
			"data:catalog",
			"config:reports",
		]);
		expect(selectParts(available, ["settings"])).toEqual([
			"section:library",
			"section:circulation",
		]);
		const noData = selectParts(available, null, ["data"]);
		expect(noData.some((p) => p.startsWith("data:"))).toBe(false);
		expect(
			selectParts(available, ["config"], ["settings"]).every((p) => p.startsWith("config:")),
		).toBe(true);
		expect(selectParts(available, null)).toEqual(available);
	});
});

describe("the accounts part", () => {
	it("is the security section, and an import leaves it out unless it is asked for", () => {
		expect(ACCOUNTS_PART).toBe("section:security");
		const parts: PartId[] = [
			"section:library",
			"section:security",
			"config:logo",
			"data:loans",
		];
		expect(withoutAccounts(parts)).toEqual(["section:library", "config:logo", "data:loans"]);
		expect(withoutAccounts(["section:library"])).toEqual(["section:library"]);
	});
});
