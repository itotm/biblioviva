// SPDX-License-Identifier: GPL-3.0-or-later
// `bun run docs:shots` (PLAN.md §3.23): the pictures of the documentation, taken from the app on
// the e2e setup. It reuses the e2e configuration (the web server on a temporary seeded folder,
// the fixed fonts, the Italian locale) and replaces the projects with the shot projects, so
// `bun run test:e2e` never takes pictures. Computer window only (1280 × 800) for now.
import { resolve } from "node:path";
import { defineConfig } from "@playwright/test";
import base from "./playwright.config.js";

// the e2e fonts (the print baselines depend on them) have no alias for `system-ui`, the first
// family of the application's font stack, so the pictures get a fontconfig file of their own
const launchOptions = {
	...base.use?.launchOptions,
	env: {
		...process.env,
		FONTCONFIG_FILE: resolve("tests/fixtures/fontconfig/docs-fonts.conf"),
	},
};

export default defineConfig({
	...base,
	testDir: "tests",
	testMatch: [],
	// the shots change the shared database in a fixed order (the mutating ones last)
	workers: 1,
	retries: 0,
	timeout: 25_000,
	reporter: [["list"]],
	expect: {},
	use: { ...base.use, launchOptions },
	projects: [
		{ name: "shots-setup", testMatch: "e2e/auth.setup.ts" },
		{ name: "shots-login", testMatch: "docs/login.setup.ts", dependencies: ["shots-setup"] },
		{
			name: "docs-shots-computer",
			testMatch: "docs/shots.spec.ts",
			dependencies: ["shots-login"],
			use: {
				...base.projects?.[1]?.use,
				viewport: { width: 1280, height: 800 },
				deviceScaleFactor: 1,
				storageState: undefined,
				launchOptions,
			},
		},
		// the wizard needs a server without configuration: it starts its own
		{
			name: "docs-shots-wizard",
			testMatch: "docs/wizard.spec.ts",
			use: {
				...base.projects?.[1]?.use,
				viewport: { width: 1280, height: 800 },
				deviceScaleFactor: 1,
				storageState: undefined,
				launchOptions,
			},
		},
	],
});
