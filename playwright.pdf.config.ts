// SPDX-License-Identifier: GPL-3.0-or-later
// `bun run docs:pdf` (step 9.63, ADR-059): the section Norme of the documentation printed by Chromium
// into one PDF per language, from the print page that `bun run site:build` writes, into `site/dist/`
// beside the section. Run after `site:build`; the site is served by `site:serve` for the run.
import { defineConfig } from "@playwright/test";

export default defineConfig({
	testDir: "tests/docs",
	testMatch: "pdf.spec.ts",
	workers: 1,
	retries: 0,
	timeout: 120_000,
	reporter: [["list"]],
	use: { baseURL: "http://localhost:5175" },
	projects: [{ name: "docs-pdf", use: { browserName: "chromium" } }],
	webServer: {
		command: "bun run site:serve",
		url: "http://localhost:5175/it/",
		reuseExistingServer: !process.env.CI,
		timeout: 30_000,
	},
});
