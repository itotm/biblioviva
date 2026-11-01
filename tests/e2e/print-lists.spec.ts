// SPDX-License-Identifier: GPL-3.0-or-later
// Print lists (step 2.8): a list built from a class plus two scanned cards, one entry removed,
// cards printed from the list, marked as printed; the list and the patrons carry the date. Under
// the lists, the classes print their cards as lists do.
import { expect, test, type Page } from "@playwright/test";
import { expectAxeClean } from "./helpers/axe.js";
import { seededClassId } from "./helpers/data.js";
import { pageAction } from "./helpers/actions.js";
import { waitForHydration } from "./helpers/hydration.js";

const tagOf = (page: Page): "Mob" | "Desk" => (page.viewportSize()?.width === 412 ? "Mob" : "Desk");
/** Each project owns a class (2 A desktop, 2 B mobile) and scans two cards of class 3. */
const sectionOf = (page: Page): "A" | "B" => (tagOf(page) === "Mob" ? "B" : "A");

async function cardsOf(page: Page, level: number, section: "A" | "B"): Promise<string[]> {
	const csv = await page.request.get(
		`/export/patrons?format=csv&groupId=${seededClassId(level, section)}`,
	);
	const text = (await csv.body()).subarray(3).toString("utf8");
	return text
		.split("\r\n")
		.slice(1)
		.map((line) => line.split(";")[4] ?? "")
		.filter((card) => /^[A-Z0-9]+$/.test(card));
}

