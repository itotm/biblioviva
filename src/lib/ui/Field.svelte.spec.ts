// SPDX-License-Identifier: GPL-3.0-or-later
// The hint and the errors of a field are tied to its control (WCAG 1.3.1, 3.3.1): a screen reader
// reads them with the field, and a field with an error says that it is invalid.
import { createRawSnippet } from "svelte";
import { page } from "vitest/browser";
import { describe, expect, it } from "vitest";
import { render } from "vitest-browser-svelte";
import Field from "./Field.svelte";

const control = createRawSnippet(() => ({ render: () => `<input class="input" name="title">` }));

function describedBy(): string[] {
	const input = page.getByRole("textbox").element();
	return (input.getAttribute("aria-describedby") ?? "")
		.split(" ")
		.filter(Boolean)
		.map((id) => document.getElementById(id)?.textContent ?? `missing ${id}`);
}

describe("Field.svelte", () => {
	it("ties the hint and the errors to the control and marks it invalid", async () => {
		await render(Field, {
			props: {
				label: "Titolo",
				hint: "Come sul frontespizio",
				errors: ["Il titolo è obbligatorio"],
				children: control,
			},
		});
		await expect.element(page.getByRole("textbox", { name: "Titolo" })).toBeVisible();
		expect(describedBy()).toEqual(["Come sul frontespizio", "Il titolo è obbligatorio"]);
		expect(page.getByRole("textbox").element().getAttribute("aria-invalid")).toBe("true");
	});

	it("follows the errors as they come and go", async () => {
		const { rerender } = await render(Field, {
			props: { label: "Titolo", errors: [] as string[], children: control },
		});
		expect(page.getByRole("textbox").element().hasAttribute("aria-invalid")).toBe(false);
		await rerender({ errors: ["Il titolo è obbligatorio"] });
		await expect.element(page.getByRole("textbox")).toHaveAttribute("aria-invalid", "true");
		expect(describedBy()).toEqual(["Il titolo è obbligatorio"]);
		await rerender({ errors: [] });
		await expect.element(page.getByRole("textbox")).not.toHaveAttribute("aria-invalid");
	});

	it("leaves a field without errors valid", async () => {
		await render(Field, { props: { label: "Titolo", hint: "Facoltativo", children: control } });
		expect(describedBy()).toEqual(["Facoltativo"]);
		expect(page.getByRole("textbox").element().hasAttribute("aria-invalid")).toBe(false);
	});
});
