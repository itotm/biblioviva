// SPDX-License-Identifier: GPL-3.0-or-later
// Notable dates of the calendar (step 9.25, Q125): an account with `loans` adds a date and a
// period, edits and deletes them on the calendar page; the dashboard lists the next ones; an account
// without `loans` reads the calendar and has nothing to add or edit.
import { expect, test, type Page } from "@playwright/test";
import { LoginPage } from "./pages/login.page.js";
import { expectAxeClean } from "./helpers/axe.js";
import { dayFromToday } from "./helpers/data.js";
import { waitForHydration } from "./helpers/hydration.js";

const tagOf = (page: Page): string => (page.viewportSize()?.width === 412 ? "Mob" : "Desk");

/** The desk's "Salva" call of a new date, replayed by an account without `loans`. */
let saveCall: { url: string; body: string } | null = null;

async function addDate(
	page: Page,
	title: string,
	startsOn: string,
	endsOn = "",
	notes = "",
): Promise<void> {
	await page.getByTestId("calendar-new").click();
	const dialog = page.getByTestId("calendar-dialog");
	await dialog.getByTestId("calendar-title-input").fill(title);
	await dialog.getByTestId("calendar-starts-input").fill(startsOn);
	await dialog.getByTestId("calendar-ends-input").fill(endsOn);
	await dialog.getByTestId("calendar-notes-input").fill(notes);
	await dialog.getByTestId("calendar-save").click();
	await expect(dialog).toHaveCount(0);
}

test.describe.serial("notable dates of the calendar", () => {
	test("the desk adds a date and a period, edits and deletes them", async ({ page }) => {
		const t = tagOf(page);
		await page.goto("/calendar?year=2026");
		await waitForHydration(page);
		await expect(page.getByRole("heading", { level: 1 })).toHaveText("Calendario");
		// the closures are edited in Administration only, even by the administrator (9.13, round 25)
		await expect(page.getByTestId("calendar-new")).toBeVisible();
		await expect(page.getByTestId("calendar-edit")).toHaveCount(0);
		// the seeded World Book Day of the school year
		await expect(page.getByTestId("dates-2027-04")).toContainText(
			"Giornata mondiale del libro",
		);
		await expectAxeClean(page);

		// one day, with a note
		const reading = `Lettura in classe ${t}`;
		await addDate(page, reading, "2026-11-12", "", "Classi terze");
		const november = page.getByTestId("dates-2026-11");
		await expect(november).toContainText(reading);
		await expect(november).toContainText("Classi terze");
		const marked = page.getByTestId("month-2026-11").locator('[data-date="2026-11-12"]');
		await expect(marked).toHaveAttribute("data-marked", "date");
		// the mark is the number itself, extra bold and underlined (9.13, round 24)
		await expect(marked).toHaveCSS("font-weight", "800");
		await expect(marked).toHaveCSS("text-decoration-line", "underline");

		// a period marks every one of its days, across the end of the month
		const contest = `Concorso del segnalibro ${t}`;
		await addDate(page, contest, "2026-11-28", "2026-12-02");
		for (const [month, day] of [
			["2026-11", "2026-11-29"],
			["2026-12", "2026-12-02"],
		] as const) {
			await expect(
				page.getByTestId(`month-${month}`).locator(`[data-date="${day}"]`),
			).toHaveAttribute("data-marked", "date");
			await expect(page.getByTestId(`dates-${month}`)).toContainText(contest);
		}

		// a period that ends before it starts: the browser stops it at the field (its first day is the
		// least value), the dialog stays open (the service refuses it too, see the unit tests)
		await page.getByTestId("calendar-new").click();
		const dialog = page.getByTestId("calendar-dialog");
		await dialog.getByTestId("calendar-title-input").fill("Sbagliata");
		await dialog.getByTestId("calendar-starts-input").fill("2026-11-20");
		await dialog.getByTestId("calendar-ends-input").fill("2026-11-10");
		await dialog.getByTestId("calendar-save").click();
		expect(
			await dialog
				.getByTestId("calendar-ends-input")
				.evaluate((el) => (el as HTMLInputElement).validity.rangeUnderflow),
		).toBe(true);
		await expect(dialog).toBeVisible();
		await page.keyboard.press("Escape");

		// edit: the dialog opens with the date, a new title is saved
		await november.getByRole("button", { name: new RegExp(reading) }).click();
		await expect(dialog.getByTestId("calendar-title-input")).toHaveValue(reading);
		await expect(dialog.getByTestId("calendar-starts-input")).toHaveValue("2026-11-12");
		await dialog.getByTestId("calendar-title-input").fill(`${reading} (rinviata)`);
		await dialog.getByTestId("calendar-starts-input").fill("2026-11-13");
		await dialog.getByTestId("calendar-save").click();
		await expect(november).toContainText(`${reading} (rinviata)`);
		await expect(
			page.getByTestId("month-2026-11").locator('[data-date="2026-11-13"]'),
		).toHaveAttribute("data-marked", "date");

		// delete, with a confirmation
		await november.getByRole("button", { name: new RegExp(contest) }).click();
		await dialog.getByTestId("calendar-delete").click();
		await page.getByTestId("confirm-button").click();
		await expect(page.getByRole("status").getByText("Data eliminata")).toBeVisible();
		await expect(page.getByTestId("month-2026-12")).not.toContainText(contest);
		await expect(november).not.toContainText(contest);
	});

	test("the dashboard lists the next dates", async ({ page }) => {
		const t = tagOf(page);
		const title = `Incontro con l'autore ${t}`;
		await page.goto("/calendar");
		await waitForHydration(page);
		const request = page.waitForRequest(
			(r) => r.method() === "POST" && r.url().includes("/_app/remote/"),
		);
		await addDate(page, title, dayFromToday(2));
		const sent = await request;
		saveCall = { url: sent.url(), body: sent.postData() ?? "" };
		await page.goto("/");
		await waitForHydration(page);
		const upcoming = page.getByTestId("upcoming-dates");
		await expect(upcoming).toContainText("Prossime date");
		await expect(upcoming).toContainText(title);
		await upcoming.getByTestId("upcoming-open").click();
		await expect(page).toHaveURL(/\/calendar$/);
	});

	test("an account without the desk reads the calendar and adds nothing", async ({ page }) => {
		await page.context().clearCookies();
		const login = new LoginPage(page);
		await login.goto();
		await login.loginAs("catalogo", "catalogo-test-pw");
		await expect(page).not.toHaveURL(/\/login/);
		await page.goto("/calendar?year=2026");
		await waitForHydration(page);
		await expect(page.getByTestId("dates-2027-04")).toContainText(
			"Giornata mondiale del libro",
		);
		await expect(page.getByTestId("calendar-new")).toHaveCount(0);
		await expect(page.getByTestId("calendar-edit")).toHaveCount(0);
		await expect(
			page.getByTestId("dates-2027-04").getByRole("button", { name: /Giornata/ }),
		).toHaveCount(0);
		await expectAxeClean(page);
		// the server refuses the desk's call from this account
		expect(saveCall).not.toBeNull();
		if (saveCall) {
			const refused = await page.request.post(saveCall.url, {
				data: saveCall.body,
				headers: { "content-type": "application/json", origin: new URL(page.url()).origin },
			});
			// remote functions answer 200 with the error inside
			expect(await refused.json()).toMatchObject({ type: "error", error: { status: 403 } });
		}
	});
});
