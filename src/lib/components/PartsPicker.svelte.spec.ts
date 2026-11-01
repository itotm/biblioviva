// SPDX-License-Identifier: GPL-3.0-or-later
import { page } from "vitest/browser";
import { describe, expect, it } from "vitest";
import { render } from "vitest-browser-svelte";
import { testI18nContext } from "../../../tests/helpers/i18n.js";
import type { PartId } from "#lib/shared/archive-parts.js";
import PartsPicker from "./PartsPicker.svelte";

const parts: PartId[] = ["section:library", "section:security", "config:logo"];

const box = (id: string): ReturnType<typeof page.getByTestId> => page.getByTestId(`part-${id}`);

describe("PartsPicker.svelte, the accounts part of an import", () => {
	it("asks before the accounts are ticked, and keeps the tick only when confirmed", async () => {
		await render(PartsPicker, {
			props: { parts, selected: ["section:library"], guardAccounts: true },
			context: await testI18nContext(),
		});
		await expect.element(box("section:security")).not.toBeChecked();

		await box("section:security").click();
		await expect.element(page.getByTestId("confirm-dialog")).toBeVisible();
		await expect
			.element(page.getByText("sostituiscono quelli attuali", { exact: false }))
			.toBeVisible();
		await expect.element(box("section:security")).not.toBeChecked();
		await page.getByRole("button", { name: "Annulla" }).click();
		await expect.element(page.getByTestId("confirm-dialog")).not.toBeInTheDocument();
		await expect.element(box("section:security")).not.toBeChecked();

		await box("section:security").click();
		await page.getByTestId("confirm-button").click();
		await expect.element(page.getByTestId("confirm-dialog")).not.toBeInTheDocument();
		await expect.element(box("section:security")).toBeChecked();
	});

	it("also asks when the whole group is ticked, never when it is unticked", async () => {
		await render(PartsPicker, {
			props: {
				parts,
				selected: ["section:library", "section:security"],
				guardAccounts: true,
			},
			context: await testI18nContext(),
		});
		await page.getByTestId("parts-settings-none").click();
		await expect.element(page.getByTestId("confirm-dialog")).not.toBeInTheDocument();
		await expect.element(box("section:security")).not.toBeChecked();
		await page.getByTestId("parts-settings-all").click();
		await expect.element(page.getByTestId("confirm-dialog")).toBeVisible();
		await expect.element(box("section:library")).not.toBeChecked();
	});

	it("does not ask where the accounts are not guarded (the export)", async () => {
		await render(PartsPicker, {
			props: { parts, selected: [] },
			context: await testI18nContext(),
		});
		await box("section:security").click();
		await expect.element(page.getByTestId("confirm-dialog")).not.toBeInTheDocument();
		await expect.element(box("section:security")).toBeChecked();
	});
});
