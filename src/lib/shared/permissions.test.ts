// SPDX-License-Identifier: GPL-3.0-or-later
import { describe, expect, it } from "vitest";
import { hasPermission, isPermission, PERMISSIONS } from "./permissions.js";

describe("permissions", () => {
	it("knows the fixed list and rejects anything else", () => {
		expect(PERMISSIONS).toContain("admin");
		expect(isPermission("loans")).toBe(true);
		expect(isPermission("*")).toBe(false);
		expect(isPermission(42)).toBe(false);
		expect(hasPermission({ permissions: ["loans"] }, "loans")).toBe(true);
		expect(hasPermission({ permissions: ["loans"] }, "admin")).toBe(false);
		expect(hasPermission(null, "admin")).toBe(false);
	});
});
