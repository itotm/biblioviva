// SPDX-License-Identifier: GPL-3.0-or-later
import type { Locator, Page } from "@playwright/test";

/** The checkout desk's one field (9.13 round 33): the patron's card or name first, then the books. */
export const deskField = (page: Page): Locator => page.getByTestId("desk-scan").locator("input");

/** A code typed in the desk's field and confirmed with Enter, as a USB scanner does. */
export async function deskScan(page: Page, code: string): Promise<void> {
	const field = deskField(page);
	await field.fill(code);
	await field.press("Enter");
}
