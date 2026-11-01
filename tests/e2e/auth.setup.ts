// SPDX-License-Identifier: GPL-3.0-or-later
// Runs once before the browser projects: seeds the test database with the synthetic data set
// (PLAN.md step 1.2, deterministic, no real person) and logs in as admin, saving the storage
// state used by every other project.
import { execFileSync } from "node:child_process";
import { join } from "node:path";
import { expect, test as setup } from "@playwright/test";
import { STORAGE_STATE } from "../../playwright.config.js";
import { LoginPage } from "./pages/login.page.js";

setup("seed the database", () => {
	const runDir = process.env.BV_E2E_RUN_DIR ?? "";
	// the server keeps the file open; SQLite serialises the writers (busy timeout in client.ts)
	const out = execFileSync("bun", ["run", "scripts/seed.ts", "--if-empty"], {
		encoding: "utf8",
		env: {
			...process.env,
			DATA_DIR: join(runDir, "data"),
			CONFIG_DIR: join(runDir, "config"),
			DATABASE_PATH: join(runDir, "data", "db", "biblioviva.db"),
		},
	});
	expect(out).toMatch(/Seeded|Skipped/);
});

setup("log in as admin", async ({ page }) => {
	const login = new LoginPage(page);
	await login.goto();
	await login.loginAs("admin", "admin-test-pw");
	await expect(page).toHaveURL(/\/$/);
	await page.context().storageState({ path: STORAGE_STATE });
});
