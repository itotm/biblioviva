// SPDX-License-Identifier: GPL-3.0-or-later
// Template designer (steps 11.10, 11.16): a copy of the built-in card opens in the drawing — its
// faces named Fronte and Retro, the barcode moved with the keyboard and the mouse onto a line of the
// grid of 2 mm, a shipped background and an uploaded picture put on the back and then taken away
// (step 11.17), the library name made bold, a field added —, the
// drawing is seen as code, changed in the code and seen changed in the drawing, saved and reopened;
// a copy of the pair labels keeps its compact variant when its flow layout is fixed by a move; the
// code of a slip is edited, a broken draft refused with its problem. The configuration is shared:
// only the desktop project changes it, on copies no other spec uses.
import { expect, test, type Page } from "@playwright/test";
import { expectAxeClean } from "./helpers/axe.js";
import { waitForHydration } from "./helpers/hydration.js";

async function open(page: Page, path: string): Promise<void> {
	await page.goto(path);
	await waitForHydration(page);
}

/** A copy of a built-in template, opened in the editor. */
async function duplicate(page: Page, kind: string, from: string, name: string): Promise<void> {
	await open(page, "/admin/config/templates");
	await page.getByTestId(`templates-tab-${kind}`).click();
	await page.getByTestId(`template-${kind}-${from}`).getByTestId("template-duplicate").click();
	await page.getByTestId("template-name").fill(name);
	await page.getByTestId("confirm-dialog").getByTestId("confirm-button").click();
	await page.getByTestId(`template-${kind}-${name}`).getByTestId("template-edit").click();
	await waitForHydration(page);
}

async function remove(page: Page, kind: string, name: string): Promise<void> {
	await open(page, "/admin/config/templates");
	await page.getByTestId(`templates-tab-${kind}`).click();
	await page.getByTestId(`template-${kind}-${name}`).getByTestId("template-delete").click();
	await page.getByTestId("confirm-dialog").getByTestId("confirm-button").click();
	await expect(page.getByTestId(`template-${kind}-${name}`)).toHaveCount(0);
}

