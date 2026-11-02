// SPDX-License-Identifier: GPL-3.0-or-later
// Loan rules per item type and the calendar editor (step 11.5): an override typed in the matrix,
// saved and cleared; a school holiday clicked on the calendar of a later school year and a closed
// range added, saved and removed again. The configuration is shared: only the desktop project
// changes it, with values that change no due date the other specs compute, and it ends as it started.
import { expect, test } from "@playwright/test";
import { expectAxeClean } from "./helpers/axe.js";
import { waitForHydration } from "./helpers/hydration.js";

test.describe.serial("circulation rules and calendar", () => {
	test("rules per item type: inherited values shown, an override saved and cleared", async ({
		page,
		isMobile,
	}) => {
		await page.goto("/admin/config/circulation");
		await waitForHydration(page);
		const block = page.getByTestId("block-itemTypeRules");
		const rivista = block.locator('[data-testid="rule-row"][data-code="rivista"]');
		await expect(rivista.getByTestId("rule-loanDays")).toHaveAttribute(
			"placeholder",
			"15 / 15",
		);
		await expect(
			block.locator('[data-testid="rule-row"][data-code="dvd"]').getByTestId("rule-loanDays"),
		).toHaveValue("5");
		await expectAxeClean(page);
		test.skip(isMobile, "the configuration is shared: one project changes it");

		const save = async (): Promise<void> => {
			await Promise.all([
				page.waitForResponse((r) => r.url().includes("saveItemTypeRules")),
				block.getByTestId("rules-save").click(),
			]);
			await expect(block.getByTestId("rules-save")).toBeDisabled();
		};
		// the same number as the patrons' rule: nothing changes for the other specs
		await rivista.getByTestId("rule-loanDays").fill("15");
		await save();
		await expect(
			page.getByRole("status").getByText("Regole per materiale salvate"),
		).toBeVisible();
		await page.reload();
		await waitForHydration(page);
		await expect(rivista.getByTestId("rule-loanDays")).toHaveValue("15");
		await rivista.getByTestId("rule-loanDays").fill("");
		await save();
		await page.reload();
		await waitForHydration(page);
		await expect(rivista.getByTestId("rule-loanDays")).toHaveValue("");
	});

	test("calendar: a holiday clicked and a closed range added, then removed", async ({
		page,
		isMobile,
	}) => {
		await page.goto("/admin/config/calendar");
		await waitForHydration(page);
		const block = page.getByTestId("block-calendar");
		await expect(block.getByTestId("calendar-month")).toHaveCount(12);
		await expect(block.getByTestId("weekly-0")).toHaveAttribute("aria-pressed", "true");
		await expectAxeClean(page);
		test.skip(isMobile, "the configuration is shared: one project changes it");

		// a school year no other spec looks at
		const start = Number(
			((await block.getByTestId("calendar-year").textContent()) ?? "").slice(0, 4),
		);
		await block.getByTestId("calendar-year-next").click();
		await block.getByTestId("calendar-year-next").click();
		const year = start + 2;
		await expect(block.getByTestId("calendar-year")).toHaveText(`${year}/${year + 1}`);
		const day = block.locator(`[data-day="${year + 1}-02-15"]`);
		await expect(day).toHaveAttribute("aria-pressed", "false");
		await day.click();
		await expect(day).toHaveAttribute("aria-pressed", "true");
		const rows = block.getByTestId("range-row");
		const before = await rows.count();
		await block.getByTestId("range-add").click();
		await rows
			.last()
			.getByTestId("range-from")
			.fill(`${year + 1}-05-10`);
		await rows
			.last()
			.getByTestId("range-to")
			.fill(`${year + 1}-05-08`);
		await expect(block.getByTestId("calendar-save")).toBeDisabled();
		await rows
			.last()
			.getByTestId("range-to")
			.fill(`${year + 1}-05-12`);
		await rows.last().getByTestId("range-reason").fill("Gita");
		await expect(block.locator(`[data-day="${year + 1}-05-11"]`)).toBeDisabled();

		const save = async (): Promise<void> => {
			await Promise.all([
				page.waitForResponse((r) => r.url().includes("saveCalendarChange")),
				block.getByTestId("calendar-save").click(),
			]);
			await expect(block.getByTestId("calendar-save")).toBeDisabled();
		};
		await save();
		await expect(page.getByRole("status").getByText("Calendario salvato")).toBeVisible();

		await page.reload();
		await waitForHydration(page);
		await block.getByTestId("calendar-year-next").click();
		await block.getByTestId("calendar-year-next").click();
		await expect(day).toHaveAttribute("aria-pressed", "true");
		await expect(rows).toHaveCount(before + 1);
		await day.click();
		const gita = await rows
			.getByTestId("range-reason")
			.evaluateAll((els) => els.findIndex((e) => (e as HTMLInputElement).value === "Gita"));
		await rows.nth(gita).getByRole("button").click();
		await expect(rows).toHaveCount(before);
		await save();
		await page.reload();
		await waitForHydration(page);
		await expect(rows).toHaveCount(before);
	});
});
