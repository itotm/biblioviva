// SPDX-License-Identifier: GPL-3.0-or-later
// PWA (step 9.9): the manifest and the icons are reachable without a session and make the app
// installable (Chromium's own installability check); the service worker keeps the built chunks,
// OpenCV.js included, and serves them from its cache, while the health check, remote functions,
// pages and media always come from the server.
import { expect, request, test, type Response } from "@playwright/test";
import { waitForHydration } from "./helpers/hydration.js";

test.use({ serviceWorkers: "allow" });

test.describe("installable app", () => {
	test("manifest and icons without a session", async ({ baseURL }) => {
		const anonymous = await request.newContext({
			baseURL,
			extraHTTPHeaders: { "x-forwarded-proto": "http" },
		});
		const res = await anonymous.get("/manifest.webmanifest");
		expect(res.status()).toBe(200);
		expect(res.headers()["content-type"]).toContain("application/manifest+json");
		const manifest = (await res.json()) as {
			short_name: string;
			start_url: string;
			display: string;
			theme_color: string;
			icons: { src: string; sizes: string; purpose: string }[];
		};
		expect(manifest).toMatchObject({
			short_name: "BiblioViva",
			start_url: "/",
			display: "standalone",
		});
		expect(manifest.theme_color).toMatch(/^#[0-9a-f]{6}$/);
		for (const icon of manifest.icons) {
			const png = await anonymous.get(icon.src);
			expect(png.status(), icon.src).toBe(200);
			expect(png.headers()["content-type"]).toBe("image/png");
		}
		await anonymous.dispose();
	});

	test("the worker keeps the shell and nothing else", async ({ page, browserName }) => {
		await page.goto("/");
		await waitForHydration(page);
		await expect(page.locator('link[rel="manifest"]')).toHaveAttribute(
			"href",
			"/manifest.webmanifest",
		);
		await expect(page.locator('meta[name="theme-color"]')).toHaveAttribute(
			"content",
			/^#[0-9a-f]{6}$/,
		);
		const script = await page.evaluate(async () => {
			const registration = await navigator.serviceWorker.ready;
			return registration.active?.scriptURL ?? "";
		});
		expect(script).toMatch(/\/service-worker\.js$/);

		// Chromium's installability check (what the install prompt and Lighthouse relied on);
		// the other engines of `bun run test:browsers` have no such protocol
		if (browserName === "chromium") {
			const cdp = await page.context().newCDPSession(page);
			const { installabilityErrors } = (await cdp.send("Page.getInstallabilityErrors")) as {
				installabilityErrors: { errorId: string }[];
			};
			expect(installabilityErrors.map((e) => e.errorId)).toEqual([]);
		}

		const cached = await page.evaluate(async () => {
			const keys = await caches.keys();
			const cache = await caches.open(keys[0] ?? "");
			return { keys, urls: (await cache.keys()).map((r) => new URL(r.url).pathname) };
		});
		expect(cached.keys).toHaveLength(1);
		expect(cached.keys[0]).toMatch(/^biblioviva-/);
		expect(cached.urls.some((u) => /\/_app\/immutable\/.+\.js$/.test(u))).toBe(true);
		const opencv = cached.urls.find((u) => /opencv[^/]*\.js$/.test(u));
		expect(opencv).toBeDefined();
		expect(cached.urls.find((u) => u.endsWith(".wasm"))).toBeDefined();
		expect(
			cached.urls.filter(
				(u) => /^\/(media|_app\/remote|healthz|export)\b/.test(u) || u === "/",
			),
		).toEqual([]);

		// with the worker in control: the chunks come from its cache, the rest from the server
		await page.reload();
		await waitForHydration(page);
		const responses: Response[] = [];
		page.on("response", (r) => responses.push(r));
		// a client-side navigation: page data and a remote query
		await page.getByTestId("quick-inventory").click();
		await expect(page).toHaveURL(/\/inventory$/);
		await expect(
			page.getByTestId("inventory-current").or(page.getByTestId("inventory-start")),
		).toBeVisible();
		const fetched = await page.evaluate(async (url) => {
			await fetch(url);
			await fetch("/healthz");
			return true;
		}, opencv ?? "");
		expect(fetched).toBe(true);
		await expect.poll(() => responses.some((r) => r.url().endsWith("/healthz"))).toBe(true);

		const from = (test: (path: string) => boolean): boolean[] =>
			responses
				.filter((r) => test(new URL(r.url()).pathname))
				.map((r) => r.fromServiceWorker());
		expect(from((p) => p === "/healthz")).toEqual([false]);
		expect(from((p) => p.startsWith("/_app/remote/")).length).toBeGreaterThan(0);
		expect(from((p) => p.startsWith("/_app/remote/"))).not.toContain(true);
		expect(from((p) => p.endsWith("__data.json"))).not.toContain(true);
		expect(from((p) => p === opencv)).toEqual([true]);
		expect(from((p) => /\/_app\/immutable\/.+\.js$/.test(p) && p !== opencv)).not.toContain(
			false,
		);
	});
});
