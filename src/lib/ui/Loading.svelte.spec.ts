// SPDX-License-Identifier: GPL-3.0-or-later
import { page } from "vitest/browser";
import { describe, expect, it } from "vitest";
import { render } from "vitest-browser-svelte";
import { testI18nContext } from "../../../tests/helpers/i18n.js";
import Loading from "./Loading.svelte";

describe("Loading.svelte", () => {
	it("shows the large turning icon with Caricamento…, announced politely", async () => {
		await render(Loading, { context: await testI18nContext() });
		const status = page.getByRole("status");
		await expect.element(status).toHaveTextContent("Caricamento…");
		await expect.element(status).toHaveAttribute("aria-live", "polite");
		const icon = status.element().querySelector("svg");
		expect(icon?.getAttribute("class")).toContain("animate-[spin_1.8s_linear_infinite]");
		// centred down a good part of the window, not only across
		expect(status.element().getAttribute("class")).toContain("min-h-[50svh]");
	});

	it("is the same wait in a box, and silent inside a live region of its own", async () => {
		await render(Loading, {
			props: { size: "md", announce: false },
			context: await testI18nContext(),
		});
		const wait = page.getByTestId("loading");
		await expect.element(wait).toHaveTextContent("Caricamento…");
		expect(wait.element().getAttribute("role")).toBeNull();
		expect(wait.element().getAttribute("class")).not.toContain("min-h-");
		expect(wait.element().querySelector("svg")?.getAttribute("class")).toContain("1.8s");
	});
});
