// SPDX-License-Identifier: GPL-3.0-or-later
// The helpers of `bun run docs:shots` that run without a browser: the windows and languages of a
// run, the texts the steps look for, and the shape of the shot list.
import { describe, expect, it } from "vitest";
import {
	runLangs,
	runWindows,
	shotFile,
	SHOT_LANGS,
	WINDOW_SIZES,
	WINDOWS,
} from "../docs/shot-windows.js";
import { fill, translator } from "../docs/shots-text.js";
import { SHOTS } from "../docs/shots.js";

describe("windows and languages of a run", () => {
	it("takes every window and language unless the environment narrows the run", () => {
		expect(runLangs({})).toEqual([...SHOT_LANGS]);
		expect(runWindows({})).toEqual([...WINDOWS]);
		expect(runLangs({ BV_SHOTS_LANGS: "it" })).toEqual(["it"]);
		expect(runLangs({ BV_SHOTS_LANGS: "en, it" })).toEqual(["it", "en"]);
		expect(runWindows({ BV_SHOTS_WINDOWS: "phone,computer" })).toEqual(["computer", "phone"]);
	});

	it("refuses a value that names nothing known", () => {
		expect(() => runLangs({ BV_SHOTS_LANGS: "xx" })).toThrow(/nothing known/);
		expect(() => runWindows({ BV_SHOTS_WINDOWS: "watch" })).toThrow(/nothing known/);
	});

	it("keeps the windows apart in the name of a picture", () => {
		expect(shotFile("en", "circulation/desk-ok", "phone", "webp")).toBe(
			"en/circulation/desk-ok.phone.webp",
		);
	});

	it("has the sizes of PLAN.md section 3.23", () => {
		expect(WINDOW_SIZES).toEqual({
			computer: { width: 1280, height: 800, scale: 1 },
			tablet: { width: 834, height: 1194, scale: 2 },
			phone: { width: 412, height: 915, scale: 2 },
		});
	});
});

describe("the texts of the steps", () => {
	it("reads a text of each language's dictionaries", () => {
		expect(translator("it")("common.actions.close")).toBe("Chiudi");
		expect(translator("en")("common.actions.close")).toBe("Close");
	});

	it("fills the values and the plural forms of a text", () => {
		expect(fill("{{n}} {{n:plural; one:copia; other:copie;}}", { n: 1 })).toBe("1 copia");
		expect(fill("{{n}} {{n:plural; one:copia; other:copie;}}", { n: 3 })).toBe("3 copie");
		expect(translator("en")("patrons.census.sheet.found", { count: 10 })).toBe(
			"Photos found: 10. Choose whose each one is.",
		);
	});

	it("fails on a key that does not exist or a value that is missing", () => {
		expect(() => translator("it")("common.actions.nothing")).toThrow(/no text/);
		expect(() => fill("{{n}}")).toThrow(/no value/);
	});
});

describe("the shot list", () => {
	it("names every picture once, in one folder per area", () => {
		const names = SHOTS.map((s) => s.name);
		expect(new Set(names).size).toBe(names.length);
		for (const name of names) {
			expect(name).toMatch(/^[a-z-]+\/[a-z0-9-]+(\/[a-z0-9-]+)?$/);
		}
	});

	it("takes a screen in all three windows, a detail or a mock of another program in the computer's", () => {
		for (const shot of SHOTS) {
			expect(shot.windows.length).toBeGreaterThan(0);
			if (shot.mock) {
				expect(shot.windows).toEqual(["computer"]);
			}
			if (shot.crop && !shot.windows.includes("computer")) {
				throw new Error(`${shot.name}: a detail needs the computer window`);
			}
			if (!shot.crop && !shot.mock) {
				expect(shot.windows).toEqual([...WINDOWS]);
			}
		}
	});
});
