// SPDX-License-Identifier: GPL-3.0-or-later
// `bun run docs:shots` (PLAN.md §3.23): the pictures of the documentation, taken from the app on
// the e2e setup. It reuses the e2e configuration (the fixed fonts, the Italian locale, the
// environment of the web server) and replaces the projects with the shot projects, so
// `bun run test:e2e` never takes pictures. One project for each language in each window
// (computer 1280 × 800 at scale 1, tablet 834 × 1194 and phone 412 × 915 at scale 2); every
// project starts its own server on a fresh seeded folder (tests/docs/fixtures.ts), so the passes
// are independent and run side by side. `BV_SHOTS_LANGS=it` and `BV_SHOTS_WINDOWS=computer,phone`
// narrow a run, `BV_SHOTS_WORKERS` sets how many passes run at once (three, one on GitHub's runners).
import { resolve } from "node:path";
import { defineConfig } from "@playwright/test";
import { runLangs, runWindows, WINDOW_SIZES, type Window } from "./docs/shot-windows.js";
import base from "./playwright.config.js";
import type { ShotOptions } from "./tests/docs/fixtures.js";

// the e2e fonts (the print baselines depend on them) have no alias for `system-ui`, the first
// family of the application's font stack, so the pictures get a fontconfig file of their own
const launchOptions = {
	...base.use?.launchOptions,
	env: {
		...process.env,
		FONTCONFIG_FILE: resolve("tests/fixtures/fontconfig/docs-fonts.conf"),
	},
};

// the project the e2e suite runs on a computer and on a phone: the shots reuse their device settings
const desktop = base.projects?.[1]?.use ?? {};
const mobile = base.projects?.[2]?.use ?? {};

/** The browser settings of a window; a tablet is the phone's touch screen at its own size. */
function windowUse(window: Window, lang: string): NonNullable<typeof base.use> {
	const { width, height, scale } = WINDOW_SIZES[window];
	return {
		...(window === "computer" ? desktop : mobile),
		viewport: { width, height },
		deviceScaleFactor: scale,
		storageState: undefined,
		// the browser's own language too: the placeholder of a date field follows it
		launchOptions: {
			...launchOptions,
			args: [...(launchOptions.args ?? []), `--lang=${lang}`],
		},
	};
}

const windows = runWindows();
const projects = runLangs().flatMap((lang) =>
	windows.flatMap((window) => {
		const use = { ...windowUse(window, lang), shotLang: lang, shotWindow: window };
		const grep = new RegExp(`@${window}\\b`);
		return [
			{ name: `shots-${lang}-${window}`, testMatch: "docs/shots.spec.ts", grep, use },
			// the wizard needs a server without configuration: it starts its own
			{ name: `wizard-${lang}-${window}`, testMatch: "docs/wizard.spec.ts", grep, use },
		];
	}),
);

export default defineConfig<ShotOptions>({
	...base,
	testDir: "tests",
	testMatch: [],
	// the application is built once, here; every project starts its own server
	globalSetup: "./tests/docs/build.setup.ts",
	webServer: undefined,
	// the shots of a pass change its database in a fixed order (the mutating ones last)
	fullyParallel: false,
	workers: Number(process.env.BV_SHOTS_WORKERS ?? (process.env.CI ? 1 : 3)),
	retries: 0,
	timeout: 25_000,
	reporter: [["list"]],
	expect: {},
	use: { ...base.use, launchOptions },
	projects,
});
