// SPDX-License-Identifier: GPL-3.0-or-later
// The home page of biblioviva.org (home/, step 9.7), served from the built files: the three steps
// of the desk light up one after the other as the reader scrolls, and the bright one is always in
// sight — beside the pinned screen on a wide window, below it when the two stack (an iPad held
// upright) —, with reduced motion too (an iPad with "Riduci movimento": the steps change without
// fading, the other effects stay still) and on a touch screen (a phone, an iPad: the steps alone
// move, every other effect stays still).
import { expect, test } from "@playwright/test";
import { buildHome } from "../../scripts/home-build.js";

const SITE = "https://biblioviva.test/";

test.describe("home page of biblioviva.org", () => {
	for (const [viewport, motion, touch] of [
		[{ width: 1280, height: 800 }, "no-preference", false],
		[{ width: 1180, height: 820 }, "no-preference", false],
		[{ width: 820, height: 1180 }, "no-preference", false],
		[{ width: 768, height: 1024 }, "no-preference", false],
		[{ width: 820, height: 1180 }, "reduce", false],
		[{ width: 820, height: 1180 }, "no-preference", true],
		[{ width: 412, height: 915 }, "no-preference", true],
	] as const) {
		test(`the desk steps light up in sight at ${String(viewport.width)} × ${String(viewport.height)}, motion ${motion}${touch ? ", touch" : ""}`, async ({
			browser,
			isMobile,
		}) => {
			test.skip(isMobile, "each case sets its own window");
			const files = buildHome();
			const context = await browser.newContext({
				viewport,
				hasTouch: touch,
				reducedMotion: motion,
			});
			const page = await context.newPage();
			await page.route(`${SITE}**`, (route) => {
				const path = new URL(route.request().url()).pathname.slice(1);
				const file = files.get(path === "" ? "index.html" : path);
				return file === undefined
					? route.fulfill({ status: 404 })
					: route.fulfill({
							body: typeof file === "string" ? file : Buffer.from(file),
							contentType: path.endsWith(".css")
								? "text/css"
								: path.endsWith(".webp")
									? "image/webp"
									: "text/html",
						});
			});
			await page.goto(SITE);
			// the scroll effects and the glow of the last section run only with a mouse and motion
			const still = motion === "reduce" || touch;
			await expect(page.locator("html.anim")).toHaveCount(still ? 0 : 1);
			expect(
				await page.evaluate(
					() =>
						getComputedStyle(document.querySelector(".final")!, "::before")
							.animationName,
				),
			).toBe(still ? "none" : "spin");

			const top = await page.evaluate(
				() => document.querySelector("#banco")!.getBoundingClientRect().top + scrollY,
			);
			const height = await page.evaluate(
				() => document.querySelector<HTMLElement>("#banco")!.offsetHeight,
			);
			const lit = new Set<string>();
			for (let y = top - viewport.height; y < top + height; y += 40) {
				await page.evaluate((to) => scrollTo(0, to), y);
				await page.waitForTimeout(80);
				const seen = await page.evaluate(() => {
					const steps = document.querySelector<HTMLElement>("[data-steps]")!;
					const stage = steps.querySelector(".desk-stage")!.getBoundingClientRect();
					const list = steps.querySelector(".desk-steps")!.getBoundingClientRect();
					// stacked: the part of the window under the pinned screen; side by side: all of it
					const from = list.left < stage.right ? Math.max(0, stage.bottom) : 0;
					const visible = (r: DOMRect): number =>
						Math.max(0, Math.min(innerHeight, r.bottom) - Math.max(from, r.top)) /
						r.height;
					const all = [...steps.querySelectorAll<HTMLElement>(".step")].map((s) => ({
						n: s.dataset.n ?? "",
						visible: visible(s.getBoundingClientRect()),
					}));
					return {
						active: steps.dataset.step ?? "",
						activeVisible: all.find((s) => s.n === steps.dataset.step)?.visible ?? 0,
						anyInSight: all.some((s) => s.visible === 1),
					};
				});
				if (seen.anyInSight) {
					// a step is read in full: the bright one is (at least half) in sight too
					expect(
						seen.activeVisible,
						`step ${seen.active} at ${String(y)}`,
					).toBeGreaterThanOrEqual(0.5);
					lit.add(seen.active);
				}
			}
			expect([...lit].sort()).toEqual(["2", "3", "4"]);
			await context.close();
		});
	}
});
