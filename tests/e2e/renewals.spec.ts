// SPDX-License-Identifier: GPL-3.0-or-later
// Renewals (step 4.5): from the patron page (one loan, all loans), from the checkout desk's patron
// panel, the limit of a DVD with the "Restituisci" link and the administrator's override.
import { expect, test, type Page } from "@playwright/test";
import { createBook, createPatron, dayFromToday, importLoans } from "./helpers/data.js";
import { waitForHydration } from "./helpers/hydration.js";

const tagOf = (page: Page): "Mob" | "Desk" => (page.viewportSize()?.width === 412 ? "Mob" : "Desk");

test.describe.serial("renewals", () => {
	test("renews one loan, all loans, and forces the limit", async ({ page }) => {
		const t = tagOf(page);
		const teacher = await createPatron(page, `Rinnovi${t}`, "teacher");
		const book = await createBook(page, `Libro da rinnovare ${t}`, 2);
		const film = await createBook(page, `Film da rinnovare ${t}`, 1, "dvd");
		const [b1, b2] = book.barcodes as [string, string];
		const [d1] = film.barcodes as [string];
		await importLoans(page, [
			[teacher.card, b1, dayFromToday(-20), dayFromToday(-3)],
			[teacher.card, b2, dayFromToday(-10), dayFromToday(2)],
			[teacher.card, d1, dayFromToday(-10), dayFromToday(-5)],
		]);

		// the patron page: one loan, then all of them
		await page.goto(`/patrons/${teacher.id}`);
		await waitForHydration(page);
		const loans = page.getByTestId("open-loans");
		await expect(loans.locator("li")).toHaveCount(3);
		await loans
			.locator("li", { hasText: `Libro da rinnovare ${t}` })
			.first()
			.getByTestId("renew-loan")
			.click();
		await expect(page.getByTestId("desk-message").first()).toHaveAttribute(
			"data-code",
			"renewed",
		);
		await expect(page.getByTestId("desk-message-text").first()).toContainText(
			`Rinnovato: «Libro da rinnovare ${t}», nuova scadenza`,
		);
		await page.getByTestId("renew-all").click();
		// the DVD allows one renewal: the first "Rinnova tutti" still renews it
		await expect(page.getByTestId("desk-message-text").first()).toHaveText(
			"Rinnovati 3 prestiti su 3.",
		);

		// the desk: the DVD is at its limit now
		await page.goto(`/circulation/checkout?patron=${teacher.id}`);
		await waitForHydration(page);
		await page
			.getByTestId("desk-patron-loans")
			.locator("li", { hasText: `Film da rinnovare ${t}` })
			.getByTestId("desk-renew")
			.click();
		const refusal = page.getByTestId("desk-message").first();
		await expect(refusal).toHaveAttribute("data-code", "renewal_limit_reached");
		await expect(page.getByTestId("desk-message-text").first()).toHaveText(
			`«Film da rinnovare ${t}» è già stato rinnovato 1 volta, il massimo. Deve essere restituito.`,
		);
		await expect(refusal.getByTestId("action-return")).toHaveAttribute(
			"href",
			`/circulation/checkin?barcode=${encodeURIComponent(d1)}`,
		);
		// an administrator forces it with a reason
		await refusal.getByTestId("action-override-renewal").click();
		await expect(page.getByTestId("confirm-button")).toBeDisabled();
		await page.getByTestId("override-reason").fill("gita scolastica");
		await page.getByTestId("confirm-button").click();
		await expect(page.getByTestId("desk-message").first()).toHaveAttribute(
			"data-code",
			"renewed",
		);
		// "Rinnova tutti" on the desk: the DVD refuses again, the books renew
		await page.getByTestId("desk-renew-all").click();
		await expect(page.getByTestId("desk-message-text").first()).toHaveText(
			"Rinnovati 2 prestiti su 3.",
		);
		await expect(page.getByTestId("desk-message").nth(1)).toHaveAttribute(
			"data-code",
			"renewal_limit_reached",
		);
	});
});
