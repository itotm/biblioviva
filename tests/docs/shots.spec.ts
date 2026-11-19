// SPDX-License-Identifier: GPL-3.0-or-later
// One test per picture of the shot list (docs/shots.ts) in the language and the window of the
// project it runs in: login state of the shot's account, the page (or the mock of another
// program, opened from the disk), the steps, a PNG of the viewport or of the cropped element.
// `scripts/shots-webp.ts` turns the PNGs into the lossless WebP files of `site/.shots/` afterwards.
import { mkdirSync } from "node:fs";
import { join, resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { expect } from "@playwright/test";
import { translator } from "../../docs/shots-text.js";
import { shotFile } from "../../docs/shot-windows.js";
import {
	ACCOUNTS,
	PNG_DIR,
	SHOTS,
	withLang,
	type ShotAccount,
	type ShotContext,
} from "../../docs/shots.js";
import { waitForHydration } from "../e2e/helpers/hydration.js";
import { test } from "./fixtures.js";

const SHOT_ACCOUNTS: ShotAccount[] = [
	...(Object.keys(ACCOUNTS) as (keyof typeof ACCOUNTS)[]),
	"anonymous",
];

for (const account of SHOT_ACCOUNTS) {
	const shots = SHOTS.filter((s) => s.account === account && !s.wizard);
	if (shots.length === 0) {
		continue;
	}
	test.describe(`as ${account}`, () => {
		test.use({ shotAccount: account });
		for (const shot of shots) {
			// the project of a window takes the tests tagged with it (`grep` of the config)
			test(
				shot.name,
				{ tag: shot.windows.map((w) => `@${w}`) },
				async ({ page, baseURL, shotLang, shotWindow }) => {
					test.setTimeout(shot.slow ? 120_000 : 25_000);
					const ctx: ShotContext = {
						lang: shotLang,
						window: shotWindow,
						t: translator(shotLang),
					};
					// `?lang=` only lasts for the request that carries it: a form that redirects, a link and
					// the remote calls would fall back to the configured language, so every request to the
					// server carries it (the address in the browser stays as it is)
					const origin = new URL(baseURL ?? "http://localhost").origin;
					await page.context().route(`${origin}/**`, async (route) => {
						const request = route.request();
						const url = new URL(request.url());
						if (
							!["document", "fetch", "xhr"].includes(request.resourceType()) ||
							url.searchParams.has("lang") ||
							url.pathname.startsWith("/_app/immutable/")
						) {
							await route.continue();
							return;
						}
						url.searchParams.set("lang", shotLang);
						await route.continue({ url: url.toString() });
					});
					if (shot.mock) {
						// a page of another program, drawn in docs/mocks/ (ADR-046)
						await page.goto(withLang(pathToFileURL(resolve(shot.path)).href, ctx));
					} else {
						// a page that is not there (a mistyped address) must not become a picture
						const response = await page.goto(withLang(shot.path, ctx));
						expect(response?.status(), `${shot.path} answered`).toBeLessThan(400);
						await waitForHydration(page);
					}
					await page.waitForLoadState("networkidle");
					if (shot.steps) {
						await shot.steps(page, ctx);
					}
					if (shot.focus && shotWindow !== "computer") {
						await page
							.locator(shot.focus)
							.first()
							.evaluate((el) => el.scrollIntoView({ block: "start" }));
					}
					// fonts and the last transitions settled
					await page.evaluate(() => document.fonts.ready);
					await page.waitForTimeout(250);
					const file = join(PNG_DIR, shotFile(shotLang, shot.name, shotWindow, "png"));
					mkdirSync(join(file, ".."), { recursive: true });
					const options = { path: file, animations: "disabled", caret: "hide" } as const;
					try {
						if (shot.crop) {
							const target =
								typeof shot.crop === "string"
									? page.locator(shot.crop)
									: shot.crop(page, ctx);
							await target.first().screenshot(options);
						} else {
							await page.screenshot(options);
						}
					} finally {
						if (shot.after) {
							await shot.after(page, ctx);
						}
					}
				},
			);
		}
	});
}
