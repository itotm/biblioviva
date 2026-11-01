// SPDX-License-Identifier: GPL-3.0-or-later
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { resetEnvCache } from "#lib/server/env.js";
import {
	DEMO_HEAVY_PER_MINUTE,
	DEMO_WRITES_PER_MINUTE,
	demoRequestAllowed,
	resetDemoLimits,
	takeDemoNote,
} from "./limits.js";
import { DemoBlockedError } from "./public.js";

const saved = process.env.DEMO_NOTES_PER_DAY;
beforeEach(() => {
	resetEnvCache();
	resetDemoLimits();
});
afterEach(() => {
	if (saved === undefined) {
		delete process.env.DEMO_NOTES_PER_DAY;
	} else {
		process.env.DEMO_NOTES_PER_DAY = saved;
	}
	resetEnvCache();
	resetDemoLimits();
});

describe("the limits of the public demo", () => {
	it("lets an address write DEMO_NOTES_PER_DAY notes, the others keep theirs", () => {
		process.env.DEMO_NOTES_PER_DAY = "3";
		resetEnvCache();
		for (let i = 0; i < 3; i++) {
			takeDemoNote("198.51.100.1");
		}
		expect(() => {
			takeDemoNote("198.51.100.1");
		}).toThrow(DemoBlockedError);
		expect(() => {
			takeDemoNote("198.51.100.2");
		}).not.toThrow();
	});

	it("never counts a page read", () => {
		for (let i = 0; i < 500; i++) {
			expect(demoRequestAllowed("a", { method: "GET", pathname: "/catalog" })).toBe(true);
		}
	});

	it("caps the writes of an address per minute", () => {
		for (let i = 0; i < DEMO_WRITES_PER_MINUTE; i++) {
			expect(demoRequestAllowed("a", { method: "POST", pathname: "/_app/remote/x" })).toBe(
				true,
			);
		}
		expect(demoRequestAllowed("a", { method: "POST", pathname: "/_app/remote/x" })).toBe(false);
		expect(demoRequestAllowed("b", { method: "POST", pathname: "/_app/remote/x" })).toBe(true);
	});

	it("caps exports, archives and print sheets apart", () => {
		const heavy = [
			"/export/patrons",
			"/print/labels/pair",
			"/admin/exports/loans",
			"/admin/backups/export",
			"/admin/config/export",
		];
		for (let i = 0; i < DEMO_HEAVY_PER_MINUTE; i++) {
			expect(
				demoRequestAllowed("a", { method: "GET", pathname: heavy[i % heavy.length] ?? "" }),
			).toBe(true);
		}
		expect(demoRequestAllowed("a", { method: "GET", pathname: "/export/patrons" })).toBe(false);
		// the pages that offer them are not heavy
		expect(demoRequestAllowed("a", { method: "GET", pathname: "/admin/exports" })).toBe(true);
		expect(demoRequestAllowed("a", { method: "GET", pathname: "/admin/backups" })).toBe(true);
	});
});
