// SPDX-License-Identifier: GPL-3.0-or-later
// The red state of the installation check (step 8.7): an account that still has the example
// password (here made through the accounts page, so its hash is what is checked) turns the
// accounts' card red, names the account and links its guide, and the administrator's dashboard
// reminds of it with a button to the check; once the account is switched off it is not counted
// and the reminder goes. It changes the shared configuration, so it runs once every other spec is
// done (project `final`).
import { expect, test } from "@playwright/test";
import { expectAxeClean } from "../helpers/axe.js";
import { waitForHydration } from "../helpers/hydration.js";

test("an account with the example password turns the check red and the dashboard reminds of it", async ({
	page,
}) => {
	// nothing is red to begin with
	await page.goto("/");
	await waitForHydration(page);
	await expect(page.getByTestId("setup-reminder")).toHaveCount(0);

	await page.goto("/admin/users");
	await waitForHydration(page);
	const dialog = page.getByTestId("account-dialog");
	await page.getByTestId("account-new").click();
	await dialog.getByTestId("account-username").fill("e2e-esempio");
	await dialog.getByTestId("account-display-name").fill("Prova password di esempio");
	await dialog.getByTestId("account-role-reporting").check();
	await dialog.getByTestId("account-password").fill("cambiami");
	await dialog.getByTestId("account-password-repeat").fill("cambiami");
	await dialog.getByTestId("account-save").click();
	await expect(page.getByRole("status").getByText("Account creato")).toBeVisible();

	// the check: red, with the account's name and the guide that explains it
	await page.goto("/admin/setup");
	await waitForHydration(page);
	await expect(page.getByTestId("setup-summary")).toHaveAttribute("data-state", "error");
	await expect(page.getByTestId("setup-summary")).toContainText("Un controllo da correggere");
	const accounts = page.getByTestId("check-accounts");
	await expect(accounts).toHaveAttribute("data-state", "error");
	await expect(accounts.getByTestId("status-badge")).toHaveText("Da correggere");
	await expect(page.getByTestId("finding-accounts-example")).toContainText("e2e-esempio");
	await expect(page.getByTestId("guide-accounts")).toHaveAttribute(
		"href",
		/docs\.biblioviva\.org\/it\/admin\/guides\/change-a-password\/$/,
	);
	await expectAxeClean(page);

	// the dashboard reminds the administrator while it is red
	await page.goto("/");
	await waitForHydration(page);
	const reminder = page.getByTestId("setup-reminder");
	await expect(reminder).toContainText("L'installazione ha qualcosa da correggere");
	await expect(reminder).toContainText("Un controllo non è a posto");
	await page.getByTestId("setup-reminder-link").click();
	await expect(page).toHaveURL(/\/admin\/setup$/);

	// switched off, the account is not counted: green again, and no reminder
	await page.goto("/admin/users");
	await waitForHydration(page);
	const card = page.getByTestId("account-e2e-esempio");
	await card.getByTestId("account-edit").click();
	await dialog.getByTestId("account-active").uncheck();
	await dialog.getByTestId("account-save").click();
	await expect(card).toContainText("Disattivato");
	await page.goto("/admin/setup");
	await waitForHydration(page);
	await expect(page.getByTestId("finding-accounts-example")).toHaveCount(0);
	await expect(page.getByTestId("check-accounts")).not.toHaveAttribute("data-state", "error");
	await page.goto("/");
	await waitForHydration(page);
	await expect(page.getByTestId("setup-reminder")).toHaveCount(0);

	// the account is taken away again for the other tests
	await page.goto("/admin/users");
	await waitForHydration(page);
	await page.getByTestId("account-e2e-esempio").getByTestId("account-remove").click();
	await page.getByTestId("confirm-dialog").getByTestId("confirm-button").click();
	await expect(page.getByRole("status").getByText("Account eliminato")).toBeVisible();
});
