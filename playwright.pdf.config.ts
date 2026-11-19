// SPDX-License-Identifier: GPL-3.0-or-later
// `bun run docs:pdf` (step 9.63, ADR-059) and `bun run manual:pdf` (step 9.5): the section Normativa and the
// manual of the documentation printed by Chromium into one PDF per language, from the print pages that
// `bun run site:build` writes, into `site/dist/`. Run after `site:build`; the site is served by `site:serve`
// for the run (on port 5175, or on `SITE_PORT`).
import { defineConfig } from "@playwright/test";

const port = process.env.SITE_PORT ?? "5175";

export default defineConfig({
	testDir: "tests/docs",
	testMatch: ["pdf.spec.ts", "manual-pdf.spec.ts"],
	workers: 1,
	retries: 0,
	timeout: 120_000,
	reporter: [["list"]],
	use: { baseURL: `http://localhost:${port}` },
	projects: [{ name: "docs-pdf", use: { browserName: "chromium" } }],
	webServer: {
		command: "bun run site:serve",
		url: `http://localhost:${port}/it/`,
		reuseExistingServer: !process.env.CI,
		timeout: 30_000,
	},
});
