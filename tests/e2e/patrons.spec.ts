// SPDX-License-Identifier: GPL-3.0-or-later
// Patron CRUD and list (steps 2.1–2.7): create, validation, detail, edit, list filters and
// exports, photo, notes, loan history, removal (anonymization).
import { expect, test } from "@playwright/test";
import { expectAxeClean } from "./helpers/axe.js";
import { pageAction } from "./helpers/actions.js";
import { waitForHydration } from "./helpers/hydration.js";

test.describe.serial("patrons", () => {
	const surname = `Rossi${Date.now().toString(36)}`;

	test("creates a student, validates the rules and shows the detail", async ({ page }) => {
		await page.goto("/patrons/new");
		await waitForHydration(page);
		await expect(page.getByRole("heading", { level: 1 })).toHaveText("Nuovo utente");
		await expectAxeClean(page);

		// a student without class is refused with a field message
		await page.getByLabel("Cognome", { exact: true }).fill(surname);
		await page.getByLabel("Nome", { exact: true }).fill("Anna");
		await page.getByTestId("patron-submit").click();
		await expect(page.getByTestId("field-error-groupId")).toContainText(
			"sezione è obbligatoria",
		);

		await page.getByRole("combobox", { name: "Classe", exact: true }).selectOption("3");
		await page.getByRole("combobox", { name: "Sezione", exact: true }).selectOption("A");
		await page.getByTestId("patron-submit").click();
		await expect(page).toHaveURL(/\/patrons\/\d+$/);
		await expect(page.getByRole("heading", { level: 1 })).toHaveText(`${surname} Anna`);
		await expect(page.getByTestId("class-badge")).toHaveText("3 A");
		// an active patron shows no status badge (owner review); only "Rimosso" is shown
		await expect(page.getByTestId("status-badge")).toHaveCount(0);
		// a card number is assigned automatically (step 2.2) and its barcode renders
		await expect(page.getByTestId("patron-card")).toContainText(/[A-Z]\d{6}/);
		await expectAxeClean(page);
	});

	test("shows the card barcode and reassigns the number", async ({ page }) => {
		await page.goto("/patrons");
		await waitForHydration(page);
		await page.getByLabel("Cerca").fill(surname.toLowerCase());
		await page.getByTestId("data-grid").getByText(`${surname} Anna`).click();
		await waitForHydration(page);
		const before = (await page.getByTestId("patron-card").innerText()).trim();
		await page.getByRole("tab", { name: "Tessera" }).click();
		const img = page.getByTestId("card-barcode");
		await expect(img).toBeVisible();
		const src = await img.getAttribute("src");
		const svg = await page.request.get(src!);
		expect(svg.status()).toBe(200);
		expect(svg.headers()["content-type"]).toContain("image/svg+xml");
		expect((await svg.text()).startsWith("<svg")).toBe(true);
		expect((await page.request.get("/media/barcode/x%C3%A8.svg")).status()).toBe(400);
		expect((await page.request.get("/media/barcode/123.svg?symbology=qr")).status()).toBe(400);

		await page.getByTestId("reassign-card").click();
		await page.getByTestId("confirm-button").click();
		await expect(page.getByTestId("patron-card")).not.toContainText(before);
		await expect(page.getByTestId("patron-card")).toContainText(/[A-Z]\d{6}/);
	});

	test("edits the patron, keeping the prefilled values", async ({ page }) => {
		await page.goto("/patrons");
		await waitForHydration(page);
		await page.getByLabel("Cerca").fill(surname.slice(0, 5).toLowerCase());
		const grid = page.getByTestId("data-grid");
		await grid.getByText(`${surname} Anna`).click();
		await expect(page).toHaveURL(/\/patrons\/\d+$/);
		await page.getByTestId("edit-patron").click();
		await expect(page).toHaveURL(/\/patrons\/\d+\/edit$/);
		await waitForHydration(page);
		await expect(page.getByLabel("Cognome", { exact: true })).toHaveValue(surname);
		await expect(page.getByRole("combobox", { name: "Classe", exact: true })).toHaveValue("3");
		await page.getByRole("combobox", { name: "Sezione", exact: true }).selectOption("B");
		await page.locator("summary", { hasText: "Note" }).click();
		await page.getByLabel("Nota per il banco prestiti").fill("Restituisce sempre in ritardo");
		await page.getByTestId("patron-submit").click();
		await expect(page).toHaveURL(/\/patrons\/\d+$/);
		await expect(page.getByTestId("class-badge")).toHaveText("3 B");
		await expect(page.getByTestId("circulation-note")).toContainText("Restituisce sempre");
		await expect(page.getByTestId("patron-email")).toHaveCount(0);

		// the school's email address (9.22): shown on the page, changed and cleared in the form
		const email = async (value: string): Promise<void> => {
			await page.getByTestId("edit-patron").click();
			await waitForHydration(page);
			const field = page.getByRole("textbox", { name: /^Email/ });
			const contacts = page.locator("details", {
				has: page.locator("summary", { hasText: "Contatti" }),
			});
			// the section starts open when the patron has an email
			if (!(await contacts.evaluate((d: HTMLDetailsElement) => d.open))) {
				await contacts.locator("summary").click();
			}
			await expect(field).toBeVisible();
			// no phone: the email is the only contact (Q122)
			await expect(page.getByLabel("Telefono")).toHaveCount(0);
			await field.fill(value);
			await page.getByTestId("patron-submit").click();
			await expect(page).toHaveURL(/\/patrons\/\d+$/);
		};
		await email("anna.rossi@scuola.example");
		await expect(page.getByTestId("patron-email")).toHaveText("anna.rossi@scuola.example");
		await expect(page.getByTestId("patron-email").getByRole("link")).toHaveAttribute(
			"href",
			"mailto:anna.rossi@scuola.example",
		);
		await email("anna.b.rossi@scuola.example");
		await expect(page.getByTestId("patron-email")).toHaveText("anna.b.rossi@scuola.example");
		await email("");
		await expect(page.getByTestId("patron-email")).toHaveCount(0);
	});

	test("the list filters by class and exports", async ({ page }) => {
		await page.goto("/patrons");
		await waitForHydration(page);
		await page.getByLabel("Cerca").fill(surname.toLowerCase());
		// a row that opens the patron says so with the pointer
		const found = page
			.getByTestId("data-grid")
			.locator(".wx-row", { hasText: `${surname} Anna` });
		await expect(found).toHaveCSS("cursor", "pointer");
		await page.getByTestId("data-grid").getByText(`${surname} Anna`).click();
		await expect(page).toHaveURL(/\/patrons\/\d+$/);
		await waitForHydration(page);
		// Back finds the search as it was left
		await page.goBack();
		await expect(page).toHaveURL(/\/patrons$/);
		await expect(page.getByLabel("Cerca")).toHaveValue(surname.toLowerCase());
		await expect(page.getByTestId("data-grid").getByText(`${surname} Anna`)).toBeVisible();
		await page.goto("/patrons");
		await waitForHydration(page);
		await page.getByRole("combobox", { name: "Classe", exact: true }).selectOption("3");
		await page
			.getByRole("combobox", { name: "Sezione", exact: true })
			.selectOption({ label: "Sezione: B" });
		await expect(page.getByTestId("data-grid").getByText(`${surname} Anna`)).toBeVisible();
		// the status column: nothing on loan, the photo still missing
		const statusOf = page
			.getByTestId("data-grid")
			.locator(".wx-row", { hasText: `${surname} Anna` })
			.getByTestId("patron-status");
		await expect(statusOf.getByTestId("status-no-photo")).toContainText("senza foto");
		await expect(statusOf.getByTestId("status-loans")).toHaveCount(0);
		await page
			.getByRole("combobox", { name: "Sezione", exact: true })
			.selectOption({ label: "Sezione: A" });
		await expect(page.getByTestId("data-grid").getByText(`${surname} Anna`)).toHaveCount(0);
		await expect(page.getByTestId("patron-count")).toContainText("corrispondono ai filtri");
		await expectAxeClean(page);
		await page.getByTestId("clear-filters").click();
		await expect(page.getByRole("combobox", { name: "Classe", exact: true })).toHaveValue("");
		// no filter, nothing loaded (9.13, round 3, as the catalogue)
		await expect(page.getByTestId("patrons-start")).toBeVisible();
		await expect(page.getByTestId("patron-count")).toHaveCount(0);
		await expect(page.getByTestId("clear-filters")).toHaveCount(0);
		await page.getByLabel("Cerca").fill(surname.slice(0, 2).toLowerCase());
		await expect(page.getByTestId("patrons-start")).toBeVisible();

		// exports carry the current filters (step 1.10 acceptance for the patrons grid)
		await page.getByLabel("Cerca").fill("");
		await page.getByRole("combobox", { name: "Classe", exact: true }).selectOption("3");
		await page
			.getByRole("combobox", { name: "Sezione", exact: true })
			.selectOption({ label: "Sezione: B" });
		await page.getByTestId("export-menu").click();
		const csvHref = await page
			.getByRole("menuitem", { name: /CSV/ })
			.getByRole("link")
			.getAttribute("href");
		expect(csvHref).toContain("levelCode=3");
		expect(csvHref).toMatch(/groupId=\d+/);
		const csv = await page.request.get(csvHref!);
		expect(csv.status()).toBe(200);
		const text = (await csv.body()).subarray(3).toString("utf8");
		expect(text.split("\r\n")[0]).toBe(
			"Cognome;Nome;Tipo;Classe;Numero tessera;Stato;Prestiti in corso;In ritardo",
		);
		expect(text).toMatch(new RegExp(`${surname};Anna;Studente;3 B;[A-Z]\\d{6};Attivo;0;0`));
		const ods = await page.request.get(csvHref!.replace("format=csv", "format=ods"));
		expect(ods.headers()["content-type"]).toContain("opendocument.spreadsheet");
		expect((await ods.body()).subarray(0, 2).toString()).toBe("PK");
	});

	test("uploads a photo (EXIF stripped, 480×640 WebP), rejects an oversize file, deletes it", async ({
		page,
	}) => {
		await page.goto("/patrons");
		await waitForHydration(page);
		await page.getByLabel("Cerca").fill(surname.toLowerCase());
		await page.getByTestId("data-grid").getByText(`${surname} Anna`).click();
		await waitForHydration(page);
		await expect(page.getByTestId("patron-photo-placeholder")).toBeVisible();
		const placeholder = await page.request.get(
			page.url().replace(/\/patrons\/(\d+)$/, "/media/patrons/$1/main"),
		);
		expect(placeholder.headers()["content-type"]).toContain("svg");

		await page.getByTestId("photo-toggle").click();
		// oversize file straight to the server (the browser crop cannot shrink files it cannot decode,
		// e.g. HEIC): readable error, nothing stored
		await page
			.getByTestId("photo-form")
			.locator("input[type=file]")
			.setInputFiles("tests/fixtures/images/large-noise.jpg");
		await page
			.getByTestId("photo-form")
			.evaluate((f) => (f as HTMLFormElement).requestSubmit());
		await expect(page.getByTestId("photo-error")).toContainText("troppo grande");
		await expect(page.getByTestId("patron-photo-placeholder")).toBeVisible();

		// portrait with EXIF + GPS → cropped in the browser, stored as WebP (photos.format) without metadata at 480×640
		await page
			.getByTestId("photo-file")
			.setInputFiles("tests/fixtures/images/portrait-exif.jpg");
		await page.getByTestId("photo-use").click();
		await expect(page.getByRole("status").getByText("Foto salvata")).toBeVisible();
		const img = page.getByTestId("patron-photo");
		await expect(img).toBeVisible();
		const src = await img.getAttribute("src");
		const res = await page.request.get(src!);
		expect(res.status()).toBe(200);
		expect(res.headers()["content-type"]).toBe("image/webp");
		const bytes = await res.body();
		expect(bytes.subarray(0, 4).toString()).toBe("RIFF");
		expect(bytes.subarray(8, 12).toString()).toBe("WEBP");
		expect(bytes.includes(Buffer.from("Exif"))).toBe(false);
		expect(bytes.includes(Buffer.from("Synthetic"))).toBe(false);
		const size = await img.evaluate((el) => [
			(el as HTMLImageElement).naturalWidth,
			(el as HTMLImageElement).naturalHeight,
		]);
		expect(size).toEqual([480, 640]);
		const thumb = await page.request.get(src!.replace("/main", "/thumb"));
		expect(thumb.headers()["content-type"]).toBe("image/webp");

		await page.getByTestId("photo-delete").click();
		await page.getByTestId("confirm-button").click();
		await expect(page.getByTestId("patron-photo-placeholder")).toBeVisible();
	});

	test("edits the notes, shows the empty history with no export, and removes the patron", async ({
		page,
	}) => {
		await page.goto("/patrons");
		await waitForHydration(page);
		await page.getByLabel("Cerca").fill(surname.toLowerCase());
		await page.getByTestId("data-grid").getByText(`${surname} Anna`).click();
		await waitForHydration(page);

		await page.getByRole("tab", { name: "Note" }).click();
		await page.getByTestId("edit-notes").click();
		await page.getByTestId("circulation-note-input").fill("Restituisce sempre in ritardo");
		await page.getByTestId("notes-input").fill("Nota interna");
		await page.getByTestId("save-notes").click();
		await expect(page.getByRole("status").getByText("Note salvate")).toBeVisible();
		await expect(page.getByTestId("notes-text")).toHaveText("Nota interna");
		await expect(page.getByTestId("circulation-note")).toContainText("in ritardo");

		await page.getByRole("tab", { name: "Storico" }).click();
		await expect(page.getByTestId("history-empty")).toBeVisible();
		const exportUrl = `/export/patron-loans?format=csv&patron=${page.url().split("/").pop()}`;
		const csv = await page.request.get(exportUrl);
		expect(csv.status()).toBe(200);
		expect((await csv.body()).subarray(3).toString("utf8").split("\r\n")[0]).toBe(
			"Prestato il;Scadenza;Restituito il;Esito;Titolo;Autore;Copia;Rinnovi;Anno scolastico",
		);

		await (await pageAction(page, "remove-patron")).click();
		await expect(page.getByText("cancellati subito e per sempre")).toBeVisible();
		await page.getByTestId("confirm-button").click();
		await expect(page.getByRole("status").getByText("Utente rimosso")).toBeVisible();
		await expect(page.getByRole("heading", { level: 1 })).toHaveText(/Rimosso #\d+ Studente/);
		await expect(page.getByTestId("status-badge")).toContainText("Rimosso");
		await expect(page.getByTestId("anonymized-info")).toBeVisible();
		// the admin keeps the export only
		await expect(await pageAction(page, "export-patron")).toBeVisible();
		await expect(page.getByTestId("remove-patron")).toHaveCount(0);
		await page.keyboard.press("Escape");
		await expect(page.getByTestId("edit-notes")).toHaveCount(0);

		await page.goto("/patrons");
		await waitForHydration(page);
		await page.getByLabel("Cerca").fill(surname.toLowerCase());
		await expect(page.getByTestId("data-grid").getByText(`${surname} Anna`)).toHaveCount(0);
	});

	test("removes a grid selection (step 2.9), skipping nobody here since seeded loans are elsewhere", async ({
		page,
	}) => {
		// two disposable students, created through the form so they own nothing
		// both projects run this: a per-project surname keeps the two runs apart
		const tag = page.viewportSize()?.width === 412 ? "Mob" : "Desk";
		const names = ["Uno", "Due"].map((n) => `Rimozione${tag}${n}`);
		for (const name of names) {
			await page.goto("/patrons/new");
			await waitForHydration(page);
			await page.getByLabel("Cognome", { exact: true }).fill(name);
			await page.getByLabel("Nome", { exact: true }).fill("Test");
			await page.getByRole("combobox", { name: "Classe", exact: true }).selectOption("5");
			await page.getByRole("combobox", { name: "Sezione", exact: true }).selectOption("D");
			await page.getByTestId("patron-submit").click();
			await expect(page).toHaveURL(/\/patrons\/\d+$/);
		}
		await page.goto("/patrons");
		await waitForHydration(page);
		await page.getByLabel("Cerca").fill(`rimozione${tag}`.toLowerCase());
		const rows = page.getByTestId("data-grid").locator(".wx-row");
		await expect(rows).toHaveCount(2);
		await rows.nth(0).click({ modifiers: ["Control"] });
		await rows.nth(1).click({ modifiers: ["Control"] });
		await page.getByTestId("remove-selected").click();
		await expect(page.getByText("cancellati subito e per sempre")).toBeVisible();
		await page.getByTestId("confirm-button").click();
		await expect(page.getByRole("status").getByText("2 rimossi, 0 con prestiti")).toBeVisible();
		await expect(
			page.getByTestId("data-grid").getByText(new RegExp(`Rimozione${tag}`)),
		).toHaveCount(0);
	});
});
