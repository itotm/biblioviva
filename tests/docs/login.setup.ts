// SPDX-License-Identifier: GPL-3.0-or-later
// Logs in as each shared account of the test configuration and saves one storage state per account,
// used by the shots (docs/shots.ts).
import { expect, test as setup } from "@playwright/test";
import { ACCOUNTS } from "../../docs/shots.js";
import { stateFile } from "./state.js";
import { LoginPage } from "../e2e/pages/login.page.js";

for (const [account, password] of Object.entries(ACCOUNTS)) {
	setup(`log in as ${account}`, async ({ page }) => {
		const login = new LoginPage(page);
		await login.goto();
		await login.loginAs(account, password);
		await expect(page).not.toHaveURL(/\/login/);
		await page.context().storageState({ path: stateFile(account) });
	});
}
