// SPDX-License-Identifier: GPL-3.0-or-later
// Segnalazioni (step 9.18, Q113): the administrator writes a pinned note with a colour, finds it
// at the top of the dashboard, unpins, archives, restores and deletes it; an account that opens on
// the desk sees the pinned notes there, writes a note of its own and has none of the
// administrator's actions, which the server refuses too.
import { expect, test, type Locator, type Page } from "@playwright/test";
import { LoginPage } from "./pages/login.page.js";
import { expectAxeClean } from "./helpers/axe.js";
import { waitForHydration } from "./helpers/hydration.js";

const tagOf = (page: Page): string => (page.viewportSize()?.width === 412 ? "Mob" : "Desk");
const SEEDED_PINNED = "Venerdì la biblioteca chiude alle 12";

/** The administrator's "Metti in evidenza" call, replayed by an operator account. */
let pinCall: { url: string; body: string } | null = null;

const noteWith = (page: Page, text: string): Locator =>
	page.getByTestId("notes-grid").getByTestId("note").filter({ hasText: text });

test.describe.serial("staff notes", () => {
	test("the administrator writes, pins, archives, restores and deletes a note", async ({
		page,
	}) => {
		const text = `Toner finito ${tagOf(page)}`;
		await page.goto("/notes");
		await waitForHydration(page);
		await expect(page.getByTestId("notes-admin-only")).toHaveCount(0);
		await expect(noteWith(page, SEEDED_PINNED).getByTestId("note-pinned")).toHaveText(
			"In evidenza",
		);

		// an empty note is refused, a written one is saved with its colour and pinned
		await page.getByTestId("note-new").click();
		await expect(page.getByTestId("note-dialog")).toBeVisible();
		await page.getByTestId("note-save").click();
		await expect(page.getByTestId("note-problem")).toHaveText(
			"Il testo della segnalazione è obbligatorio.",
		);
		await page.getByTestId("note-body-input").fill(`${text}\nSecondo scaffale`);
		await expect(page.getByTestId("note-counter")).toHaveText(`${text.length + 17}/500`);
		await page.getByTestId("note-colors").getByText("Rosa").click();
		await page.getByTestId("note-pinned-input").check();
		await expectAxeClean(page);
		await page.getByTestId("note-save").click();
		await expect(page.getByTestId("note-dialog")).toHaveCount(0);
		const mine = noteWith(page, text);
		await expect(mine).toHaveAttribute("data-note-color", "pink");
		await expect(mine.getByTestId("note-pinned")).toBeVisible();
		await expect(mine.getByTestId("note-body")).toHaveText(`${text}\nSecondo scaffale`);
		await expect(mine.getByTestId("note-author")).toContainText("Amministratore");
		await expectAxeClean(page);

		// on the dashboard, under the quick actions (9.13, round 25)
		await page.goto("/");
		await waitForHydration(page);
		const pinned = page.getByTestId("pinned-notes");
		await expect(pinned.getByTestId("note").filter({ hasText: text })).toBeVisible();
		await expect(page.getByTestId("tile-open-notes")).toBeVisible();
		const order = await page
			.locator("[data-testid=pinned-notes], [data-testid=quick-actions]")
			.evaluateAll((els) => els.map((e) => e.getAttribute("data-testid")));
		expect(order).toEqual(["quick-actions", "pinned-notes"]);

		// unpinned: off the dashboard (the call is kept for the operator's test)
		await page.goto("/notes");
		await waitForHydration(page);
		const request = page.waitForRequest(
			(r) => r.method() === "POST" && r.url().includes("/_app/remote/"),
		);
		await mine.getByTestId("note-pin").click();
		const sent = await request;
		pinCall = { url: sent.url(), body: sent.postData() ?? "" };
		await expect(mine.getByTestId("note-pinned")).toHaveCount(0);
		await page.goto("/");
		await waitForHydration(page);
		await expect(page.getByTestId("note").filter({ hasText: text })).toHaveCount(0);

		// archived: out of the open notes, in the archive with who did it
		await page.goto("/notes");
		await waitForHydration(page);
		await mine.getByTestId("note-archive").click();
		await expect(mine).toHaveCount(0);
		await page.getByTestId("area-notes-tab-archived").click();
		await expect(page).toHaveURL(/\/notes\/archive$/);
		await waitForHydration(page);
		const archived = noteWith(page, text);
		await expect(archived.getByTestId("note-archived")).toContainText(
			"Archiviata da Amministratore",
		);
		await expectAxeClean(page);

		// restored, archived again and deleted for good
		await archived.getByTestId("note-restore").click();
		await expect(archived).toHaveCount(0);
		await page.goto("/notes");
		await waitForHydration(page);
		await expect(mine.getByTestId("note-pinned")).toHaveCount(0);
		await mine.getByTestId("note-archive").click();
		await expect(mine).toHaveCount(0);
		await page.goto("/notes/archive");
		await waitForHydration(page);
		await archived.getByTestId("note-delete").click();
		await page.getByTestId("confirm-button").click();
		await expect(archived).toHaveCount(0);
	});

	test("the desk account sees the pinned notes and writes one, without the admin's actions", async ({
		page,
	}) => {
		const text = `Scanner lento ${tagOf(page)}`;
		await page.context().clearCookies();
		const login = new LoginPage(page);
		await login.goto();
		await login.loginAs("prestiti", "prestiti-test-pw");
		// the account opens on the desk, where the pinned notes are
		await expect(page).toHaveURL(/\/circulation\/checkout$/);
		await expect(
			page.getByTestId("pinned-notes").getByTestId("note").filter({ hasText: SEEDED_PINNED }),
		).toBeVisible();

		await page.getByTestId("pinned-notes-open").click();
		await expect(page).toHaveURL(/\/notes$/);
		await waitForHydration(page);
		await expect(page.getByTestId("notes-admin-only")).toBeVisible();
		await expect(page.getByTestId("note-pin")).toHaveCount(0);
		await expect(page.getByTestId("note-archive")).toHaveCount(0);

		await page.getByTestId("note-new").click();
		await expect(page.getByTestId("note-pinned-input")).toHaveCount(0);
		await page.getByTestId("note-body-input").fill(text);
		await page.getByTestId("note-save").click();
		const mine = noteWith(page, text);
		await expect(mine).toHaveAttribute("data-note-color", "yellow");
		await expect(mine.getByTestId("note-author")).toContainText("Gestione prestiti");

		// the archive is readable, without restore or delete
		await page.getByTestId("area-notes-tab-archived").click();
		await waitForHydration(page);
		await expect(page.getByTestId("note-restore")).toHaveCount(0);
		await expect(page.getByTestId("note-delete")).toHaveCount(0);

		// the server refuses the administrator's call from this account
		expect(pinCall).not.toBeNull();
		if (pinCall) {
			const refused = await page.request.post(pinCall.url, {
				data: pinCall.body,
				headers: { "content-type": "application/json", origin: new URL(page.url()).origin },
			});
			// remote functions answer 200 with the error inside
			expect(await refused.json()).toMatchObject({ type: "error", error: { status: 403 } });
		}
	});
});
