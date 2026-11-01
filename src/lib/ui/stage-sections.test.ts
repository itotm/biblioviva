// SPDX-License-Identifier: GPL-3.0-or-later
import { describe, expect, it } from "vitest";
import { stageSections } from "./stage-sections.js";

const g = (id: number, stage: string | null): { id: number; stage: string | null } => ({
	id,
	stage,
});

describe("stageSections", () => {
	it("keeps a school of one stage in one untitled section", () => {
		expect(
			stageSections([g(1, "EE"), g(2, null)], [{ code: "EE", name: "Primaria" }], "Altri"),
		).toEqual([{ key: "all", title: "", groups: [g(1, "EE"), g(2, null)] }]);
		expect(stageSections([], [], "Altri")).toEqual([]);
	});

	it("splits several stages, the unknown ones last, the empty ones left out", () => {
		const stages = [
			{ code: "AA", name: "Infanzia" },
			{ code: "EE", name: "Primaria" },
			{ code: "MM", name: "Secondaria" },
		];
		expect(
			stageSections([g(1, "EE"), g(2, "XX"), g(3, "AA"), g(4, null)], stages, "Altri"),
		).toEqual([
			{ key: "AA", title: "Infanzia", groups: [g(3, "AA")] },
			{ key: "EE", title: "Primaria", groups: [g(1, "EE")] },
			{ key: "others", title: "Altri", groups: [g(2, "XX"), g(4, null)] },
		]);
	});
});
