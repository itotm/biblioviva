// SPDX-License-Identifier: GPL-3.0-or-later
// The school structure for the countries of the language packs (9.41), run last (project `final`,
// after the class upgrade of rollover.final.spec.ts): the Scuola page gives a new stage its own
// way of writing the class, a year other names and the fifth year a choice (the first media or
// leaving the school); the class upgrade asks each fifth-year pupil which, places the one who goes
// on in the class of the chosen year and lets the other go; then, with the installation in
// English, a card and the overdue notices carry no Italian word.
import { expect, test, type Page } from "@playwright/test";
import { createPatron } from "./helpers/data.js";
import { waitForHydration } from "./helpers/hydration.js";

/** Places every pupil still waiting for a class in the first class offered. */
async function placeTheOthers(page: Page): Promise<void> {
	for (const select of await page.locator('select[data-testid^="group-"]').all()) {
		if ((await select.isVisible()) && (await select.inputValue()) === "") {
			await select.selectOption({ index: 1 });
		}
	}
	await expect(page.getByTestId("rollover-unplaced")).toHaveCount(0);
}

async function setLocale(page: Page, locale: "en" | "it"): Promise<void> {
	await page.goto("/admin/appearance");
	await waitForHydration(page);
	await page.getByTestId("locale-select").selectOption(locale);
	await page.getByTestId("save-locale").click();
	await expect(page.locator("html")).toHaveAttribute("lang", locale);
	await waitForHydration(page);
}

test("a year with a choice, upgraded pupil by pupil; cards and slips in English", async ({
	page,
}) => {
	test.setTimeout(180_000);
	// 1. the Scuola page: the media, written "6A"; the first media also "VI"; after the fifth
	// year the first media or leaving
	await page.goto("/admin/config/school");
	await waitForHydration(page);
	const block = page.getByTestId("block-schoolLevels");
	await block.getByTestId("stage-add").click();
	const stage = block.locator('tr[data-testid^="stage-"]').last();
	await stage.getByLabel("Codice").fill("media");
	await stage.getByLabel("Nome").fill("Secondaria");
	await stage.getByLabel("Come si scrive la classe").fill("{level}{group}");
	await block.getByTestId("level-add").click();
	const added = block.getByTestId("level-");
	await added.getByLabel("Codice").fill("6");
	const sixth = block.getByTestId("level-6");
	await sixth.getByLabel("Nella classe").fill("6");
	await sixth.getByLabel("Nome", { exact: true }).fill("Prima media");
	await sixth.getByLabel("Ordine").selectOption("media");
	await sixth.getByTestId("level-aliases-6").fill("VI, prima media");
	await block.getByTestId("level-next-5").selectOption({ label: "Si sceglie tra più anni" });
	await block.getByTestId("level-choice-add-5").selectOption({ label: "Prima media" });
	await block.getByTestId("level-choice-add-5").selectOption({ label: "Esce dalla scuola" });
	await expect(block.getByTestId("level-choices-5")).toContainText("Prima media · predefinito");
	await expect(block.getByTestId("school-example")).toContainText("6B");
	await page.getByTestId("school-save").click();
	await expect(page.getByRole("status").getByText("Ordini e anni salvati")).toBeVisible();
	// saved and read back
	await page.reload();
	await waitForHydration(page);
	await expect(block.getByTestId("level-choices-5")).toContainText("Esce dalla scuola");
	await expect(block.getByTestId("level-aliases-6")).toHaveValue("VI, prima media");
	await expect(block.getByTestId("stage-label-media")).toHaveValue("{level}{group}");

	// the class of the first media
	await page.goto("/admin/classes");
	await waitForHydration(page);
	await page.getByTestId("classes-new").click();
	const dialog = page.getByTestId("class-dialog");
	await dialog.getByTestId("class-level-6").click();
	await dialog.getByTestId("class-names").fill("A");
	await dialog.getByTestId("class-save").click();
	await expect(dialog).toBeHidden();
	await expect(page.getByRole("cell", { name: "6A", exact: true })).toBeVisible();

	// two pupils of 5 A: one goes on, one leaves
	const goesOn = await createPatron(page, "Prosegue", "student", ["5", "A"]);
	const leaves = await createPatron(page, "Salutato", "student", ["5", "A"]);

	// 2. the class upgrade asks the way on of each fifth-year pupil
	await page.goto("/admin/rollover");
	await waitForHydration(page);
	await page.getByTestId("rollover-make-backup").click();
	await expect(page.getByTestId("rollover-backup")).toBeVisible();
	await page.getByTestId("rollover-next").click();
	const next = page.getByTestId(`next-${goesOn.id}`);
	await expect(next).toBeVisible();
	await expect(next).toHaveValue("6");
	await page.getByTestId(`group-${goesOn.id}`).selectOption({ label: "6A" });
	await page.getByTestId(`next-${leaves.id}`).selectOption({ label: "Esce dalla scuola" });
	await expect(page.getByTestId(`group-${leaves.id}`)).toHaveCount(0);
	await placeTheOthers(page);
	await page.getByTestId("rollover-next").click();
	for (const row of await page.locator('[data-testid^="rollover-leaver-"]').all()) {
		if ((await row.getByText(/libr[io] in prestito/).count()) > 0) {
			await row.getByRole("checkbox").uncheck();
		}
	}
	await placeTheOthers(page);
	await page.getByTestId("rollover-next").click();
	await expect(page.getByTestId("rollover-summary")).toContainText(/lascia(no)? la scuola/);
	// the upgrade of rollover.final.spec.ts ran a moment ago (when the two run together)
	if (await page.getByTestId("rollover-recent").isVisible()) {
		await page.getByTestId("rollover-recent").check();
	}
	await page.getByTestId("rollover-run").click();
	await expect(page.getByTestId("rollover-done")).toBeVisible();
	await page.goto(`/patrons/${goesOn.id}`);
	await waitForHydration(page);
	await expect(page.getByTestId("class-badge").first()).toHaveText("6A");
	await page.goto(`/patrons/${leaves.id}`);
	await waitForHydration(page);
	await expect(page.getByTestId("status-badge")).toContainText("Rimosso");

	// 3. a teacher's card and the overdue notices, with the installation in English
	const teacher = await createPatron(page, "Insegnante", "teacher");
	await setLocale(page, "en");
	try {
		const card = await (await page.request.get(`/print/cards?ids=${teacher.id}`)).text();
		expect(card).toContain("Teacher");
		expect(card).not.toContain("Docente");
		const slip = await (await page.request.get("/print/overdues?sample=1")).text();
		expect(slip).toContain("Library reminders of");
		expect(slip).toContain("<th>Name</th><th>Title</th><th>Days overdue</th>");
		expect(slip).not.toMatch(/Titolo|Giorni ritardo|Solleciti|<th>Nome<\/th>/);
	} finally {
		await setLocale(page, "it");
	}
});
