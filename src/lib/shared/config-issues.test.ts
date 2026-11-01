// SPDX-License-Identifier: GPL-3.0-or-later
import { describe, expect, it } from "vitest";
import { issueLine, issueLines, joinIssues } from "./config-issues.js";

describe("configuration issues as text", () => {
	it("writes a message as it is and a key path with its message", () => {
		expect(issueLine("other")).toBe("other");
		expect(issueLine({ path: "ui.theme", message: "unknown" })).toBe("ui.theme: unknown");
	});

	it("keeps the order of the lines and joins them with semicolons", () => {
		const issues = ["a", { path: "p", message: "m" }];
		expect(issueLines(issues)).toEqual(["a", "p: m"]);
		expect(joinIssues(issues)).toBe("a; p: m");
		expect(joinIssues([])).toBe("");
	});
});
