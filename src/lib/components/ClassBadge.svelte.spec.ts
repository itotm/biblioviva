// SPDX-License-Identifier: GPL-3.0-or-later
import { page } from "vitest/browser";
import { describe, expect, it } from "vitest";
import { render } from "vitest-browser-svelte";
import ClassBadge from "./ClassBadge.svelte";

describe("ClassBadge.svelte", () => {
	it("shows the class label of students", async () => {
		await render(ClassBadge, { label: "3 A" });
		await expect.element(page.getByTestId("class-badge")).toHaveTextContent("3 A");
	});

	it("shows the fallback for teachers and nothing when both are missing", async () => {
		await render(ClassBadge, { fallback: "Docente" });
		await expect.element(page.getByTestId("class-badge")).toHaveTextContent("Docente");
	});
});
