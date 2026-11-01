// SPDX-License-Identifier: GPL-3.0-or-later
// Security checks seen from the browser (PLAN.md §3.15, step 9.1): the response headers (Content
// Security Policy, framing, sniffing, referrer, permissions), the session cookie flags, no page
// breaking the policy (every violation is collected in the page), and nothing reachable without a
// session except the login, the health check and the static assets.
import { expect, test } from "@playwright/test";
import { waitForHydration } from "./helpers/hydration.js";

const PAGES = [
	"/",
	"/circulation/checkout",
	"/catalog",
	"/patrons",
	"/reports/acquisitions-by-year",
	"/admin/config/labels",
	"/admin/cards/templates",
	"/admin/config/templates/cards/default",
];

test.describe("security", () => {
	test("headers and cookie flags", async ({ page, context }) => {
		const response = await page.goto("/");
		const headers = response?.headers() ?? {};
		const csp = headers["content-security-policy"] ?? "";
		expect(csp).toContain("default-src 'self'");
		expect(csp).toContain("frame-ancestors 'self'");
		expect(csp).toContain("object-src 'none'");
		expect(csp).toMatch(/script-src 'self' 'wasm-unsafe-eval' 'unsafe-eval' 'nonce-[^']+'/);
		expect(headers["x-content-type-options"]).toBe("nosniff");
		expect(headers["x-frame-options"]).toBe("SAMEORIGIN");
		expect(headers["referrer-policy"]).toBe("same-origin");
		expect(headers["permissions-policy"]).toContain("camera=(self)");
		const svg = await page.request.get("/media/barcode/2026-00017?symbology=code128");
		expect(svg.headers()["content-type"]).toContain("image/svg+xml");
		expect(svg.headers()["content-security-policy"]).toContain("sandbox");
		const session = (await context.cookies()).find((c) => c.name === "bv_session");
		expect(session).toMatchObject({ httpOnly: true, sameSite: "Lax" });
	});

	test("no page breaks the content security policy", async ({ page }) => {
		await page.addInitScript(() => {
			const w = window as unknown as { __cspViolations: string[] };
			w.__cspViolations = [];
			document.addEventListener("securitypolicyviolation", (e) => {
				w.__cspViolations.push(`${e.violatedDirective} ${e.blockedURI}`);
			});
		});
		for (const path of PAGES) {
			await page.goto(path);
			await waitForHydration(page);
			// the previews and charts of the page load after the hydration
			await page.waitForTimeout(1000);
			const violations = await page.evaluate(
				() => (window as unknown as { __cspViolations: string[] }).__cspViolations,
			);
			expect(violations, path).toEqual([]);
		}
	});

	test("nothing but the login, the health check and the assets without a session", async ({
		browser,
	}) => {
		const context = await browser.newContext({
			storageState: { cookies: [], origins: [] },
			extraHTTPHeaders: { "x-forwarded-proto": "http" },
		});
		const request = context.request;
		expect((await request.get("/healthz")).status()).toBe(200);
		expect((await request.get("/login")).status()).toBe(200);
		for (const path of [
			"/",
			"/admin",
			"/catalog",
			"/print/labels/pair?sample=1",
			"/admin/backups/export",
			"/admin/config/export",
			"/media/templates/cards/default/logo.png",
			"/media/classification/file/A.png",
		]) {
			const res = await request.get(path, { maxRedirects: 0 });
			expect([303, 401, 403], path).toContain(res.status());
			if (res.status() === 303) {
				expect(res.headers().location, path).toMatch(/^\/login/);
			}
		}
		await context.close();
	});
});
