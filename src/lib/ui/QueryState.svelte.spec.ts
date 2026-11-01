// SPDX-License-Identifier: GPL-3.0-or-later
import { createRawSnippet } from "svelte";
import { page } from "vitest/browser";
import { describe, expect, it } from "vitest";
import { render } from "vitest-browser-svelte";
import { testI18nContext } from "../../../tests/helpers/i18n.js";
import QueryState from "./QueryState.svelte";

const title = createRawSnippet((value: () => string) => ({
	render: () => `<p data-testid="content">${value()}</p>`,
}));
const empty = createRawSnippet(() => ({ render: () => `<p data-testid="empty">Nessuno</p>` }));
const wait = createRawSnippet(() => ({ render: () => `<p data-testid="own-wait">Ricerca…</p>` }));

describe("QueryState.svelte", () => {
	it("waits until the query is ready, in the size asked", async () => {
		await render(QueryState<string>, {
			props: { query: { error: undefined, ready: false }, size: "md", children: title },
			context: await testI18nContext(),
		});
		const loading = page.getByTestId("loading");
		await expect.element(loading).toHaveTextContent("Caricamento…");
		expect(loading.element().getAttribute("class")).not.toContain("min-h-");
		expect(page.getByTestId("content").query()).toBeNull();
	});

	it("renders the caller's own wait in place of Loading", async () => {
		await render(QueryState<string>, {
			props: { query: { error: undefined, ready: false }, loading: wait, children: title },
			context: await testI18nContext(),
		});
		await expect.element(page.getByTestId("own-wait")).toBeVisible();
		expect(page.getByTestId("loading").query()).toBeNull();
	});

	it("shows a failure as the one error alert, the error before a value kept from before", async () => {
		await render(QueryState<string>, {
			props: {
				query: { error: new Error("500"), ready: true, current: "Il piccolo principe" },
				children: title,
			},
			context: await testI18nContext(),
		});
		await expect
			.element(page.getByRole("alert"))
			.toHaveTextContent("Si è verificato un errore");
		expect(page.getByTestId("content").query()).toBeNull();
	});

	it("takes the alert's text from the caller", async () => {
		await render(QueryState<string>, {
			props: {
				query: { error: new Error("500"), ready: false },
				errorText: "Modello non modificabile",
				children: title,
			},
			context: await testI18nContext(),
		});
		await expect.element(page.getByRole("alert")).toHaveTextContent("Modello non modificabile");
	});

	it("shows a record not found with the way back to its list", async () => {
		await render(QueryState<string>, {
			props: {
				query: { error: new Error("404"), ready: false },
				mode: "notFound",
				back: "/catalog",
				children: title,
			},
			context: await testI18nContext(),
		});
		await expect
			.element(page.getByRole("link", { name: "Indietro" }))
			.toHaveAttribute("href", "/catalog");
		expect(page.getByRole("alert").query()).toBeNull();
	});

	it("renders the value, or the empty snippet when the caller calls it empty", async () => {
		const context = await testI18nContext();
		const isEmpty = (value: string): boolean => value === "";
		const filled = await render(QueryState<string>, {
			props: {
				query: { error: undefined, ready: true, current: "Il piccolo principe" },
				isEmpty,
				empty,
				children: title,
			},
			context,
		});
		await expect.element(page.getByTestId("content")).toHaveTextContent("Il piccolo principe");
		expect(page.getByTestId("empty").query()).toBeNull();
		await filled.unmount();

		await render(QueryState<string>, {
			props: {
				query: { error: undefined, ready: true, current: "" },
				isEmpty,
				empty,
				children: title,
			},
			context,
		});
		await expect.element(page.getByTestId("empty")).toHaveTextContent("Nessuno");
		expect(page.getByTestId("content").query()).toBeNull();
	});
});
