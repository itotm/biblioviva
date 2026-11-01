// SPDX-License-Identifier: GPL-3.0-or-later
import { page } from "vitest/browser";
import { describe, expect, it } from "vitest";
import { render } from "vitest-browser-svelte";
import { testI18nContext } from "../../../../tests/helpers/i18n.js";
import DeskMessages from "./DeskMessages.svelte";

describe("DeskMessages.svelte", () => {
	it("shows two identical messages (two copies of one title refused a renewal)", async () => {
		const refused = {
			code: "renewal_hard_due_date",
			tone: "warning" as const,
			text: "«Pinocchio» non si può rinnovare oltre il 30/06/2027.",
		};
		await render(DeskMessages, {
			props: { messages: [refused, { ...refused }] },
			context: await testI18nContext(),
		});
		await expect.element(page.getByTestId("desk-messages")).toBeInTheDocument();
		expect(page.getByTestId("desk-message").all()).toHaveLength(2);
	});
});
