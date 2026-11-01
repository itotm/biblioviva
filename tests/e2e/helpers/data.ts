// SPDX-License-Identifier: GPL-3.0-or-later
// Test data created through the UI, for specs that need their own patrons and copies (the seed
// is shared by every spec and project, so a desk test must not depend on its loans).
import { expect, type Page } from "@playwright/test";
import { pageAction } from "./actions.js";
import { waitForHydration } from "./hydration.js";

/**
 * The formats of the e2e configuration (tests/fixtures/e2e/config.json, PLAN.md Phase 12): new
 * copies `YYYY-CNNNN` and cards `CNNNNNN` with the mod-23 check letter.
 */
export const ITEM_CODE = /\d{4}-[A-Z]\d{4}/;
export const CARD_CODE = /[A-Z]\d{6}/;

/** The same copy barcode with a wrong check letter (the fifth character after the dash). */
export function withWrongCheck(code: string): string {
	const letter = code.charAt(5) === "A" ? "B" : "A";
	return `${code.slice(0, 5)}${letter}${code.slice(6)}`;
}

/**
 * The id of a class of the seed (`scripts/seed.ts`: years 1–5 × sections A–D, made in that order,
 * then the teachers group): the seed is deterministic, so `2 A` is always the same group.
 */
export function seededClassId(level: number, section: "A" | "B" | "C" | "D"): number {
	return (level - 1) * 4 + "ABCD".indexOf(section) + 1;
}

export interface CreatedPatron {
	id: number;
	card: string;
	name: string;
}

/** A student (class 4 B unless given) or a teacher; returns the id and the card number. */
export async function createPatron(
	page: Page,
	lastName: string,
	type: "student" | "teacher" = "student",
	cls: [string, string] = ["4", "B"],
): Promise<CreatedPatron> {
	await page.goto("/patrons/new");
	await waitForHydration(page);
	if (type === "teacher") {
		await page.getByRole("radio", { name: "Docente" }).check();
	}
	await page.getByLabel("Cognome", { exact: true }).fill(lastName);
	await page.getByLabel("Nome", { exact: true }).fill("Anna");
	if (type === "student") {
		await page.getByRole("combobox", { name: "Classe", exact: true }).selectOption(cls[0]);
		await page.getByRole("combobox", { name: "Sezione", exact: true }).selectOption(cls[1]);
	}
	await page.getByTestId("patron-submit").click();
	await expect(page).toHaveURL(/\/patrons\/\d+$/);
	await waitForHydration(page);
	const card = CARD_CODE.exec(await page.getByTestId("patron-card").innerText())?.[0] ?? "";
	return { id: Number(page.url().split("/").pop()), card, name: `Anna ${lastName}` };
}

export interface CreatedBook {
	id: number;
	barcodes: string[];
	url: string;
}

/**
 * A fiction record (genre B) with `copies` copies of an item type; returns their barcodes. With
 * `later` the record is saved without classification ("Classifica dopo", step 9.21).
 */
export async function createBook(
	page: Page,
	title: string,
	copies: number,
	itemType = "libro",
	later = false,
): Promise<CreatedBook> {
	await page.goto("/catalog/new");
	await waitForHydration(page);
	await page.getByLabel("Titolo", { exact: true }).fill(title);
	await page.getByLabel("Autore", { exact: true }).fill("Prova, Anna");
	await page.getByTestId("quick-publisher").click();
	await page.getByTestId(later ? "kind-later" : "genre-B").click();
	await page.getByTestId("biblio-submit").click();
	await expect(page).toHaveURL(/\/catalog\/\d+$/);
	await waitForHydration(page);
	await (await pageAction(page, "add-copies")).click();
	await page.getByTestId("add-copies-count").fill(String(copies));
	await page.getByTestId("add-type").selectOption(itemType);
	await page.getByTestId("confirm-button").click();
	const rows = page.getByTestId("items-table").locator("tbody tr");
	await expect(rows).toHaveCount(copies);
	const barcodes: string[] = [];
	for (let i = 0; i < copies; i++) {
		barcodes.push((await rows.nth(i).locator("td").first().innerText()).trim());
	}
	return { id: Number(page.url().split("/").pop()), barcodes, url: page.url() };
}

/** A day relative to today (`YYYY-MM-DD`), for loans with dates in the past. */
export function dayFromToday(days: number): string {
	const d = new Date();
	d.setDate(d.getDate() + days);
	return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

/** Open loans with their own dates, through the loans import (card, copy, lent on, due). */
export async function importLoans(
	page: Page,
	rows: [string, string, string, string][],
): Promise<void> {
	await page.goto("/admin/imports/loans");
	await waitForHydration(page);
	const body = ["card_number;barcode;issued_on;due_on", ...rows.map((r) => r.join(";"))];
	await page.getByTestId("csv-file").setInputFiles({
		name: "loans.csv",
		mimeType: "text/csv",
		buffer: Buffer.from(body.join("\n"), "utf8"),
	});
	await page.getByTestId("upload-submit").click();
	await page.getByTestId("validate").click();
	await expect(page.getByTestId("preview-verdict")).toContainText("Nessun errore");
	await page.getByTestId("commit").click();
	await expect(page.getByTestId("done-summary")).toContainText(
		`${rows.length} prestiti importati`,
	);
}