test.describe.serial("print lists", () => {
	let listUrl = "";

	test("builds a list from a class and two scanned cards, removes one, prints and marks", async ({
		page,
	}) => {
		const section = sectionOf(page);
		await page.goto("/print-lists");
		await waitForHydration(page);
		await expect(page.getByRole("heading", { level: 1 })).toHaveText("Stampe");
		await expectAxeClean(page);
		await page.getByTestId("new-patron-list").click();
		await page.getByTestId("new-list-name").fill(`Tessere 2 ${section} ${tagOf(page)}`);
		await page.getByTestId("confirm-button").click();
		await expect(page).toHaveURL(/\/print-lists\/\d+$/);
		listUrl = page.url();
		await waitForHydration(page);
		await expect(page.getByTestId("list-count")).toContainText("0 utenti");

		// quick filter: the whole class
		await page.getByTestId("quick-level").selectOption("2");
		await page.getByTestId("quick-class").selectOption(section);
		await page.getByTestId("quick-add").click();
		await expect(page.getByRole("status").getByText(/aggiunti/)).toBeVisible();
		const classSize = (await cardsOf(page, 2, section)).length;
		expect(classSize).toBeGreaterThan(0);
		await expect(page.getByTestId("list-count")).toContainText(`${classSize} utenti`);
		// adding the same class again adds nobody
		await page.getByTestId("quick-add").click();
		await expect(
			page.getByRole("status").getByText(`0 aggiunti, ${classSize} già presenti`),
		).toBeVisible();

		// scan two cards of another class; the second scan of the same card is ignored
		const [card1, card2] = await cardsOf(page, 3, section);
		const scan = page.getByRole("textbox", { name: "Codice a barre" });
		await scan.fill(card1!);
		await scan.press("Enter");
		await expect(page.getByTestId("scan-notice")).toContainText("aggiunto");
		await scan.fill(card2!);
		await scan.press("Enter");
		await expect(page.getByTestId("scan-notice")).toContainText("aggiunto");
		await scan.fill(card2!);
		await scan.press("Enter");
		await expect(page.getByTestId("scan-notice")).toContainText("già nella lista");
		await scan.fill("0000000000");
		await scan.press("Enter");
		await expect(page.getByTestId("scan-notice")).toContainText("Nessun utente");
		await expect(page.getByTestId("list-count")).toContainText(`${classSize + 2} utenti`);
		await expectAxeClean(page);

		// remove the last entry
		const entries = page.getByTestId("list-entries").locator("li");
		const last = entries.last();
		await last.locator('[data-testid^="remove-entry-"]').click();
		await expect(page.getByTestId("list-count")).toContainText(`${classSize + 1} utenti`);

		// print from the list: one unit per patron, in list order
		const listId = listUrl.split("/").pop();
		const sheet = await page.request.get(`/print/cards?list=${listId}`);
		expect(sheet.status()).toBe(200);
		expect(sheet.headers()["x-cards-count"]).toBe(String(classSize + 1));

		// still to print: the basket menu offers it
		const basketEntry = page.getByRole("menuitem", {
			name: `Tessere 2 ${section} ${tagOf(page)} (${classSize + 1})`,
		});
		await page.getByTestId("print-basket").click();
		await expect(basketEntry).toBeVisible();
		await page.getByTestId("print-basket").click();
		await expect(basketEntry).toBeHidden();

		// mark as printed: the list shows the date, the entries and the patrons carry it
		await expect(page.getByTestId("entry-printed").last()).toContainText("no");
		await page.getByTestId("mark-printed").click();
		await expect(page.getByRole("status").getByText(/segnate come stampate/)).toBeVisible();
		await expect(page.getByTestId("entry-printed").last()).toContainText("sì");
		await expect(page.getByTestId("entry-printed").filter({ hasText: "no" })).toHaveCount(0);
		await expect(page.getByTestId("page-header-bar")).toContainText("Stampata il");
		const firstPatron = await entries.first().getByRole("link").getAttribute("href");
		await page.goto(firstPatron!);
		await waitForHydration(page);
		await page.getByRole("tab", { name: "Tessera" }).click();
		await expect(page.getByText(/Tessera stampata il/)).toBeVisible();
	});

	test("the basket and the index show the list; rename and delete work", async ({
		page,
		isMobile,
	}) => {
		await page.goto(listUrl);
		await waitForHydration(page);
		// marked as printed: the basket menu no longer offers it
		await page.getByTestId("print-basket").click();
		await expect(page.getByRole("menuitem", { name: "Tutte le liste" })).toBeVisible();
		await expect(
			page.getByRole("menuitem", {
				name: new RegExp(`^Tessere 2 ${sectionOf(page)} ${tagOf(page)} `),
			}),
		).toHaveCount(0);
		await page.getByTestId("print-basket").click();
		// in the page's toolbar a desktop window has room for every action: all of them are buttons
		// (9.13, rounds 22 and 24)
		if (!isMobile) {
			await expect(page.getByTestId("page-actions-row")).toHaveAttribute("data-mode", "full");
			await expect(page.getByTestId("more-actions")).toHaveCount(0);
		}

		await (await pageAction(page, "rename-list")).click();
		await page.getByTestId("rename-input").fill(`Rinominata ${tagOf(page)}`);
		await page.getByTestId("rename-form").getByRole("button", { name: "Salva" }).click();
		await expect(page.getByRole("heading", { level: 1 })).toHaveText(
			`Rinominata ${tagOf(page)}`,
		);

		await page.goto("/print-lists");
		await waitForHydration(page);
		await expect(page.getByTestId("print-lists")).toContainText(`Rinominata ${tagOf(page)}`);
		await expect(page.getByTestId("print-lists")).toContainText("Stampata il");
		const listId = Number(listUrl.split("/").pop());
		await page.getByTestId(`delete-list-${listId}`).click();
		await page.getByTestId("confirm-button").click();
		await expect(page.getByTestId(`print-list-${listId}`)).toHaveCount(0);
	});

	test('a new list without a name takes "Lista N del gg/mm/aaaa", and the page goes on', async ({
		page,
	}) => {
		// the owner: an empty name blocked the page (the dialog closed and never opened again)
		await page.goto("/print-lists");
		await waitForHydration(page);
		await page.getByTestId("new-patron-list").click();
		const name = page.getByTestId("new-list-name");
		await expect(name).toHaveValue("");
		const proposed = (await name.getAttribute("placeholder")) ?? "";
		expect(proposed).toMatch(/^Lista \d+ del \d{2}\/\d{2}\/\d{4}$/);
		await page.getByTestId("confirm-button").click();
		await expect(page).toHaveURL(/\/print-lists\/\d+$/);
		await expect(page.getByRole("heading", { level: 1 })).toHaveText(proposed);
		// back in Stampe the dialogs open again, and the next proposal is another name
		await page.goto("/print-lists");
		await waitForHydration(page);
		await page.getByTestId("new-patron-list").click();
		await expect(page.getByTestId("new-list-name")).toBeVisible();
		expect(await page.getByTestId("new-list-name").getAttribute("placeholder")).not.toBe(
			proposed,
		);
		await page.getByRole("button", { name: "Annulla" }).click();
		await page.getByTestId("new-patron-list").click();
		await expect(page.getByTestId("new-list-name")).toBeVisible();
	});

	test("prints the cards of a class from under the lists", async ({ page }) => {
		const section = sectionOf(page);
		await page.goto("/print-lists");
		await waitForHydration(page);
		const classes = page.getByTestId("print-classes");
		// the lists first, then the classes
		const listsBox = await page.getByTestId("print-lists").boundingBox();
		const classesBox = await classes.boundingBox();
		expect((classesBox?.y ?? 0) > (listsBox?.y ?? 0)).toBe(true);
		const tile = classes.getByTestId(`print-class-2${section}`);
		await tile.getByTestId("print-class-cards").click();
		const dialog = page.getByTestId("card-print-dialog");
		await expect(dialog).toBeVisible();
		await expect(dialog.getByTestId("card-print")).toHaveAttribute(
			"href",
			new RegExp(`/print/cards\\?group=${seededClassId(2, section)}&layout=`),
		);
		// printed from here, the cards of the class are marked as printed like those of a list (9.42)
		await expect(dialog.getByTestId("card-mark-printed")).toHaveCount(0);
		const popup = page.waitForEvent("popup");
		await dialog.getByTestId("card-print").click();
		await (await popup).close();
		await dialog.getByTestId("card-mark-printed").click();
		await expect(
			page.getByRole("status").getByText(/\d+ tessere? segnate? come stampate?/),
		).toBeVisible();
		await expect(dialog).toHaveCount(0);
	});

	test("adds selected patrons to a new list from the patron grid", async ({ page }) => {
		await page.goto("/patrons");
		await waitForHydration(page);
		await page.getByRole("combobox", { name: "Classe", exact: true }).selectOption("4");
		await page
			.getByRole("combobox", { name: "Sezione", exact: true })
			.selectOption({ label: `Sezione: ${sectionOf(page)}` });
		const rows = page.getByTestId("data-grid").locator(".wx-row");
		await rows.nth(0).click({ modifiers: ["Control"] });
		await rows.nth(1).click({ modifiers: ["Control"] });
		await expect(page).toHaveURL(/\/patrons(\?.*)?$/);
		await page.getByTestId("add-to-list").click();
		await page.getByTestId("add-to-list-dialog").getByRole("radio").last().check();
		await page.getByTestId("add-to-list-name").fill(`Dal filtro ${tagOf(page)}`);
		await page.getByTestId("confirm-button").click();
		await expect(page.getByRole("status").getByText(/2 aggiunti/)).toBeVisible();
		// a new list with entries is still to print: the basket menu opens it
		await page.getByTestId("print-basket").click();
		await page.getByRole("menuitem", { name: `Dal filtro ${tagOf(page)} (2)` }).click();
		await expect(page).toHaveURL(/\/print-lists\/\d+$/);
		await expect(page.getByRole("heading", { level: 1 })).toHaveText(
			`Dal filtro ${tagOf(page)}`,
		);
	});

	test("adding to a list offers the lists there are, never a new one by mistake", async ({
		page,
	}) => {
		// with lists of patrons there, the dialog opened on "new list": confirming made one
		await page.goto("/patrons");
		await waitForHydration(page);
		await page.getByRole("combobox", { name: "Classe", exact: true }).selectOption("4");
		await page
			.getByTestId("data-grid")
			.locator(".wx-row")
			.nth(2)
			.click({ modifiers: ["Control"] });
		for (let opening = 0; opening < 2; opening++) {
			await page.getByTestId("add-to-list").click();
			const dialog = page.getByTestId("add-to-list-dialog");
			await expect(dialog.getByRole("radio").first()).toBeChecked();
			await expect(page.getByTestId("add-to-list-select")).toBeEnabled();
			await expect(page.getByTestId("add-to-list-name")).toBeDisabled();
			await page.getByRole("button", { name: "Annulla" }).click();
		}
	});

	test("reorders the copies of a list by dragging one onto another", async ({
		page,
		isMobile,
	}) => {
		test.skip(isMobile, "drag and drop with the mouse; the phone uses the arrows");
		await page.goto("/print-lists");
		await waitForHydration(page);
		await page.getByTestId("new-item-list").click();
		await page.getByTestId("new-list-name").fill(`Ordine copie ${tagOf(page)}`);
		await page.getByTestId("confirm-button").click();
		await expect(page).toHaveURL(/\/print-lists\/\d+$/);
		await waitForHydration(page);
		// a list of books prints its labels and nothing else: no bulk change of its copies
		await expect(page.getByTestId("list-batch")).toHaveCount(0);
		await page.getByTestId("quick-genre").selectOption({ index: 1 });
		await page.getByTestId("quick-add").click();
		await expect(page.getByRole("status").getByText(/aggiunt/)).toBeVisible();
		const entries = page.getByTestId("list-entries").locator(":scope > li");
		const order = async (): Promise<string[]> =>
			(await entries.evaluateAll((els) => els.map((el) => el.dataset.testid ?? ""))).slice(
				0,
				3,
			);
		const [first, second, third] = await order();
		expect(third).toBeTruthy();
		// the first copy dropped on the third goes just before it
		await page.getByTestId(first!).dragTo(page.getByTestId(third!));
		await expect.poll(order).toEqual([second, first, third]);
		await page.reload();
		await waitForHydration(page);
		await expect.poll(order).toEqual([second, first, third]);
	});
});
