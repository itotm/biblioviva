// SPDX-License-Identifier: GPL-3.0-or-later
// Configurazione → Classi (Phase 12): the classes by stage with their patrons, new classes made
// several at once ("X-Y" for the fifth year), one renamed, both archived and one brought back and
// archived again; the "Scuola" settings page shows the stages and years. The classes are shared
// data: only the desktop project changes them, with names nobody else uses, and archives them.
import { expect, test, type Locator } from "@playwright/test";
import { expectAxeClean } from "./helpers/axe.js";
import { waitForHydration } from "./helpers/hydration.js";
import { LoginPage } from "./pages/login.page.js";

test.describe.serial("classes", () => {
	test("made, renamed, archived and restored", async ({ page, isMobile }) => {
		test.skip(isMobile, "the classes are shared data: one project changes them");
		// in Configurazione (9.13, round 25)
		await page.goto("/admin/config");
		await waitForHydration(page);
		await page.getByTestId("config-classes").click();
		await expect(page).toHaveURL(/\/admin\/classes$/);
		await waitForHydration(page);
		const primaria = page.getByTestId("classes-stage-primaria");
		await expect(primaria.getByRole("cell", { name: "3 A", exact: true })).toBeVisible();
		await expect(page.getByTestId("classes-teachers")).toContainText("Docenti");
		await expectAxeClean(page);

		// two classes of the fifth year at once
		await page.getByTestId("classes-new").click();
		const dialog = page.getByTestId("class-dialog");
		await expect(dialog).toBeVisible();
		await dialog.getByTestId("class-level-5").click();
		await dialog.getByTestId("class-names").fill("X-Y");
		await expect(dialog.getByTestId("class-preview")).toContainText("5 X");
		await expect(dialog.getByTestId("class-preview")).toContainText("5 Y");
		await dialog.getByTestId("class-save").click();
		await expect(dialog).toBeHidden();
		const cell = (label: string): Locator =>
			primaria.getByRole("cell", { name: label, exact: true });
		await expect(cell("5 X")).toBeVisible();
		await expect(cell("5 Y")).toBeVisible();

		// the same name again for the same year is refused
		await page.getByTestId("classes-new").click();
		await dialog.getByTestId("class-level-5").click();
		await dialog.getByTestId("class-names").fill("X");
		await dialog.getByTestId("class-save").click();
		await expect(dialog.getByTestId("class-problem")).toContainText("Esiste già");
		await page.keyboard.press("Escape");
		await expect(dialog).toBeHidden();

		// renamed
		const rowOf = (label: string): Locator =>
			primaria
				.getByRole("row")
				.filter({ has: page.getByRole("cell", { name: label, exact: true }) });
		await rowOf("5 Y").getByRole("button", { name: "Modifica" }).click();
		await dialog.getByTestId("class-names").fill("W");
		await dialog.getByTestId("class-save").click();
		await expect(dialog).toBeHidden();
		await expect(cell("5 W")).toBeVisible();

		// archived (empty), one brought back and archived again
		await rowOf("5 X").getByRole("button", { name: "Archivia" }).click();
		await expect(cell("5 X")).toBeHidden();
		await rowOf("5 W").getByRole("button", { name: "Archivia" }).click();
		await expect(cell("5 W")).toBeHidden();
		await page.getByText(/Classi archiviate/).click();
		const archived = page.getByTestId("classes-table-archived");
		await archived
			.locator("tr", { hasText: "5 W" })
			.getByRole("button", { name: "Ripristina" })
			.click();
		await expect(cell("5 W")).toBeVisible();
		await rowOf("5 W").getByRole("button", { name: "Archivia" }).click();
		await expect(cell("5 W")).toBeHidden();
		// a class with pupils cannot be archived
		await expect(
			rowOf("3 A").getByRole("button", { name: /non si può archiviare/ }),
		).toBeDisabled();
	});

	test("a pupil of a pluriclasse and a teacher of a second teachers group", async ({
		page,
		isMobile,
	}) => {
		test.skip(isMobile, "the classes are shared data: one project changes them");
		const tag = Date.now().toString(36).slice(-4).toUpperCase();
		await page.goto("/admin/classes");
		await waitForHydration(page);
		const dialog = page.getByTestId("class-dialog");
		// a pluriclasse of the first two years
		await page.getByTestId("classes-new").click();
		await dialog.getByTestId("class-level-1").click();
		await dialog.getByTestId("class-level-2").click();
		await dialog.getByTestId("class-names").fill(`P${tag}`);
		await dialog.getByTestId("class-mixed").click();
		await expect(dialog.getByTestId("class-preview")).toContainText(`1-2 P${tag}`);
		await dialog.getByTestId("class-save").click();
		await expect(dialog).toBeHidden();
		await expect(page.getByRole("cell", { name: `1-2 P${tag}` })).toBeVisible();
		// a second teachers group
		await page.getByTestId("classes-new-teachers").click();
		await dialog.getByTestId("class-names").fill(`Sostegno ${tag}`);
		await dialog.getByTestId("class-save").click();
		await expect(dialog).toBeHidden();
		await expect(page.getByTestId("classes-teachers")).toContainText(`Sostegno ${tag}`);

		// a pupil of the second year in the pluriclasse
		await page.goto("/patrons/new");
		await waitForHydration(page);
		await page.getByLabel("Cognome", { exact: true }).fill(`Pluri${tag}`);
		await page.getByLabel("Nome", { exact: true }).fill("Bianca");
		await page.getByRole("combobox", { name: "Classe", exact: true }).selectOption("2");
		await page
			.getByRole("combobox", { name: "Sezione", exact: true })
			.selectOption({ label: `1-2 P${tag}` });
		await page.getByTestId("patron-submit").click();
		await expect(page).toHaveURL(/\/patrons\/\d+$/);
		await expect(page.getByText(`2 P${tag}`).first()).toBeVisible();

		// a teacher of the new group
		await page.goto("/patrons/new");
		await waitForHydration(page);
		await page.getByRole("radio", { name: "Docente" }).check();
		await page.getByLabel("Cognome", { exact: true }).fill(`Sost${tag}`);
		await page.getByLabel("Nome", { exact: true }).fill("Carla");
		await page
			.getByRole("combobox", { name: "Gruppo docenti" })
			.selectOption({ label: `Sostegno ${tag}` });
		await page.getByTestId("patron-submit").click();
		await expect(page).toHaveURL(/\/patrons\/\d+$/);
		await expect(page.getByText(`Sostegno ${tag}`).first()).toBeVisible();
	});

	test("an account without admin cannot open them", async ({ page }) => {
		await page.context().clearCookies();
		const login = new LoginPage(page);
		await login.goto();
		await login.loginAs("tessere", "tessere-test-pw");
		await expect(page).toHaveURL(/\/$/);
		expect((await page.request.get("/admin/classes")).status()).toBe(403);
	});

	test("the school settings show the stages and years", async ({ page }) => {
		await page.goto("/admin/config/school");
		await waitForHydration(page);
		const block = page.getByTestId("block-schoolLevels");
		await expect(block).toBeVisible();
		await expect(block.getByTestId("level-3")).toBeVisible();
		await expect(block.getByTestId("school-example")).toContainText("1 B");
		await expect(page.getByTestId("school-save")).toBeDisabled();
		await expectAxeClean(page);
	});

	test("a year in use is removed moving its class to another year", async ({
		page,
		isMobile,
	}) => {
		test.skip(isMobile, "the school structure is shared configuration: one project changes it");
		const block = page.getByTestId("block-schoolLevels");
		// a sixth year
		await page.goto("/admin/config/school");
		await waitForHydration(page);
		await block.getByTestId("level-add").click();
		const added = block.getByTestId("level-");
		await added.getByLabel("Codice").fill("6");
		await block.getByTestId("level-6").getByLabel("Nella classe").fill("6");
		await block.getByTestId("level-6").getByLabel("Nome").fill("Sesta primaria");
		await page.getByTestId("school-save").click();
		await expect(page.getByRole("status").getByText("Ordini e anni salvati")).toBeVisible();

		// a class of the sixth year
		await page.goto("/admin/classes");
		await waitForHydration(page);
		await page.getByTestId("classes-new").click();
		const dialog = page.getByTestId("class-dialog");
		await dialog.getByTestId("class-level-6").click();
		await dialog.getByTestId("class-names").fill("Z");
		await dialog.getByTestId("class-save").click();
		await expect(dialog).toBeHidden();
		await expect(page.getByRole("cell", { name: "6 Z", exact: true })).toBeVisible();

		// removing the year asks where its class goes
		await page.goto("/admin/config/school");
		await waitForHydration(page);
		await block.getByTestId("level-6").getByRole("button", { name: "Elimina" }).click();
		await page.getByTestId("school-save").click();
		const move = page.getByTestId("school-move-dialog");
		await expect(move).toContainText("Sesta primaria: 0 studenti, 1 classe");
		await expect(page.getByTestId("school-move-confirm")).toBeDisabled();
		await move.getByTestId("school-move-6").selectOption("5");
		await page.getByTestId("school-move-confirm").click();
		await expect(move).toBeHidden();
		await expect(page.getByRole("status").getByText("Ordini e anni salvati")).toBeVisible();
		await expect(block.getByTestId("level-6")).toHaveCount(0);

		// the class now hosts the fifth year; archived, it leaves the school as it was
		await page.goto("/admin/classes");
		await waitForHydration(page);
		const row = page
			.getByTestId("classes-stage-primaria")
			.getByRole("row")
			.filter({ has: page.getByRole("cell", { name: "5 Z", exact: true }) });
		await row.getByRole("button", { name: "Archivia" }).click();
		await expect(page.getByRole("cell", { name: "5 Z", exact: true })).toBeHidden();
	});
});
