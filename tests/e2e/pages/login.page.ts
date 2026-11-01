// SPDX-License-Identifier: GPL-3.0-or-later
import { expect, type Locator } from "@playwright/test";
import { BasePage } from "./base.page.js";

export class LoginPage extends BasePage {
	readonly path = "/login";

	get username(): Locator {
		return this.page.getByRole("textbox", { name: /Nome utente|Username/ });
	}

	get password(): Locator {
		return this.page.getByRole("textbox", { name: /^Password$/ });
	}

	get submit(): Locator {
		return this.page.getByRole("button", { name: /^(Entra|Log in)$/ });
	}

	get error(): Locator {
		return this.page.getByTestId("login-error");
	}

	async loginAs(username: string, password: string): Promise<void> {
		// a previous (failed) submission resets the form after showing its error: let it finish
		await expect(this.submit).toBeEnabled();
		await this.page.waitForLoadState("networkidle");
		await this.username.fill(username);
		await this.password.fill(password);
		await expect(this.username).toHaveValue(username);
		await this.submit.click();
	}
}
