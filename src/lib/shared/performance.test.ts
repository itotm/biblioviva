// SPDX-License-Identifier: GPL-3.0-or-later
import { describe, expect, it } from "vitest";
import { PERFORMANCE_PROFILES, PROFILE_VALUES, resolvePerformance } from "./performance.js";

describe("hardware profiles (step 9.28)", () => {
	it("gives each profile's values, the explicit keys over them", () => {
		expect(PERFORMANCE_PROFILES).toEqual(["micro", "small", "medium", "large"]);
		expect(resolvePerformance({ profile: "micro" })).toEqual({
			sqliteCacheMb: 8,
			sqliteMmapMb: 0,
			walAutocheckpointPages: 500,
			imageConcurrency: 1,
			yazConcurrency: 1,
			heavyConcurrency: 1,
			argon2MemoryMb: 16,
			smol: true,
		});
		expect(resolvePerformance({ profile: "large" }).imageConcurrency).toBe(4);
		// print sheets and exports one at a time on the two smallest hosts (step 9.32)
		expect(PERFORMANCE_PROFILES.map((p) => PROFILE_VALUES[p].heavyConcurrency)).toEqual([
			1, 1, 2, 4,
		]);
		expect(resolvePerformance({ profile: "small", heavyConcurrency: 3 }).heavyConcurrency).toBe(
			3,
		);
		expect(resolvePerformance({ profile: "large", argon2MemoryMb: 64, smol: null })).toEqual({
			...PROFILE_VALUES.large,
			argon2MemoryMb: 64,
		});
		// the same password cost everywhere (step 9.29)
		expect(new Set(PERFORMANCE_PROFILES.map((p) => PROFILE_VALUES[p].argon2MemoryMb))).toEqual(
			new Set([16]),
		);
		// a profile that does not exist, or none: small, the safe default
		expect(resolvePerformance({ profile: "huge" })).toEqual(PROFILE_VALUES.small);
		expect(resolvePerformance(undefined)).toEqual(PROFILE_VALUES.small);
		// a value of the wrong kind is ignored (the launcher reads the file before validation)
		expect(resolvePerformance({ profile: "micro", smol: "yes" as never }).smol).toBe(true);
	});

	it("never asks more of a smaller profile", () => {
		const order = PERFORMANCE_PROFILES.map((p) => PROFILE_VALUES[p]);
		for (let i = 1; i < order.length; i++) {
			const [a, b] = [order[i - 1], order[i]];
			expect(b?.sqliteCacheMb).toBeGreaterThanOrEqual(a?.sqliteCacheMb ?? 0);
			expect(b?.imageConcurrency).toBeGreaterThanOrEqual(a?.imageConcurrency ?? 0);
			expect(b?.heavyConcurrency).toBeGreaterThanOrEqual(a?.heavyConcurrency ?? 0);
			expect(b?.argon2MemoryMb).toBeGreaterThanOrEqual(a?.argon2MemoryMb ?? 0);
		}
	});
});
