// SPDX-License-Identifier: GPL-3.0-or-later
// Print templates page (step 2.5b): preview of the built-in card template, patron and zoom switch,
// test page, calibration page, the three shipped cards (step 11.17), and a deliberately broken user template reported without breaking
// the built-in one.
import { mkdirSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { expect, test } from "@playwright/test";
import { expectAxeClean } from "./helpers/axe.js";
import { waitForHydration } from "./helpers/hydration.js";

const PX_PER_MM = 96 / 25.4;
const brokenDir = join(process.env.BV_E2E_RUN_DIR ?? "", "config", "cards", "templates", "rotto");

test.describe.serial("print templates", () => {
	test("previews the default card, switches patron and zoom, opens the test page", async ({
		page,
		context,
	}) => {
		await page.goto("/admin/cards/templates");
		await waitForHydration(page);
		await expect(page.getByRole("heading", { level: 1 })).toHaveText("Template di stampa");
		const card = page.getByTestId("template-cards-default");
		await expect(card).toHaveAttribute("aria-pressed", "true");
		await expect(card.getByTestId("template-status-ok")).toBeVisible();

		const front = page.getByTestId("preview-front");
		await expect(front).toBeVisible();
		const box = await front.boundingBox();
		expect(box?.width).toBeCloseTo(85.6 * PX_PER_MM, 0);
		expect(box?.height).toBeCloseTo(53.98 * PX_PER_MM, 0);
		await expect(front.contentFrame().getByText("Esempio")).toBeVisible();
		await expect(page.getByTestId("preview-back")).toBeVisible();
		await expectAxeClean(page);

		await page.getByTestId("zoom-200").click();
		await expect
			.poll(async () => (await front.boundingBox())?.width ?? 0)
			.toBeGreaterThan(85.6 * PX_PER_MM * 1.9);

		await page.getByTestId("patron-real").click();
		await page.getByTestId("patron-search").fill("ma");
		const result = page.locator('[data-testid^="patron-result-"]').first();
		await expect(result).toBeVisible();
		const name = (await result.locator("span").first().innerText()).replace(/\s+/g, " ").trim();
		await result.click();
		await expect(page.getByTestId("patron-picked")).toContainText(name);
		await expect(front.contentFrame().getByText(name.split(" ")[0]!)).toBeVisible();

		await page.getByTestId("sheet-toggle").click();
		await expect(page.getByTestId("sheet-frame")).toBeVisible();

		const [testPage] = await Promise.all([
			context.waitForEvent("page"),
			page.getByTestId("test-page").click(),
		]);
		await testPage.waitForLoadState();
		await expect(testPage.locator("[data-unit]")).toHaveCount(4);
		await expect(testPage.locator('svg[width="104mm"]')).toHaveCount(1);
		await testPage.close();

		const calibration = await page.request.get("/print/labels/calibration?stock=a4-70x48");
		expect(calibration.status()).toBe(200);
		expect((await calibration.text()).match(/class="cell"/g)).toHaveLength(18);
	});

	test("the three shipped cards: written on the back, and portrait (step 11.17)", async ({
		page,
	}) => {
		await page.goto("/admin/cards/templates");
		await waitForHydration(page);
		for (const name of ["default", "fronte-retro", "verticale"]) {
			await expect(
				page.getByTestId(`template-cards-${name}`).getByTestId("template-status-ok"),
			).toBeVisible();
		}
		await page.getByTestId("template-cards-fronte-retro").click();
		await expect(
			page.getByTestId("preview-back").contentFrame().getByText("Tessera della biblioteca"),
		).toBeVisible();
		await page.getByTestId("template-cards-verticale").click();
		const front = page.getByTestId("preview-front");
		await expect
			.poll(async () => Math.round((await front.boundingBox())?.width ?? 0))
			.toBe(Math.round(53.98 * PX_PER_MM));
		expect((await front.boundingBox())?.height).toBeCloseTo(85.6 * PX_PER_MM, 0);
		await expect(front.contentFrame().getByText("Esempio")).toBeVisible();
		await expectAxeClean(page);
	});

	test("reports a broken user template while the built-in one still renders", async ({
		page,
	}) => {
		mkdirSync(brokenDir, { recursive: true });
		writeFileSync(join(brokenDir, "template.json"), '{ "name": "rotto", oops');
		try {
			await page.goto("/admin/cards/templates");
			await waitForHydration(page);
			const broken = page.getByTestId("template-cards-rotto");
			await expect(broken.getByTestId("template-status-error")).toBeVisible();
			await expect(broken.getByTestId("template-error")).toContainText("template.json");
			await expect(page.getByTestId("preview-front")).toBeVisible();

			await broken.click();
			await expect(page.getByRole("alert")).toContainText("non può essere usato");
			await expect(page.getByTestId("preview-front")).toHaveCount(0);

			rmSync(brokenDir, { recursive: true, force: true });
			await page.getByTestId("reload-templates").click();
			await expect(page.getByTestId("template-cards-rotto")).toHaveCount(0);
			await expect(page.getByTestId("preview-front")).toBeVisible();
		} finally {
			rmSync(brokenDir, { recursive: true, force: true });
		}
	});

	test("the labels tab lists the stocks and links the calibration page", async ({ page }) => {
		await page.goto("/admin/cards/templates");
		await waitForHydration(page);
		await page.getByRole("tab", { name: "Etichette" }).click();
		await expect(page.getByTestId("stock-select")).toBeVisible();
		await page.getByTestId("stock-select").selectOption("a4-70x24");
		await expect(page.getByTestId("calibration-link")).toHaveAttribute(
			"href",
			"/print/labels/calibration?stock=a4-70x24",
		);
		await expectAxeClean(page);
	});
});
