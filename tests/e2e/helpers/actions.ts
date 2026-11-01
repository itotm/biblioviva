// SPDX-License-Identifier: GPL-3.0-or-later
import type { Locator, Page } from "@playwright/test";

/**
 * A header action of the page (9.13, rounds 21–22): its button when the actions fit on one row,
 * else its entry under "Altre azioni", which is opened first.
 */
export async function pageAction(page: Page, testid: string): Promise<Locator> {
	const row = page.locator('[data-testid="page-actions-row"][data-mode]');
	await row.waitFor();
	// after the window changes size the row is measured again in the next frames: wait for them,
	// so the action is not looked for in the row it is about to leave
	await page.evaluate(
		() =>
			new Promise<void>((done) =>
				requestAnimationFrame(() => requestAnimationFrame(() => done())),
			),
	);
	const action = page.getByTestId(testid);
	if (!(await action.isVisible())) {
		await page.getByTestId("more-actions").click();
	}
	return action;
}
