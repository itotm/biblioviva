// SPDX-License-Identifier: GPL-3.0-or-later
// Books to classify (step 9.21, Q117): a book entered with "Classifica dopo" in the fast add waits
// in the tab "Da classificare" and on the dashboard; the flow classifies one book, skips another
// and classifies a third; the desk refuses a copy of the skipped one and lends the others. The
// database is shared by the projects: every book carries the project's tag, each flow page is
// opened by its record, never by the position in the list, and after a book the flow shows the
// next one or the end of the round.
import { expect, test, type Page } from "@playwright/test";
import { expectAxeClean } from "./helpers/axe.js";
import { createBook, createPatron } from "./helpers/data.js";
import { waitForHydration } from "./helpers/hydration.js";
import { deskScan } from "./helpers/desk.js";

const tagOf = (page: Page): "Mob" | "Desk" => (page.viewportSize()?.width === 412 ? "Mob" : "Desk");

async function scan(page: Page, code: string): Promise<void> {
	await deskScan(page, code);
}

test("classify later, in a flow, and the desk waits for it", async ({ page }) => {
	const t = tagOf(page);
	// the fast add without a code, saved with "Classifica dopo"
	const first = `Da classificare A ${t}`;
	await page.goto("/cataloging/new");
	await waitForHydration(page);
	await page.getByTestId("no-code").click();
	await page.getByTestId("search-title").fill(first);
	await page.getByTestId("search-submit").click();
	await page.getByTestId("lookup-manual").click();
	await expect(page.getByTestId("stage-form")).toBeVisible();
	await page.getByTestId("quick-author-Anonimo").click();
	await page.getByTestId("quick-publisher").click();
	await page.getByTestId("kind-later").click();
	await expect(page.getByTestId("classify-later-hint")).toContainText("Da classificare");
	// no call number before the classification
	await expect(page.getByTestId("fast-call-number")).toHaveValue("");
	await page.getByTestId("biblio-submit").click();
	await expect(page.getByTestId("stage-done")).toBeVisible();
	await page.getByTestId("done-open").click();
	await expect(page).toHaveURL(/\/catalog\/\d+$/);
	const a = Number(page.url().split("/").pop());
	await expect(page.getByTestId("to-classify-badge")).toHaveText("Da classificare");
	await expect(page.getByTestId("kind-badge")).toHaveCount(0);

	const b = await createBook(page, `Da classificare B ${t}`, 1, "libro", true);
	const c = await createBook(page, `Da classificare C ${t}`, 1, "libro", true);

	// the dashboard tile and the tab
	await page.goto("/");
	await expect(page.getByTestId("tile-to-classify")).toBeVisible();
	await page.getByTestId("tile-to-classify").click();
	await expect(page).toHaveURL(/\/catalog\/to-classify$/);
	await waitForHydration(page);
	await expect(page.getByTestId("to-classify-count")).toContainText("libri da classificare");
	for (const title of [first, `Da classificare B ${t}`, `Da classificare C ${t}`]) {
		await expect(page.getByText(title, { exact: true })).toBeVisible();
	}
	await expect(page.getByTestId("classify-start")).toBeVisible();
	await expectAxeClean(page);

	// the record page leads to the flow; a genre, the call number, "Salva e avanti"
	await page.goto(`/catalog/${a}`);
	await waitForHydration(page);
	await page.getByTestId("classify-record").click();
	await expect(page).toHaveURL(new RegExp(`/catalog/to-classify/${a}$`));
	await waitForHydration(page);
	await expect(page.getByTestId("classify-title")).toHaveText(first);
	await expect(page.getByTestId("classify-save")).toBeDisabled();
	await page.getByTestId("genre-B").click();
	await expect(page.getByTestId("classify-call-number")).toContainText("B ANO");
	await expectAxeClean(page);
	await page.getByTestId("classify-save").click();
	// the next book, or the end of the round when no other is left after it
	await expect(page.getByText(`«${first}» classificato`)).toBeVisible();
	await expect(page.getByTestId("classify-title").filter({ hasText: first })).toHaveCount(0);

	// B is skipped, C is classified as non-fiction
	await page.goto(`/catalog/to-classify/${b.id}`);
	await waitForHydration(page);
	await page.getByTestId("classify-skip").click();
	await expect(
		page.getByTestId("classify-title").filter({ hasText: `Da classificare B ${t}` }),
	).toHaveCount(0);
	await page.goto(`/catalog/to-classify/${c.id}`);
	await waitForHydration(page);
	await page.getByTestId("kind-nonfiction").click();
	await page.getByTestId("class-500").click();
	await page.getByTestId("class-590").click();
	await page.getByTestId("classify-save").click();
	await expect(page.getByText(`«Da classificare C ${t}» classificato`)).toBeVisible();

	// the list keeps B only
	await page.goto("/catalog/to-classify");
	await waitForHydration(page);
	await expect(page.getByText(`Da classificare B ${t}`, { exact: true })).toBeVisible();
	await expect(page.getByText(first, { exact: true })).toHaveCount(0);
	await expect(page.getByText(`Da classificare C ${t}`, { exact: true })).toHaveCount(0);

	// the desk refuses the copy of B, with "Classifica", and lends C
	const student = await createPatron(page, `Classifica${t}`);
	await page.goto("/circulation/checkout");
	await waitForHydration(page);
	await scan(page, student.card);
	await scan(page, b.barcodes[0] ?? "");
	const message = page.getByTestId("desk-message").first();
	await expect(message).toHaveAttribute("data-code", "item_unclassified");
	await expect(page.getByTestId("desk-message-text").first()).toHaveText(
		`«Da classificare B ${t}» non è ancora classificato e non si presta. Va classificato prima: genere o classe.`,
	);
	await expect(page.getByTestId("action-classify")).toHaveAttribute(
		"href",
		`/catalog/to-classify/${b.id}`,
	);
	await expect(page.getByTestId("action-override")).toHaveCount(0);
	await scan(page, c.barcodes[0] ?? "");
	await expect(message).toHaveAttribute("data-code", "lent");
});
