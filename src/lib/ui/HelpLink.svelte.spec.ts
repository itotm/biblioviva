// SPDX-License-Identifier: GPL-3.0-or-later
import { page } from "vitest/browser";
import { describe, expect, it } from "vitest";
import { render } from "vitest-browser-svelte";
import { testI18nContext } from "../../../tests/helpers/i18n.js";
import { formatContext } from "./format.js";
import HelpLink from "./HelpLink.svelte";

async function contextIn(locale: string): Promise<Map<symbol, unknown>> {
	return new Map<symbol, unknown>([
		...(await testI18nContext()),
		...formatContext({ locale, timezone: "Europe/Rome" }),
	]);
}

describe("HelpLink.svelte", () => {
	it("opens the section of the documentation in a new tab, in Italian", async () => {
		await render(HelpLink, {
			props: { spot: "fastAddCode", topic: "Codice del libro" },
			context: await contextIn("it"),
		});
		const link = page.getByRole("link", { name: "Guida: Codice del libro" });
		await expect.element(link).toBeVisible();
		await expect
			.element(link)
			.toHaveAttribute(
				"href",
				"https://docs.biblioviva.org/it/manual/new-book/#passo-codice",
			);
		await expect.element(link).toHaveAttribute("target", "_blank");
		await expect.element(link).toHaveAttribute("rel", "external noopener");
		await expect.element(link).toHaveAttribute("title", "Guida: Codice del libro");
		// no text beside the icon: the name is the label
		expect(link.element().textContent?.trim()).toBe("");
	});

	it("follows the installation's language to the English documentation", async () => {
		await render(HelpLink, {
			props: { spot: "backupOffsite", topic: "Copia esterna" },
			context: await contextIn("en"),
		});
		await expect
			.element(page.getByTestId("help-spot"))
			.toHaveAttribute(
				"href",
				"https://docs.biblioviva.org/en/admin/screens/backups/#off-site-copy",
			);
	});
});
