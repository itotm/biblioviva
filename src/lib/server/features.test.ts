// SPDX-License-Identifier: GPL-3.0-or-later
import { isHttpError } from "@sveltejs/kit";
import { afterEach, describe, expect, it, vi } from "vitest";
import { getConfig } from "#lib/server/config/index.js";
import { featureOn, requireFeature } from "./features.js";

afterEach(() => {
	vi.restoreAllMocks();
});

describe("photos and covers switched off (9.38)", () => {
	it("reads the switches, on by default", () => {
		const config = getConfig();
		expect(featureOn("photos", config)).toBe(true);
		expect(featureOn("covers", config)).toBe(true);
		expect(
			featureOn("photos", { ...config, photos: { ...config.photos, enabled: false } }),
		).toBe(false);
		expect(() => {
			requireFeature("covers");
		}).not.toThrow();
	});

	it("answers 404 when a feature is off", async () => {
		const config = getConfig();
		const index = await import("#lib/server/config/index.js");
		vi.spyOn(index, "getConfig").mockReturnValue({
			...config,
			covers: { ...config.covers, enabled: false },
		});
		try {
			requireFeature("covers");
			expect.unreachable();
		} catch (e) {
			expect(isHttpError(e, 404)).toBe(true);
		}
	});
});
