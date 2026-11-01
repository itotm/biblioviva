// SPDX-License-Identifier: GPL-3.0-or-later
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import {
	renderIndex,
	summarizeCoverage,
	summarizePlaywright,
	summarizeVitest,
	writeIndex,
} from "./test-report.js";

const vitestJson = {
	testResults: [
		{
			name: "/repo/src/lib/server/a.test.ts",
			endTime: Date.parse("2026-10-02T10:00:00Z"),
			assertionResults: [{ status: "passed" }, { status: "passed" }, { status: "skipped" }],
		},
		{
			name: "/repo/src/lib/components/B.svelte.test.ts",
			endTime: Date.parse("2026-10-02T10:00:05Z"),
			assertionResults: [{ status: "passed" }, { status: "failed" }],
		},
	],
};

const playwrightJson = {
	stats: { startTime: "2026-10-02T10:01:00.000Z", duration: 60_000 },
	suites: [
		{
			specs: [{ tests: [{ projectName: "setup", status: "expected" }] }],
			suites: [
				{
					specs: [
						{
							tests: [
								{ projectName: "desktop-chromium", status: "expected" },
								{ projectName: "mobile-chromium", status: "flaky" },
							],
						},
						{
							tests: [
								{ projectName: "desktop-chromium", status: "unexpected" },
								{ projectName: "mobile-chromium", status: "skipped" },
							],
						},
					],
				},
			],
		},
	],
};

const metric = (
	total: number,
	covered: number,
): { total: number; covered: number; pct: number } => ({
	total,
	covered,
	pct: Math.round((covered / total) * 10000) / 100,
});
const coverageJson = {
	total: { lines: metric(200, 191), branches: metric(10, 9), functions: metric(4, 4) },
	"/repo/src/lib/server/a.ts": {
		lines: metric(100, 99),
		branches: metric(5, 5),
		functions: metric(2, 2),
	},
	"/repo/src/lib/server/b.ts": {
		lines: metric(60, 52),
		branches: metric(3, 2),
		functions: metric(1, 1),
	},
	"/repo/src/lib/server/types.ts": {
		lines: { total: 0, covered: 0, pct: 0 },
		branches: { total: 0, covered: 0, pct: 0 },
		functions: { total: 0, covered: 0, pct: 0 },
	},
	"/repo/src/lib/shared/c.ts": {
		lines: metric(40, 38),
		branches: metric(2, 2),
		functions: metric(1, 1),
	},
};

describe("test report", () => {
	it("counts Vitest results by project", () => {
		const s = summarizeVitest(vitestJson, "vitest/index.html");
		expect(s.total).toEqual({ passed: 3, failed: 1, skipped: 1, flaky: 0 });
		expect(s.groups).toEqual({
			server: { passed: 2, failed: 0, skipped: 1, flaky: 0 },
			"client (browser)": { passed: 1, failed: 1, skipped: 0, flaky: 0 },
		});
		expect(s.finishedAt).toBe("2026-10-02T10:00:05.000Z");
		expect(summarizeVitest({}, null).finishedAt).toBeNull();
	});

	it("counts Playwright results by project, nested suites included", () => {
		const s = summarizePlaywright(playwrightJson, null);
		expect(s.total).toEqual({ passed: 2, failed: 1, skipped: 1, flaky: 1 });
		expect(s.groups["mobile-chromium"]).toEqual({ passed: 0, failed: 0, skipped: 1, flaky: 1 });
		expect(s.finishedAt).toBe("2026-10-02T10:02:00.000Z");
		expect(summarizePlaywright({}, null).finishedAt).toBeNull();
	});

	it("lists the files under the line target, most uncovered lines first", () => {
		const c = summarizeCoverage(coverageJson, "coverage/index.html", "/repo");
		expect(c.lines).toBe(95.5);
		// exactly on the target is not under it
		expect(c.below).toEqual([{ file: "src/lib/server/b.ts", pct: 86.67, uncovered: 8 }]);
	});

	it("renders the page with links, failures and escaped names", () => {
		const html = renderIndex(
			summarizeVitest(vitestJson, "vitest/index.html"),
			null,
			summarizeCoverage(coverageJson, null, "/repo"),
			new Date("2026-10-02T10:05:00Z"),
		);
		expect(html).toContain('<a href="vitest/index.html">');
		expect(html).toContain("✗ 1 failed");
		expect(html).toContain("No results: the suite has not run yet.");
		expect(html).toContain("src/lib/server/b.ts");
		expect(html).toContain("2026-10-02 10:05:00 UTC");
		const passing = renderIndex(
			{
				...summarizePlaywright(playwrightJson, null),
				groups: { "<x>": { passed: 1, failed: 0, skipped: 0, flaky: 0 } },
				total: { passed: 1, failed: 0, skipped: 0, flaky: 0 },
			},
			null,
			null,
			new Date(),
		);
		expect(passing).toContain("✓ passed");
		expect(passing).toContain("&lt;x&gt;");
		expect(passing).toContain("No coverage summary");
	});

	it("writes the index from the files the runs left, missing ones included", () => {
		const dir = mkdtempSync(join(tmpdir(), "bv-test-report-"));
		try {
			writeFileSync(join(dir, "vitest-results.json"), JSON.stringify(vitestJson));
			mkdirSync(join(dir, "vitest"));
			writeFileSync(join(dir, "vitest", "index.html"), "");
			writeFileSync(join(dir, "playwright-results.json"), "{ not json");
			mkdirSync(join(dir, "vitest", "coverage"));
			writeFileSync(
				join(dir, "vitest", "coverage", "coverage-summary.json"),
				JSON.stringify(coverageJson),
			);
			const path = writeIndex(dir, "/repo");
			const html = readFileSync(path, "utf8");
			expect(path).toBe(join(dir, "index.html"));
			expect(html).toContain('<a href="vitest/index.html">');
			expect(html).toContain("No results: the suite has not run yet.");
			expect(html).toContain("95.50 % of lines");
			expect(html).not.toContain('href="vitest/coverage/index.html"');
		} finally {
			rmSync(dir, { recursive: true, force: true });
		}
	});
});
