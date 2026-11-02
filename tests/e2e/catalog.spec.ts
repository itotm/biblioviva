// SPDX-License-Identifier: GPL-3.0-or-later
// Catalogue CRUD (step 3.1): a fiction and a non-fiction record created by hand with two copies
// each, item actions, validation, and the refusal to delete a record that still has copies.
import { expect, test, type Page } from "@playwright/test";
import { expectAxeClean } from "./helpers/axe.js";
import { pageAction } from "./helpers/actions.js";
import { waitForHydration } from "./helpers/hydration.js";

const tagOf = (page: Page): "Mob" | "Desk" => (page.viewportSize()?.width === 412 ? "Mob" : "Desk");

test.describe.serial("catalogue", () => {
	test("creates a fiction record with a genre and class, then two copies", async ({
		page,
		isMobile,
	}) => {
		const title = `Il gatto con gli stivali ${tagOf(page)}`;
		await page.goto("/catalog");
		await waitForHydration(page);
		await expect(page.getByRole("heading", { level: 1 })).toHaveText("Catalogo");
		await expectAxeClean(page);
		// "Nuovo libro" opens the fast-add flow (3.6); the manual form stays at /catalog/new
		await page.getByTestId("new-biblio").click();
		await expect(page).toHaveURL(/\/cataloging\/new$/);
		await page.goto("/catalog/new");
		await waitForHydration(page);
		await expect(page.getByRole("heading", { level: 1 })).toHaveText("Nuovo libro");

		// missing genre is refused with a field message
		await page.getByLabel("Titolo", { exact: true }).fill(title);
		await page.getByLabel("Autore", { exact: true }).fill("Perrault, Charles");
		await page.getByTestId("quick-publisher").click();
		await page.getByLabel("Anno", { exact: true }).fill("2019");
		await page.getByTestId("biblio-submit").click();
		await expect(page.getByTestId("field-error-genreCode")).toContainText(
			"Il genere è obbligatorio",
		);

		await page.getByTestId("genre-G").click();
		await page.getByTestId("reading-level-2").click();
		await expectAxeClean(page);
		await page.getByTestId("biblio-submit").click();
		await expect(page).toHaveURL(/\/catalog\/\d+$/);
		await waitForHydration(page);
		await expect(page.getByRole("heading", { level: 1 })).toHaveText(title);
		await expect(page.getByTestId("kind-badge")).toHaveText("Narrativa");
		await expect(page.getByTestId("classification-badge")).toContainText("Favole e Fiabe");
		await expect(page.getByTestId("classification-badge")).toContainText("2");
		await expect(page.getByTestId("no-copies")).toBeVisible();
		// the title and the author above the cover on a phone, the cover on their left on a desktop
		const titleBox = await page.getByTestId("detail-title").boundingBox();
		const authorBox = await page.getByTestId("detail-subtitle").boundingBox();
		const coverBox = await page.getByTestId("detail-media").boundingBox();
		if (isMobile) {
			expect((authorBox?.y ?? 0) + (authorBox?.height ?? 0)).toBeLessThanOrEqual(
				coverBox?.y ?? 0,
			);
			expect(titleBox?.y ?? 0).toBeLessThan(authorBox?.y ?? 0);
		} else {
			expect((coverBox?.x ?? 0) + (coverBox?.width ?? 0)).toBeLessThanOrEqual(
				titleBox?.x ?? 0,
			);
		}

		await (await pageAction(page, "add-copies")).click();
		await page.getByTestId("add-copies-count").fill("2");
		await expect(page.getByTestId("add-call-number")).toHaveAttribute("placeholder", "G 2 PER");
		await page.getByTestId("confirm-button").click();
		await expect(page.getByRole("status").getByText("2 copie aggiunte")).toBeVisible();
		const rows = page.getByTestId("items-table").locator("tbody tr");
		await expect(rows).toHaveCount(2);
		await expect(rows.first()).toContainText(/\d{4}-[A-Z]\d{4}/);
		await expect(rows.first()).toContainText("G 2 PER");
		await expect(page.getByTestId("copies-badge")).toContainText("2 disponibili su 2");
		await expectAxeClean(page);

		// the actions (9.13, rounds 21–22, in the record card since round 24): Modifica first and in
		// colour, Aggiungi alla lista beside it; every action on one row when they fit with room to
		// spare, else the rest under "Altre azioni" — on a phone, and on a desktop window made narrow
		const edit = page.getByTestId("edit-biblio");
		await expect(edit).toHaveClass(/preset-filled-primary-500/);
		const row = page.getByTestId("page-actions-row");
		const onOneRow = async (testids: string[]): Promise<void> => {
			const tops = await Promise.all(
				testids.map(async (t) => (await page.getByTestId(t).boundingBox())?.y ?? NaN),
			);
			// one row: the same top, give or take the rounding of a fractional layout
			expect(Math.max(...tops) - Math.min(...tops)).toBeLessThan(1);
		};
		const actions = [
			["edit-biblio", "Modifica"],
			["add-to-list", "Aggiungi alla lista"],
			["add-copies", "Aggiungi copie"],
			["print-labels", "Stampa etichette"],
			["delete-biblio", "Elimina scheda"],
		] as const;
		// the first one or two stay buttons, as many as fit beside the menu, the rest are in it
		const compact = async (): Promise<void> => {
			await expect(row).toHaveAttribute("data-mode", "compact");
			// after a change of the window's width the row is measured again: wait for it to settle
			const visible: string[] = [];
			await expect(async () => {
				visible.length = 0;
				for (const [testid] of actions) {
					if (await page.getByTestId(testid).isVisible()) {
						visible.push(testid);
					}
				}
				expect(visible).toEqual(actions.slice(0, visible.length).map(([t]) => t));
				expect(visible.length).toBeGreaterThanOrEqual(1);
				expect(visible.length).toBeLessThanOrEqual(2);
				await onOneRow([...visible, "more-actions"]);
			}).toPass({ timeout: 15_000 });
			await page.getByTestId("more-actions").click();
			await expect(page.getByRole("menuitem")).toHaveText(
				actions.slice(visible.length).map(([, label]) => label),
			);
			await expectAxeClean(page);
			await page.keyboard.press("Escape");
		};
		if (isMobile) {
			await compact();
		} else {
			// a wide window has room for the five buttons under the record (9.13, round 25)
			await page.setViewportSize({ width: 1920, height: 800 });
			await expect(row).toHaveAttribute("data-mode", "full");
			await onOneRow(actions.map(([t]) => t));
			await expect(page.getByTestId("more-actions")).toHaveCount(0);
			await page.setViewportSize({ width: 900, height: 800 });
			await compact();
			// at every width the actions take a row of their own under the title, which is never
			// squeezed into a narrow column (a very wide window put them beside it)
			for (const width of [900, 1280, 1800]) {
				await page.setViewportSize({ width, height: 800 });
				const title = await page.getByTestId("page-title").boundingBox();
				const actionsRow = await row.boundingBox();
				expect(title?.width).toBeGreaterThanOrEqual(250);
				expect(actionsRow?.y).toBeGreaterThan((title?.y ?? 0) + (title?.height ?? 0) - 1);
			}
			await page.setViewportSize({ width: 1280, height: 800 });
		}

		// deleting a record with copies is refused
		await (await pageAction(page, "delete-biblio")).click();
		await page.getByTestId("confirm-button").click();
		await expect(page.getByRole("status").getByText(/ha ancora 2 copie/)).toBeVisible();
		await expect(page).toHaveURL(/\/catalog\/\d+$/);
	});

	test("creates a non-fiction record from the taxonomy, edits and changes a copy", async ({
		page,
	}) => {
		const title = `Gli animali della fattoria ${tagOf(page)}`;
		await page.goto("/catalog/new");
		await waitForHydration(page);
		await page.getByLabel("Titolo", { exact: true }).fill(title);
		await page.getByTestId("quick-author-Anonimo").click();
		await page.getByLabel("Editore", { exact: true }).fill("Giunti");
		await page.getByTestId("kind-nonfiction").click();
		await page.getByTestId("class-500").click();
		await expect(page.getByTestId("picker-parent-500")).toBeVisible();
		await page.getByTestId("class-590").click();
		await page.getByTestId("biblio-submit").click();
		await expect(page).toHaveURL(/\/catalog\/\d+$/);
		await waitForHydration(page);
		await expect(page.getByTestId("kind-badge")).toHaveText("Saggistica");
		await expect(page.getByTestId("classification-badge")).toContainText("590");

		await (await pageAction(page, "add-copies")).click();
		await page.getByTestId("add-copies-count").fill("2");
		await expect(page.getByTestId("add-call-number")).toHaveAttribute("placeholder", "590 ANO");
		await page.getByTestId("confirm-button").click();
		await expect(page.getByRole("status").getByText("2 copie aggiunte")).toBeVisible();
		const rows = page.getByTestId("items-table").locator("tbody tr");
		await expect(rows).toHaveCount(2);
		const barcode = (await rows.first().locator("td").first().innerText()).trim();

		// change the status of the first copy with a reason
		await page.getByTestId(`status-item-${barcode}`).click();
		await page.getByTestId("status-select").selectOption("damaged");
		await page.getByTestId("status-reason").fill("pagine strappate");
		await page.getByTestId("confirm-button").click();
		await expect(page.getByRole("status").getByText("Stato aggiornato")).toBeVisible();
		await expect(rows.first()).toContainText("Danneggiato");
		// a worn copy still circulates (ADR-012): both copies count as available
		await expect(page.getByTestId("copies-badge")).toContainText("2 disponibili su 2");

		// edit the copy's call number
		await page.getByTestId(`edit-item-${barcode}`).click();
		await page.getByTestId("edit-call-number").fill("590 ANO bis");
		await page.getByTestId("confirm-button").click();
		await expect(page.getByRole("status").getByText("Copia aggiornata")).toBeVisible();
		await expect(rows.first()).toContainText("590 ANO bis");

		// edit the record: the picker is prefilled and the title changes
		await page.getByTestId("edit-biblio").click();
		await waitForHydration(page);
		await expect(page.getByTestId("class-590")).toHaveAttribute("aria-checked", "true");
		// two copies: no copy fields on the record page (they belong to each copy's dialog)
		await expect(page.getByTestId("edit-item-call-number")).toHaveCount(0);
		await page.getByLabel("Titolo", { exact: true }).fill(`${title} (2a ed.)`);
		await page.getByTestId("biblio-submit").click();
		await expect(page).toHaveURL(/\/catalog\/\d+$/);
		await waitForHydration(page);
		await expect(page.getByRole("heading", { level: 1 })).toHaveText(`${title} (2a ed.)`);

		// the grid finds it by a word of the title and filters by class
		await page.goto("/catalog");
		await waitForHydration(page);
		await page.getByLabel("Cerca").fill(`fattoria ${tagOf(page)}`);
		await expect(page.getByTestId("data-grid").getByText(`${title} (2a ed.)`)).toBeVisible();
		// the row of this book: similar titles may follow it (9.24)
		await expect(
			page
				.getByTestId("data-grid")
				.getByRole("row", { name: new RegExp(`${title} \\(2a ed\\.\\)`) })
				.getByText("2 di 2 disponibili"),
		).toBeVisible();
		await page.getByRole("combobox", { name: "Classificazione" }).selectOption("500");
		await expect(page.getByTestId("data-grid").getByText(`${title} (2a ed.)`)).toBeVisible();
		await page.getByRole("combobox", { name: "Classificazione" }).selectOption("200");
		await expect(page.getByTestId("data-grid").getByText(`${title} (2a ed.)`)).toHaveCount(0);
	});

	test("deletes copies never lent, then the record; the ISBN must be unique", async ({
		page,
	}) => {
		const title = `Da eliminare ${tagOf(page)}`;
		await page.goto("/catalog/new");
		await waitForHydration(page);
		await page.getByLabel("Titolo", { exact: true }).fill(title);
		await page.getByLabel("Autore", { exact: true }).fill("Rossi, Mario");
		await page.getByLabel("Editore", { exact: true }).fill("Mondadori");
		// not one of the mock provider ISBNs used by fast-add.spec.ts (shared database)
		const isbn = tagOf(page) === "Mob" ? "978-88-17-15248-8" : "978-88-04-49039-5";
		await page.getByLabel("ISBN", { exact: true }).fill(isbn);
		await page.getByTestId("genre-A").click();
		await page.getByTestId("biblio-submit").click();
		await expect(page).toHaveURL(/\/catalog\/\d+$/);
		const recordUrl = page.url();

		// the same ISBN a second time is refused on the field
		await page.goto("/catalog/new");
		await waitForHydration(page);
		await page.getByLabel("Titolo", { exact: true }).fill(`${title} bis`);
		await page.getByLabel("Autore", { exact: true }).fill("Rossi, Mario");
		await page.getByLabel("Editore", { exact: true }).fill("Mondadori");
		await page.getByLabel("ISBN", { exact: true }).fill(isbn);
		await page.getByTestId("genre-A").click();
		await page.getByTestId("biblio-submit").click();
		await expect(page.getByTestId("field-error-isbn")).toContainText("Esiste già");

		await page.goto(recordUrl);
		await expect(page).toHaveURL(/\/catalog\/\d+$/);
		await waitForHydration(page);
		await (await pageAction(page, "add-copies")).click();
		await page.getByTestId("confirm-button").click();
		await expect(page.getByRole("status").getByText("1 copia aggiunta")).toBeVisible();
		const rows = page.getByTestId("items-table").locator("tbody tr");

		// a single copy is edited together with the record (owner review)
		await page.getByTestId("edit-biblio").click();
		await waitForHydration(page);
		await expect(page.getByTestId("edit-item-call-number")).toHaveValue("A ROS");
		// the material is the record's, in the record's fields; the segnatura stays the copy's (9.45)
		await expect(page.getByTestId("edit-item-type")).toHaveCount(0);
		await expect(page.getByTestId("biblio-item-type")).toHaveValue("libro");
		await page.getByTestId("biblio-item-type").selectOption("dvd");
		await page.getByTestId("edit-item-call-number").fill("A ROS bis");
		await page.getByTestId("edit-item-acquisition-date").fill("2026-01-15");
		await page.getByLabel("Titolo", { exact: true }).fill(`${title} (ed.)`);
		await page.getByTestId("biblio-submit").click();
		await expect(page).toHaveURL(/\/catalog\/\d+$/);
		await waitForHydration(page);
		await expect(page.getByRole("heading", { level: 1 })).toHaveText(`${title} (ed.)`);
		await expect(rows.first()).toContainText("A ROS bis");
		await expect(page.getByTestId("item-type-badge")).toHaveText("DVD");
		// a refused copy value leaves the record unchanged: the error sits on the copy field
		await page.getByTestId("edit-biblio").click();
		await waitForHydration(page);
		await page.getByTestId("edit-item-acquisition-date").fill("");
		await page.getByTestId("edit-item-acquisition-date").evaluate((el: HTMLInputElement) => {
			el.type = "text";
			el.value = "31/02/2026";
		});
		await page.getByLabel("Titolo", { exact: true }).fill(`${title} (mai)`);
		await page.getByTestId("biblio-submit").click();
		await expect(page.getByTestId("field-error-itemAcquisitionDate")).toContainText(
			"Data non valida",
		);
		await page.goto(recordUrl);
		await waitForHydration(page);
		await expect(page.getByRole("heading", { level: 1 })).toHaveText(`${title} (ed.)`);
		const barcode = (await rows.first().locator("td").first().innerText()).trim();
		await page.getByTestId(`delete-item-${barcode}`).click();
		await page.getByTestId("confirm-button").click();
		await expect(page.getByRole("status").getByText("Copia eliminata")).toBeVisible();
		await expect(page.getByTestId("no-copies")).toBeVisible();
		await (await pageAction(page, "delete-biblio")).click();
		await page.getByTestId("confirm-button").click();
		await expect(page).toHaveURL(/\/catalog$/);
	});

	test("the catalogue is read-only without the catalog permission", async ({ page, context }) => {
		await context.clearCookies();
		const { LoginPage } = await import("./pages/login.page.js");
		const login = new LoginPage(page);
		await login.goto();
		await login.loginAs("prestiti", "prestiti-test-pw");
		await expect(page).toHaveURL(/\/circulation\/checkout$/);
		await page.goto("/catalog");
		await waitForHydration(page);
		// nothing is loaded until a filter is set (Q83)
		await expect(page.getByTestId("catalog-start")).toBeVisible();
		await expect(page.getByTestId("biblio-count")).toHaveCount(0);
		await page.getByLabel("Cerca").fill("th");
		await expect(page.getByTestId("catalog-start")).toBeVisible();
		await page.getByLabel("Cerca").fill("the");
		await expect(page.getByTestId("biblio-count")).toBeVisible();
		await expect(page.getByTestId("new-biblio")).toHaveCount(0);
		await page.goto("/catalog/new");
		await expect(page.getByRole("heading", { level: 1 })).toHaveText(
			/non è disponibile per l'account in uso/,
		);
	});
});
