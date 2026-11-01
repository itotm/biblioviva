// SPDX-License-Identifier: GPL-3.0-or-later
import type { Locator, Page } from "@playwright/test";
import { waitForHydration } from "../helpers/hydration.js";

/** Base class for page objects (one per screen, `tests/e2e/pages/<screen>.page.ts`). */
export abstract class BasePage {
	constructor(protected readonly page: Page) {}

	abstract readonly path: string;

	/** Navigates and waits for hydration, so typing is never lost to the client takeover. */
	async goto(): Promise<void> {
		await this.page.goto(this.path);
		await waitForHydration(this.page);
	}

	get heading(): Locator {
		return this.page.getByRole("heading", { level: 1 });
	}

	/** Toast messages rendered by the root layout. */
	toast(text: string | RegExp): Locator {
		return this.page.getByRole("status").getByText(text);
	}
}
