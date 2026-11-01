// SPDX-License-Identifier: GPL-3.0-or-later
// One test per picture of the shot list (docs/shots.ts): login state of the shot's account, the
// page (or the mock of another program, opened from the disk), the steps, a PNG of the viewport
// or of the cropped element. `scripts/shots-webp.ts` turns the PNGs into the lossless WebP files
// of `site/.shots/` afterwards.
import { mkdirSync } from "node:fs";
import { join, resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { test } from "@playwright/test";
import { ACCOUNTS, PNG_DIR, SHOTS, type ShotAccount } from "../../docs/shots.js";
import { waitForHydration } from "../e2e/helpers/hydration.js";
import { stateFile } from "./state.js";

const LANG = "it";

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
		test.use({
			storageState:
				account === "anonymous" ? { cookies: [], origins: [] } : stateFile(account),
		});
		for (const shot of shots) {
			test(shot.name, async ({ page }) => {
				test.setTimeout(shot.slow ? 120_000 : 25_000);
				if (shot.mock) {
					// a page of another program, drawn in docs/mocks/ (ADR-046)
					await page.goto(`${pathToFileURL(resolve(shot.path)).href}?lang=${LANG}`);
				} else {
					const sep = shot.path.includes("?") ? "&" : "?";
					await page.goto(`${shot.path}${sep}lang=${LANG}`);
					await waitForHydration(page);
				}
				await page.waitForLoadState("networkidle");
				if (shot.steps) {
					await shot.steps(page);
				}
				// fonts and the last transitions settled
				await page.evaluate(() => document.fonts.ready);
				await page.waitForTimeout(250);
				const file = join(PNG_DIR, LANG, `${shot.name}.png`);
				mkdirSync(join(file, ".."), { recursive: true });
				const options = { path: file, animations: "disabled", caret: "hide" } as const;
				try {
					if (shot.crop) {
						const target =
							typeof shot.crop === "string"
								? page.locator(shot.crop)
								: shot.crop(page);
						await target.first().screenshot(options);
					} else {
						await page.screenshot(options);
					}
				} finally {
					if (shot.after) {
						await shot.after(page);
					}
				}
			});
		}
	});
}
