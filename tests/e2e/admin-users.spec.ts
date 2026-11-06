// SPDX-License-Identifier: GPL-3.0-or-later
// Staff accounts page (step 1.8, editable since 11.7): list, hash helper, reload; an account created,
// used to sign in, given a new password, deactivated and deleted; a role added, renamed and removed;
// the last administrator kept; a permission-limited account sees only its areas. The configuration
// is shared: only the desktop project changes it, with accounts and roles no other spec uses.
import { expect, test } from "@playwright/test";
import { expectAxeClean } from "./helpers/axe.js";
import { waitForHydration } from "./helpers/hydration.js";
import { LoginPage } from "./pages/login.page.js";

test.describe("admin staff accounts", () => {
	test("lists the config accounts, generates a hash and reloads the configuration", async ({
		page,
	}) => {
		await page.goto("/admin/users");
		await waitForHydration(page);
		await expect(page.getByRole("heading", { level: 1 })).toHaveText("Account del personale");
		const list = page.getByTestId("accounts-list");
		await expect(list.getByTestId("account-admin")).toContainText("admin");
		await expect(list.getByTestId("account-prestiti")).toContainText("circulation");
		// the fixture uses clear passwords: every account carries the warning
		await expect(
			list.getByTestId("account-admin").getByTestId("account-warning"),
		).toContainText("Password in chiaro");
		await expectAxeClean(page);

		await page.getByTestId("hash-disclosure").locator("summary").click();
		await page.getByLabel(/^Password/).fill("nuova-password-2026");
		await page.getByRole("button", { name: "Genera hash" }).click();
		await expect(page.getByTestId("hash-output")).toHaveValue(
			/^\$argon2id\$v=19\$m=\d+,t=\d+,p=\d+\$/,
		);

		await page.getByTestId("reload-config").click();
		await expect(page.getByRole("status").getByText("Configurazione ricaricata")).toBeVisible();
	});

	test("accounts: created, used, new password, deactivated, deleted; the last admin kept", async ({
		page,
		browser,
		isMobile,
	}) => {
		test.skip(isMobile, "the configuration is shared: one project changes it");
		await page.goto("/admin/users");
		await waitForHydration(page);
		const dialog = page.getByTestId("account-dialog");
		await page.getByTestId("account-new").click();
		await dialog.getByTestId("account-username").fill("E2E");
		await expect(dialog).toContainText("Solo minuscole");
		await dialog.getByTestId("account-username").fill("e2e-report");
		await dialog.getByTestId("account-display-name").fill("Prova report");
		await dialog.getByTestId("account-role-reporting").check();
		await dialog.getByTestId("account-password").fill("password-di-prova");
		await dialog.getByTestId("account-password-repeat").fill("password-diversa");
		await expect(dialog.getByTestId("account-save")).toBeDisabled();
		await dialog.getByTestId("account-password-repeat").fill("password-di-prova");
		await dialog.getByTestId("account-save").click();
		await expect(page.getByRole("status").getByText("Account creato")).toBeVisible();
		const card = page.getByTestId("account-e2e-report");
		await expect(card).toContainText("Report");

		const signIn = async (password: string): Promise<void> => {
			const context = await browser.newContext({
				extraHTTPHeaders: { "x-forwarded-proto": "http" },
				storageState: { cookies: [], origins: [] },
			});
			const other = await context.newPage();
			const login = new LoginPage(other);
			await login.goto();
			await login.loginAs("e2e-report", password);
			await expect(other).not.toHaveURL(/\/login/);
			await context.close();
		};
		await signIn("password-di-prova");

		await card.getByTestId("account-password-button").click();
		await dialog.getByTestId("account-password").fill("seconda-password");
		await dialog.getByTestId("account-password-repeat").fill("seconda-password");
		await dialog.getByTestId("account-save").click();
		await expect(page.getByRole("status").getByText("Password cambiata")).toBeVisible();
		await signIn("seconda-password");

		// the only administrator cannot lose the permission
		await page.getByTestId("account-admin").getByTestId("account-edit").click();
		await dialog.getByTestId("account-active").uncheck();
		await dialog.getByTestId("account-save").click();
		await expect(dialog.getByTestId("account-problem")).toContainText(
			"almeno un account attivo con il permesso di amministrazione",
		);
		await dialog.getByRole("button", { name: "Annulla" }).click();

		await card.getByTestId("account-edit").click();
		await dialog.getByTestId("account-active").uncheck();
		await dialog.getByTestId("account-save").click();
		await expect(card).toContainText("Disattivato");
		await card.getByTestId("account-remove").click();
		await page.getByTestId("confirm-dialog").getByTestId("confirm-button").click();
		await expect(page.getByRole("status").getByText("Account eliminato")).toBeVisible();
		await expect(card).toContainText("Tolto dalla configurazione");
	});

	test("a personal account changes the password it was given at the first login (9.51)", async ({
		page,
		browser,
		isMobile,
	}) => {
		test.skip(isMobile, "the configuration is shared: one project changes it");
		await page.goto("/admin/users");
		await waitForHydration(page);
		const dialog = page.getByTestId("account-dialog");
		await page.getByTestId("account-new").click();
		await dialog.getByTestId("account-username").fill("e2e-persona");
		await dialog.getByTestId("account-display-name").fill("Anna Bianchi");
		await dialog.getByTestId("account-role-circulation").check();
		await dialog.getByTestId("account-password").fill("password-data-2026");
		await dialog.getByTestId("account-password-repeat").fill("password-data-2026");
		// a person's account: on by default
		await expect(dialog.getByTestId("account-must-change-box")).toBeChecked();
		await dialog.getByTestId("account-save").click();
		await expect(page.getByRole("status").getByText("Account creato")).toBeVisible();
		const card = page.getByTestId("account-e2e-persona");
		await expect(card.getByTestId("account-must-change")).toBeVisible();

		const context = await browser.newContext({
			extraHTTPHeaders: { "x-forwarded-proto": "http" },
			storageState: { cookies: [], origins: [] },
		});
		const other = await context.newPage();
		const login = new LoginPage(other);
		await login.goto();
		await login.loginAs("e2e-persona", "password-data-2026");
		// nothing else opens until the password is changed
		await expect(other).toHaveURL(/\/password$/);
		await expect(other.getByTestId("password-forced")).toBeVisible();
		await other.goto("/catalog");
		await expect(other).toHaveURL(/\/password$/);
		await waitForHydration(other);
		await expectAxeClean(other);
		await other.getByTestId("password-current").fill("non-questa");
		await other.getByTestId("password-new").fill("la-mia-password");
		await other.getByTestId("password-repeat").fill("la-mia-password");
		await other.getByTestId("password-save").click();
		await expect(other.getByTestId("password-problem")).toHaveText(
			"La password attuale non è giusta.",
		);
		await other.getByTestId("password-current").fill("password-data-2026");
		await other.getByTestId("password-save").click();
		// the desk account opens on the desk, with its own permissions
		await expect(other).toHaveURL(/\/circulation\/checkout$/);
		await waitForHydration(other);
		await other.getByTestId("user-menu").click();
		await other.getByTestId("menu-password").click();
		await expect(other).toHaveURL(/\/password$/);
		await expect(other.getByTestId("password-forced")).toHaveCount(0);
		await context.close();

		await page.reload();
		await waitForHydration(page);
		await expect(card.getByTestId("account-must-change")).toHaveCount(0);
		await card.getByTestId("account-edit").click();
		await dialog.getByTestId("account-active").uncheck();
		await dialog.getByTestId("account-save").click();
		await expect(card).toContainText("Disattivato");
		await card.getByTestId("account-remove").click();
		await page.getByTestId("confirm-dialog").getByTestId("confirm-button").click();
		await expect(page.getByRole("status").getByText("Account eliminato")).toBeVisible();
	});

	test("roles: added, renamed and removed; a role in use kept", async ({ page, isMobile }) => {
		await page.goto("/admin/users");
		await waitForHydration(page);
		const editor = page.getByTestId("roles-editor");
		const admin = editor.locator('[data-testid="role-row"][data-role="admin"]');
		await expect(admin.getByTestId("role-grant-*")).toBeChecked();
		await expect(admin.getByTestId("role-grant-loans")).toBeDisabled();
		await expect(admin.getByTestId("role-remove")).toBeDisabled();
		await expectAxeClean(page);
		test.skip(isMobile, "the configuration is shared: one project changes it");

		const save = async (): Promise<void> => {
			await Promise.all([
				page.waitForResponse((r) => r.url().includes("saveStaffRoles")),
				editor.getByTestId("roles-save").click(),
			]);
			await expect(editor.getByTestId("roles-save")).toBeDisabled();
		};
		await editor.getByTestId("role-add").click();
		const added = editor.getByTestId("role-row").last();
		await added.getByTestId("role-name").fill("e2e ruolo");
		await expect(editor.getByTestId("roles-save")).toBeDisabled();
		await added.getByTestId("role-name").fill("e2e-ruolo");
		await added.getByTestId("role-grant-reports").check();
		await save();
		await expect(page.getByRole("status").getByText("Ruoli salvati")).toBeVisible();
		const saved = editor.locator('[data-testid="role-row"][data-role="e2e-ruolo"]');
		await expect(saved.getByTestId("role-grant-reports")).toBeChecked();
		await saved.getByTestId("role-name").fill("e2e-lettura");
		await save();
		const renamed = editor.locator('[data-testid="role-row"][data-role="e2e-lettura"]');
		await renamed.getByTestId("role-remove").click();
		await save();
		await expect(renamed).toHaveCount(0);
	});

	test("a circulation account sees only its areas and cannot open the accounts page", async ({
		page,
		isMobile,
	}) => {
		await page.context().clearCookies();
		const login = new LoginPage(page);
		await login.goto();
		await login.loginAs("prestiti", "prestiti-test-pw");
		await expect(page).toHaveURL(/\/circulation\/checkout$/);
		const nav = page.getByTestId(isMobile ? "bottom-nav" : "sidebar");
		// the brand link (library name) and the footer (version · Informazioni) are not areas
		const names = await nav
			.getByRole("link")
			.filter({ hasNotText: "BiblioViva" })
			.filter({ hasNot: page.getByTestId("brand-library") })
			.allInnerTexts();
		// no Stampe: print lists need `patrons` or `catalog` (9.13, round 16); Segnalazioni is for
		// every account (9.18), under "Altro" on a phone
		expect(names.map((n) => n.trim())).toEqual(
			isMobile ? ["Prestiti", "Catalogo"] : ["Prestiti", "Catalogo", "Segnalazioni"],
		);
		await page.goto("/admin/users");
		await expect(page.getByRole("heading", { level: 1 })).toHaveText(
			/non è disponibile per l'account in uso/,
		);
	});
});
