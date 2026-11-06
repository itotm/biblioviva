// SPDX-License-Identifier: GPL-3.0-or-later
// `bun run docs:diagrams` (step 9.53): the Mermaid diagrams of the documentation (the database's
// in `docs/database.md`, the navigation map) drawn into SVG files in `site/.diagrams/` by Mermaid
// in the browser, so the site shows pictures and carries no script for them. No web server.
import { defineConfig } from "@playwright/test";

export default defineConfig({
	testDir: "tests/docs",
	testMatch: "diagrams.spec.ts",
	workers: 1,
	retries: 0,
	timeout: 120_000,
	reporter: [["list"]],
	projects: [{ name: "docs-diagrams", use: { browserName: "chromium" } }],
});
