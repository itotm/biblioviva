// SPDX-License-Identifier: GPL-3.0-or-later
// Library calendar, read-only (step 4.1): the months of the 2026/2027 school year with the
// weekly closures, the national holidays (Easter Monday by computus), the school holiday and the
// closed ranges of the e2e configuration, each named under its month (consecutive days closed for one
// reason on one line, "da … a …").
import { expect, test } from "@playwright/test";
import { expectAxeClean } from "./helpers/axe.js";
import { waitForHydration } from "./helpers/hydration.js";

test("the calendar shows the closures of the configuration", async ({ page }) => {
	await page.goto("/calendar?year=2026");
	await waitForHydration(page);
	await expect(page.getByTestId("calendar-year")).toContainText("2026/2027");
	// the week starts on the configured day, Monday here (library.weekStart, 9.13 round 17)
	await expect(page.getByTestId("month-2026-09").getByTestId("weekday-header")).toHaveText([
		"L",
		"M",
		"M",
		"G",
		"V",
		"S",
		"D",
	]);
	const november = page.getByTestId("month-2026-11");
	await expect(november.locator('[data-date="2026-11-02"]')).toHaveAttribute(
		"data-closed",
		"holiday",
	);
	await expect(november.locator('[data-date="2026-11-01"]')).toHaveAttribute(
		"data-closed",
		"national",
	);
	await expect(november.locator('[data-date="2026-11-03"]')).toHaveAttribute(
		"data-closed",
		"open",
	);
	await expect(page.getByTestId("closures-2026-11")).toContainText("Ognissanti");
	// consecutive days closed for one reason make one line, in each month they cross
	for (const month of ["2026-12", "2027-01"]) {
		await expect(page.getByTestId(`closures-${month}`).locator("li")).toContainText([
			"da mer 23 dic a mer 6 gen · Vacanze di Natale",
		]);
	}
	await expect(page.getByTestId("closures-2026-12").locator("li")).toHaveText([
		"mar 8 dic · Immacolata",
		"da mer 23 dic a mer 6 gen · Vacanze di Natale",
	]);
	await expect(
		page.getByTestId("month-2027-03").locator('[data-date="2027-03-29"]'),
	).toHaveAttribute("data-closed", "national");
	await expect(page.getByTestId("closures-2027-03")).toContainText("Lunedì dell'Angelo");
	await expectAxeClean(page);
	await page.getByTestId("calendar-next").click();
	await expect(page.getByTestId("calendar-year")).toContainText("2027/2028");
});
