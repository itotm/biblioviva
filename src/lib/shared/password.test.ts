// SPDX-License-Identifier: GPL-3.0-or-later
import { describe, expect, it } from "vitest";
import { generatePassword } from "./password.js";

describe("generatePassword", () => {
	it("produces readable groups without ambiguous characters", () => {
		const pw = generatePassword();
		expect(pw).toMatch(/^[a-hj-km-np-z2-9]{4}-[a-hj-km-np-z2-9]{4}-[a-hj-km-np-z2-9]{4}$/);
		expect(generatePassword(2, 6)).toMatch(/^[a-z2-9]{6}-[a-z2-9]{6}$/);
		expect(new Set(Array.from({ length: 20 }, () => generatePassword())).size).toBeGreaterThan(
			15,
		);
	});
});
