// SPDX-License-Identifier: GPL-3.0-or-later
import type { Page } from "@playwright/test";

/** The root layout sets `data-hydrated` on <html> once the client has taken over. */
export async function waitForHydration(page: Page): Promise<void> {
	await page.locator("html[data-hydrated]").waitFor({ state: "attached" });
}
