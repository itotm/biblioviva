// SPDX-License-Identifier: GPL-3.0-or-later
// The pictures of the first-run wizard (docs/shots.ts, `wizard: true`): they need a server without
// configuration, so this spec starts its own on a fresh folder, as tests/e2e/setup-wizard.spec.ts
// does, and walks the steps in order.
import { mkdirSync } from "node:fs";
import { join } from "node:path";
import { expect } from "@playwright/test";
import { translator } from "../../docs/shots-text.js";
import { shotFile } from "../../docs/shot-windows.js";
import { PNG_DIR, SHOTS, type ShotContext } from "../../docs/shots.js";
import { waitForHydration } from "../e2e/helpers/hydration.js";
import { optionsTest as test } from "./fixtures.js";
import { freshDir, startServer, type RunningServer } from "./server.js";

let server: RunningServer | undefined;

test.describe.serial("wizard pictures", () => {
	test.beforeAll(async () => {
		// no configuration in the folder: the server starts the wizard
		server = await startServer(freshDir("wizard"), {
			PROTOCOL_HEADER: "x-forwarded-proto",
			METADATA_PROVIDER: "mock",
			DEMO: "",
			ALLOW_LANG_OVERRIDE: "",
			DEV_UI: "",
		});
	});
	test.afterAll(() => {
		server?.stop();
	});

	test(
		"every step of the wizard",
		{ tag: ["@computer", "@tablet", "@phone"] },
		async ({ page, shotLang, shotWindow }) => {
			test.setTimeout(240_000);
			const ctx: ShotContext = {
				lang: shotLang,
				window: shotWindow,
				t: translator(shotLang),
			};
			const base = server?.base ?? "";
			await page.goto(`${base}/`);
			await expect(page).toHaveURL(/\/setup/);
			await waitForHydration(page);
			const failures: string[] = [];
			for (const shot of SHOTS.filter((s) => s.wizard && s.windows.includes(shotWindow))) {
				try {
					await shot.steps?.(page, ctx);
					await page.evaluate(() => document.fonts.ready);
					await page.waitForTimeout(250);
					const file = join(PNG_DIR, shotFile(shotLang, shot.name, shotWindow, "png"));
					mkdirSync(join(file, ".."), { recursive: true });
					await page.screenshot({ path: file, animations: "disabled", caret: "hide" });
				} catch (error) {
					failures.push(`${shot.name}: ${String(error).split("\n")[0]}`);
				}
			}
			expect(failures).toEqual([]);
		},
	);
});
