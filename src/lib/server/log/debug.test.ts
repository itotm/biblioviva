// SPDX-License-Identifier: GPL-3.0-or-later
import { afterEach, describe, expect, it, vi } from "vitest";
import { resetEnvCache } from "#lib/server/env.js";
import { debugEnabled, debugLog, maskCode, summarize, traced } from "./debug.js";

const previous = process.env.LOG_LEVEL;
afterEach(() => {
	process.env.LOG_LEVEL = previous;
	resetEnvCache();
	vi.restoreAllMocks();
});

describe("debug log", () => {
	it("writes only with LOG_LEVEL=debug and never a card number", () => {
		const warn = vi.spyOn(console, "warn").mockImplementation(() => undefined);
		process.env.LOG_LEVEL = "info";
		resetEnvCache();
		expect(debugEnabled()).toBe(false);
		debugLog("scan", "read", { value: "x" });
		expect(warn).not.toHaveBeenCalled();
		process.env.LOG_LEVEL = "debug";
		resetEnvCache();
		debugLog("scan", "read", { kind: "isbn" });
		expect(warn).toHaveBeenCalledWith('[debug] scan read {"kind":"isbn"}');
		expect(maskCode("card", "0001000470")).toBe("<card 10 digits>");
		expect(maskCode("isbn", "9788804490623")).toBe("9788804490623");
	});

	it("summarizes results without their texts and traces sync and async bodies", async () => {
		expect(
			summarize({
				ok: false,
				reason: "item_on_loan",
				rows: 3,
				title: "Il nome della rosa",
				issues: [1, 2],
				nested: { name: "Anna" },
			}),
		).toEqual({ ok: false, reason: "item_on_loan", rows: 3, issues: "[2]" });
		expect(summarize([1, 2, 3])).toEqual({ length: 3 });
		expect(summarize("uploadGone")).toBe("uploadGone");
		expect(summarize(undefined)).toBe("undefined");

		const warn = vi.spyOn(console, "warn").mockImplementation(() => undefined);
		process.env.LOG_LEVEL = "info";
		resetEnvCache();
		expect(traced("import", "x", () => 1)).toBe(1);
		expect(warn).not.toHaveBeenCalled();
		process.env.LOG_LEVEL = "debug";
		resetEnvCache();
		expect(traced("import", "sync", () => ({ rows: 2 }))).toEqual({ rows: 2 });
		expect(await traced("import", "async", () => Promise.resolve({ ok: true }))).toEqual({
			ok: true,
		});
		expect(() =>
			traced("import", "throws", () => {
				throw new Error("boom");
			}),
		).toThrow("boom");
		await expect(
			traced("import", "rejects", () => Promise.reject(new Error("no"))),
		).rejects.toThrow("no");
		const lines = warn.mock.calls.map((c) => String(c[0]));
		expect(lines[0]).toMatch(/^\[debug\] import sync \{"ms":\d+,"result":\{"rows":2\}\}$/);
		expect(lines[1]).toContain('"result":{"ok":true}');
		expect(lines[2]).toContain('"failed":"boom"');
		expect(lines[3]).toContain('"failed":"no"');
	});
});
