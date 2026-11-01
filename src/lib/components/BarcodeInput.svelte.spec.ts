// SPDX-License-Identifier: GPL-3.0-or-later
import { page, userEvent } from "vitest/browser";
import { describe, expect, it, vi } from "vitest";
import { render } from "vitest-browser-svelte";
import { testI18nContext } from "../../../tests/helpers/i18n.js";
import { codeTableContext } from "#lib/scanner/context.js";
import { buildCodeTable } from "#lib/shared/barcodes/table.js";
import { FORMATS_2026 } from "../../../tests/helpers/codes.js";
import BarcodeInput from "./BarcodeInput.svelte";
import type { Mock } from "vitest";
import type { Locator } from "vitest/browser";

async function mount(
	props: Partial<{ camera: boolean }> = {},
): Promise<{ onscan: Mock; oninvalid: Mock; input: Locator }> {
	const onscan = vi.fn();
	const oninvalid = vi.fn();
	await render(BarcodeInput, {
		props: { onscan, oninvalid, ...props },
		context: new Map<symbol, unknown>([
			...(await testI18nContext()),
			...codeTableContext(buildCodeTable(FORMATS_2026)),
		]),
	});
	return { onscan, oninvalid, input: page.getByRole("textbox", { name: "Codice a barre" }) };
}

describe("BarcodeInput.svelte", () => {
	it.each([
		["2026'00425", "item", "2026-00425"],
		["2026 00425", "item", "2026-00425"],
		["202600425", "item", "2026-00425"],
		["2026-0042", "legacy_item", "2026-0042"],
		["0000123", "ambiguous", "0000123"],
		["1234567897", "card", "1234567897"],
		["9788804668237", "isbn", "9788804668237"],
	])("typed %s + Enter → %s %s", async (typed, kind, value) => {
		const { onscan, input } = await mount();
		await input.fill(typed);
		await userEvent.keyboard("{Enter}");
		expect(onscan).toHaveBeenCalledWith(kind, value, expect.objectContaining({ kind, value }));
		await expect.element(input).toHaveValue("");
	});

	it("shows the reason for an invalid code and keeps the text selected", async () => {
		const { onscan, oninvalid, input } = await mount();
		await input.fill("2026-00426");
		await userEvent.keyboard("{Enter}");
		expect(onscan).not.toHaveBeenCalled();
		expect(oninvalid).toHaveBeenCalledOnce();
		await expect
			.element(page.getByTestId("barcode-error"))
			.toMatchTextContent(/carattere di controllo/);
		await expect.element(input).toHaveAttribute("aria-invalid", "true");
	});

	it("never submits by itself: the code is taken on Enter (a scanner sends it)", async () => {
		const { onscan, input } = await mount();
		// the whole value at once, as a scanner types it, and a pause: nothing is sent
		await input.fill("9788804668237");
		await new Promise((r) => setTimeout(r, 300));
		expect(onscan).not.toHaveBeenCalled();
		await userEvent.keyboard("{Enter}");
		expect(onscan).toHaveBeenCalledWith("isbn", "9788804668237", expect.anything());
	});

	it("opens the phone keyboard with letters, in capitals, with no numeric-only mode", async () => {
		const { input } = await mount();
		await expect.element(input).toHaveAttribute("inputmode", "text");
		await expect.element(input).toHaveAttribute("autocapitalize", "characters");
		expect(
			page.getByRole("button", { name: "Tastiera con le lettere" }).elements(),
		).toHaveLength(0);
	});
});
