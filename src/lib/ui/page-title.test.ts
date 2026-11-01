// SPDX-License-Identifier: GPL-3.0-or-later
// The browser tab's title comes from the page's `PageHeader`, already in the server's answer.
import { render } from "svelte/server";
import { describe, expect, it } from "vitest";
import { testI18nContext } from "../../../tests/helpers/i18n.js";
import PageTitleHarness from "../../../tests/helpers/PageTitleHarness.svelte";

async function headOf(props: {
	shell: boolean;
	title: string;
	docTitle?: string;
}): Promise<string> {
	const { head } = render(PageTitleHarness, { props, context: await testI18nContext() });
	return head;
}

describe("the tab title written by PageHeader", () => {
	it("is the page's title with the app's name, in place of the layout's", async () => {
		const head = await headOf({ shell: true, title: "Prestiti in corso" });
		expect(head).toContain("<title>Prestiti in corso · BiblioViva</title>");
		expect(head).not.toContain("<title>Layout</title>");
	});

	it("says what docTitle says when the tab differs from the heading", async () => {
		const head = await headOf({
			shell: true,
			title: "Scuola Rodari",
			docTitle: "Cruscotto",
		});
		expect(head).toContain("<title>Cruscotto · BiblioViva</title>");
	});

	it("leaves the title alone outside the app shell (the style guide's sample)", async () => {
		const head = await headOf({ shell: false, title: "Utenti" });
		expect(head).toContain("<title>Layout</title>");
		expect(head).not.toContain("Utenti");
	});
});