test.describe.serial("template designer", () => {
	test("the code of a template, previewed as printed", async ({ page }) => {
		await open(page, "/admin/config/templates/slips/overdue-by-class");
		await expect(page.getByTestId("designer-tab-design")).toHaveCount(0);
		await expect(page.getByTestId("designer-code")).toHaveValue(/<section class="group">/);
		const preview = page.getByTestId("designer-preview");
		await expect(preview.contentFrame().getByText("Pinocchio")).toBeVisible();
		await expectAxeClean(page);
		// a field the slips do not know: the preview explains, nothing can be saved
		const code = page.getByTestId("designer-code");
		await code.fill(`${await code.inputValue()}\n{{patron.secret}}`);
		await expect(page.getByTestId("designer-problems")).toContainText("patron.secret");
		await expect(page.getByTestId("designer-save")).toBeDisabled();
	});

	test("the card drawn, seen as code, changed in the code, drawn again, saved and reopened", async ({
		page,
		isMobile,
	}) => {
		test.skip(isMobile, "the configuration is shared: one project changes it");
		await duplicate(page, "cards", "default", "e2e-disegno");
		await expect(page).toHaveURL(/\/admin\/config\/templates\/cards\/e2e-disegno$/);
		await expect(page.getByTestId("designer-tab-design")).toHaveAttribute(
			"aria-pressed",
			"true",
		);
		await expect(page.getByTestId("designer-element")).toHaveCount(7);
		await expect(page.getByTestId("designer-face-front.html")).toHaveText("Fronte");
		await expect(page.getByTestId("designer-face-back.html")).toHaveText("Retro");
		await expectAxeClean(page);

		// the barcode: down with the keyboard, right with the mouse
		const barcode = page.locator('[data-testid="designer-element"][data-id="e6"]');
		await barcode.focus();
		// Shift: about 5 mm, a whole number of steps of the grid (3 × 2 mm)
		await barcode.press("Shift+ArrowDown");
		await expect(page.getByTestId("designer-y")).toHaveValue("44");
		await barcode.scrollIntoViewIfNeeded();
		const box = await barcode.boundingBox();
		if (!box) {
			throw new Error("no barcode box");
		}
		await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
		await page.mouse.down();
		await page.mouse.move(box.x + box.width / 2 - 76, box.y + box.height / 2, { steps: 5 });
		await page.mouse.up();
		await expect(page.getByTestId("designer-grid-step")).toHaveValue("2");
		await expect(page.getByTestId("designer-x")).toHaveValue("0");
		await expect(page.getByTestId("designer-y")).toHaveValue("44");
		// the grid drawn is the grid the moves land on: a line every 2 mm, one at the barcode's edges
		const grid = page.getByTestId("designer-grid");
		await expect(grid.locator("line[data-axis=x]")).toHaveCount(43);
		const lines = await grid
			.locator("line[data-axis=x]")
			.evaluateAll((ls) => ls.map((l) => l.getBoundingClientRect().left + 0.5));
		const edge = (await barcode.boundingBox())?.x ?? 0;
		expect(Math.min(...lines.map((x) => Math.abs(x - edge)))).toBeLessThan(0.75);
		await expect(
			page
				.getByTestId("designer-canvas")
				.locator("iframe")
				.contentFrame()
				.locator(".bv-barcode svg"),
		).toBeVisible();

		// the back shows its picture as the face's own; another shipped background from the gallery
		// (the face's orientation only), a picture of one's own, and none with "Nessuna"
		await page.getByTestId("designer-face-back.html").click();
		const picture = page.getByTestId("designer-background-image");
		await expect(picture).toHaveValue("background-d4.webp");
		const face = page
			.getByTestId("designer-canvas")
			.locator("iframe")
			.contentFrame()
			.locator(".face");
		await page.getByTestId("designer-pick-background").click();
		const gallery = page.getByTestId("background-picker");
		await expect(gallery.getByTestId("background-c8")).toBeVisible();
		await expect(gallery.getByTestId("background-h5")).toHaveCount(0);
		await expectAxeClean(page);
		await gallery.getByTestId("background-c8").click();
		await expect(gallery).toHaveCount(0);
		await expect(picture).toHaveValue("background-c8.webp");
		await expect
			.poll(() => face.evaluate((el) => getComputedStyle(el).backgroundSize))
			.toMatch(/^calc\(100% \+ [\d.]+px\) calc\(100% \+ [\d.]+px\)$/);
		await page
			.getByTestId("designer-upload-background")
			.setInputFiles("tests/fixtures/images/landscape.jpg");
		await expect(picture).toHaveValue("landscape.jpg");
		await expect
			.poll(() => face.evaluate((el) => getComputedStyle(el).backgroundSize))
			.toBe("cover");
		await picture.selectOption({ label: "Nessuna" });
		await expect
			.poll(() =>
				page
					.getByTestId("designer-canvas")
					.locator("iframe")
					.contentFrame()
					.locator(".face")
					.evaluate((el) => getComputedStyle(el).backgroundImage),
			)
			.toBe("none");
		await page.getByTestId("designer-face-front.html").click();

		// the library name in bold, and a new field
		await page.locator('[data-testid="designer-element"][data-id="e2"]').click();
		await expect(page.getByTestId("designer-field")).toHaveValue("library.name");
		await page.getByTestId("designer-bold").check();
		await page.getByTestId("designer-add-field").click();
		await page.getByTestId("designer-field").selectOption("patron.class_label");
		await expect(page.getByTestId("designer-element")).toHaveCount(8);

		// the same draft as code: change the barcode's place there, see it in the drawing
		await page.getByTestId("designer-tab-code").click();
		await page.getByTestId("designer-file-front.html").click();
		const code = page.getByTestId("designer-code");
		await expect(code).toHaveValue(/left:0mm;top:44mm;width:70mm;height:8mm/);
		await expect(code).toHaveValue(/font-weight:700">\{\{library\.name\}\}/);
		await expect(code).toHaveValue(/\{\{patron\.class_label\}\}/);
		await page.getByTestId("designer-file-back.html").click();
		await expect(code).toHaveValue(/background-image:none/);
		await page.getByTestId("designer-file-front.html").click();
		await code.fill(
			(await code.inputValue()).replace("left:0mm;top:44mm", "left:6mm;top:44mm"),
		);
		await page.getByTestId("designer-tab-design").click();
		await page.locator('[data-testid="designer-element"][data-id="e6"]').focus();
		await expect(page.getByTestId("designer-x")).toHaveValue("6");

		await Promise.all([
			page.waitForResponse((r) => r.url().includes("saveTemplateDraft")),
			page.getByTestId("designer-save").click(),
		]);
		await expect(page.getByRole("status").getByText("Template salvato")).toBeVisible();
		await expect(page.getByTestId("designer-save")).toBeDisabled();
		await open(page, "/admin/config/templates/cards/e2e-disegno");
		await expect(page.getByTestId("designer-element")).toHaveCount(8);
		await page.locator('[data-testid="designer-element"][data-id="e6"]').focus();
		await expect(page.getByTestId("designer-x")).toHaveValue("6");

		await remove(page, "cards", "e2e-disegno");
	});

	test("the size of a card: its own, turned, and the configuration's again (step 11.17)", async ({
		page,
		isMobile,
	}) => {
		test.skip(isMobile, "the configuration is shared: one project changes it");
		await duplicate(page, "cards", "default", "e2e-formato");
		const width = page.getByTestId("designer-card-width");
		await expect(width).toHaveValue("85.6");
		await expect(page.getByTestId("designer-card-height")).toHaveValue("53.98");
		await expect(page.getByTestId("designer-card-default")).toHaveCount(0);
		const canvas = page.getByTestId("designer-canvas");
		const before = await canvas.boundingBox();
		await page.getByTestId("designer-card-rotate").click();
		await expect(width).toHaveValue("53.98");
		await expect(page.getByTestId("designer-card-height")).toHaveValue("85.6");
		await expect
			.poll(async () => (await canvas.boundingBox())?.height ?? 0)
			.toBeGreaterThan((before?.height ?? 0) * 1.4);
		// written in template.json, the rest of the file as it was
		await page.getByTestId("designer-tab-code").click();
		await page.getByTestId("designer-file-template.json").click();
		const code = page.getByTestId("designer-code");
		await expect(code).toHaveValue(/"cardMm": \{ "width": 53\.98, "height": 85\.6 \}/);
		await expect(code).toHaveValue(/"patronTypes": \[\s*"student",\s*"teacher"\s*\]/);
		await page.getByTestId("designer-tab-design").click();
		await page.getByTestId("designer-card-default").click();
		await expect(width).toHaveValue("85.6");
		await page.getByTestId("designer-tab-code").click();
		await page.getByTestId("designer-file-template.json").click();
		await expect(code).not.toHaveValue(/cardMm/);
		await remove(page, "cards", "e2e-formato");
	});

	test("the flow layout of a label fixed by a move, its compact variant kept", async ({
		page,
		isMobile,
	}) => {
		test.skip(isMobile, "the configuration is shared: one project changes it");
		await duplicate(page, "labels", "pair-default", "e2e-coppia");
		await page.getByTestId("designer-face-top-compact.html").click();
		// measured in the preview: drawn with a dotted outline until the first move
		const first = page.locator('[data-testid="designer-element"][data-id="e10"]');
		await expect(page.getByTestId("designer-flow")).toBeVisible();
		await expect(first).toHaveAttribute("data-placed", "false");
		await first.focus();
		await first.press("ArrowDown");
		await expect(page.getByTestId("designer-flow")).toHaveCount(0);
		await expect(first).toHaveAttribute("data-placed", "true");
		// a coarser grid: the arrows move by one step and the place lands on it
		await expect(page.getByTestId("designer-grid")).toBeVisible();
		await page.getByTestId("designer-grid-step").selectOption("2");
		await first.focus();
		await first.press("ArrowRight");
		await expect(page.getByTestId("designer-x")).toHaveValue(/^\d*[02468]$/);
		await page.getByTestId("designer-grid-step").selectOption("0");
		await expect(page.getByTestId("designer-grid")).toHaveCount(0);
		await Promise.all([
			page.waitForResponse((r) => r.url().includes("saveTemplateDraft")),
			page.getByTestId("designer-save").click(),
		]);
		await expect(page.getByRole("status").getByText("Template salvato")).toBeVisible();

		await page.getByTestId("designer-tab-code").click();
		await page.getByTestId("designer-file-template.json").click();
		await expect(page.getByTestId("designer-code")).toHaveValue(/"compact"/);
		await page.getByTestId("designer-file-top-compact.html").click();
		await expect(page.getByTestId("designer-code")).toHaveValue(
			/class="pictogram" src="\{\{classification\.image_url\}\}" alt="" style="position:absolute;margin:0;box-sizing:border-box;left:/,
		);
		await remove(page, "labels", "e2e-coppia");
	});

	test("a box's border and fill each on a row of its own", async ({ page, isMobile }) => {
		test.skip(isMobile, "the configuration is shared: one project changes it");
		await duplicate(page, "cards", "default", "e2e-riquadro");
		await page.getByTestId("designer-add-box").click();
		const border = page.getByTestId("designer-border-row");
		const fill = page.getByTestId("designer-fill-row");
		const fillBox = page.getByRole("checkbox", { name: "Riempimento" });
		const before = await fillBox.boundingBox();
		// a colour appearing beside the border never moves the fill
		await page.getByRole("checkbox", { name: "Bordo" }).check();
		await expect(border.getByLabel("Colore del bordo")).toBeVisible();
		expect(await fillBox.boundingBox()).toEqual(before);
		await fillBox.check();
		await expect(fill.getByLabel("Colore di riempimento")).toBeVisible();
		const rows = [await border.boundingBox(), await fill.boundingBox()];
		expect((rows[1]?.y ?? 0) >= (rows[0]?.y ?? 0) + (rows[0]?.height ?? 0)).toBe(true);
		await remove(page, "cards", "e2e-riquadro");
	});
});
