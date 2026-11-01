// SPDX-License-Identifier: GPL-3.0-or-later
// Size budget of the core pages (PLAN.md §3.14, step 9.2): the JavaScript a page loads — measured
// gzipped, as it travels — stays within 250 KB on the dashboard, the circulation desk, the patrons
// and the catalogue; the barcode reader and OpenCV are never part of it (lazy chunks).
import { gzipSync } from "node:zlib";
import { expect, test } from "@playwright/test";
import { waitForHydration } from "./helpers/hydration.js";

const BUDGET = 250 * 1024;
const PAGES = ["/", "/circulation/checkout", "/circulation/checkin", "/patrons", "/catalog"];

test.describe("size budget", () => {
	for (const path of PAGES) {
		test(`${path} loads at most 250 KB of JavaScript`, async ({ page, isMobile }) => {
			test.skip(isMobile, "the same bundles on both viewports");
			const scripts = new Map<string, number>();
			page.on("response", async (response) => {
				if (response.request().resourceType() === "script" && response.ok()) {
					const body = await response.body().catch(() => null);
					if (body) {
						scripts.set(response.url(), gzipSync(body, { level: 9 }).byteLength);
					}
				}
			});
			await page.goto(path);
			await waitForHydration(page);
			await page.waitForLoadState("networkidle");
			const total = [...scripts.values()].reduce((n, b) => n + b, 0);
			console.log(
				`${path}: ${scripts.size} scripts, ${(total / 1024).toFixed(1)} KB gzipped`,
			);
			expect(
				[...scripts.keys()].some((u) => /opencv|zxing/i.test(u)),
				path,
			).toBe(false);
			expect(total, path).toBeLessThanOrEqual(BUDGET);
		});
	}
});
