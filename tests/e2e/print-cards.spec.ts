// SPDX-License-Identifier: GPL-3.0-or-later
// Card printing (step 2.5): the sheet route, the single-unit route, the buttons on the patron pages
// and visual snapshots of the built-in template (front, back, full sheet) — desktop only, since the
// print output does not depend on the viewport.
import { expect, test } from "@playwright/test";
import { waitForHydration } from "./helpers/hydration.js";
import { seededClassId } from "./helpers/data.js";

test.describe("card printing", () => {
	test("prints a class sheet with four units per page and one unit for a patron", async ({
		page,
		isMobile,
	}) => {
		test.skip(isMobile, "print output does not depend on the viewport");
		// seeded class 2 A → sheet
		const res = await page.request.get(`/print/cards?group=${seededClassId(2, "A")}`);
		expect(res.status()).toBe(200);
		expect(res.headers()["content-type"]).toContain("text/html");
		const count = Number(res.headers()["x-cards-count"]);
		expect(count).toBeGreaterThan(4);
		const html = await res.text();
		expect(html).toContain("@page { size: A4 portrait");
		expect((html.match(/class="unit /g) ?? []).length).toBe(count);
		expect(html).not.toContain("<script");

		// errors: bad parameters, unknown template, print lists not yet available
		expect((await page.request.get("/print/cards?ids=abc")).status()).toBe(400);
		expect(
			(
				await page.request.get(`/print/cards?group=${seededClassId(2, "A")}&template=nope`)
			).status(),
		).toBe(422);
		expect((await page.request.get("/print/cards?list=999999")).status()).toBe(404);

		// the patron page links to the single unit and can mark the card printed
		await page.goto("/patrons");
		await waitForHydration(page);
		await page.getByRole("combobox", { name: "Classe", exact: true }).selectOption("2");
		await page
			.getByRole("combobox", { name: "Sezione", exact: true })
			.selectOption({ label: "Sezione: A" });
		// the print dialog (9.27): side by side by default, or on both sides of the sheet
		await page.getByTestId("print-class-cards").click();
		const dialog = page.getByTestId("card-print-dialog");
		await expect(dialog.getByTestId("card-print")).toHaveAttribute(
			"href",
			`/print/cards?group=${seededClassId(2, "A")}&layout=side-by-side`,
		);
		await expect(dialog.getByTestId("card-print-steps")).toContainText("piegarla a metà");
		await dialog.getByTestId("card-layout-duplex").click();
		await expect(dialog.getByTestId("card-print")).toHaveAttribute(
			"href",
			`/print/cards?group=${seededClassId(2, "A")}&layout=duplex`,
		);
		await expect(dialog.getByTestId("card-print-steps")).toContainText(
			"capovolgendo sul lato lungo",
		);
		// the administrator is offered the calibration
		await expect(dialog.getByTestId("card-print-calibrate")).toBeVisible();
		await dialog.getByTestId("card-print-close").click();
		await page.getByTestId("data-grid").locator(".wx-row").first().click();
		await expect(page).toHaveURL(/\/patrons\/\d+$/);
		await waitForHydration(page);
		await page.getByRole("tab", { name: "Tessera" }).click();
		await page.getByTestId("print-card").click();
		const href = await page
			.getByTestId("card-print-dialog")
			.getByTestId("card-print")
			.getAttribute("href");
		expect(href).toMatch(/^\/print\/cards\?ids=\d+&layout=side-by-side$/);
		await page.getByTestId("card-print-close").click();
		const unit = await page.request.get(href!);
		expect(unit.status()).toBe(200);
		expect(unit.headers()["x-cards-count"]).toBe("1");
		await expect(page.getByTestId("card-print-dialog")).toHaveCount(0);
		await page.getByTestId("mark-card-printed").click();
		await expect(
			page.getByRole("status").getByText("Tessera segnata come stampata"),
		).toBeVisible();
		await expect(page.getByRole("tabpanel", { name: "Tessera" })).toContainText(
			"Tessera stampata il",
		);
	});

	test("the print dialog's choice of layout stays inside the dialog on a phone", async ({
		page,
		isMobile,
	}) => {
		test.skip(!isMobile, "the overflow happens on a phone");
		await page.goto("/patrons/1");
		await waitForHydration(page);
		await page.getByRole("tab", { name: "Tessera" }).click();
		await page.getByTestId("print-card").click();
		const dialog = page.getByTestId("card-print-dialog");
		const box = (await dialog.boundingBox())!;
		for (const choice of ["side-by-side", "duplex"]) {
			const b = (await dialog.getByTestId(`card-layout-${choice}`).boundingBox())!;
			expect(b.x).toBeGreaterThanOrEqual(box.x);
			expect(b.x + b.width).toBeLessThanOrEqual(box.x + box.width);
		}
		await expect(dialog.getByTestId("card-layout-duplex")).toHaveText(
			"Sui due lati del foglio",
		);
	});

	test("the built-in template matches its visual baselines", async ({
		page,
		isMobile,
		browserName,
	}) => {
		test.skip(isMobile, "print output does not depend on the viewport");
		// a fixed synthetic patron of the seed (class 4 C, first by surname; no other spec touches it)
		const res = await page.request.get(`/print/cards?group=${seededClassId(4, "C")}`);
		const html = await res.text();
		const firstId = /data-patron="(\d+)"/.exec(html)?.[1];
		expect(firstId).toBeDefined();
		await page.setViewportSize({ width: 900, height: 700 });
		await page.goto(`/print/cards?ids=${firstId}`);
		await page.evaluate(() => document.fonts.ready);
		const unit = page.locator(".unit").first();
		await expect(unit.locator(".front")).toHaveScreenshot("card-front.png", {
			maxDiffPixelRatio: 0.02,
		});
		await expect(unit.locator(".back")).toHaveScreenshot("card-back.png", {
			maxDiffPixelRatio: 0.02,
		});

		await page.setViewportSize({ width: 900, height: 1300 });
		await page.goto(`/print/cards?group=${seededClassId(4, "C")}`);
		await page.evaluate(() => document.fonts.ready);
		await expect(page).toHaveScreenshot("card-sheet.png", { maxDiffPixelRatio: 0.02 });

		// print-to-PDF: `cards.sheet.rows` (4) units per A4 page, CSS page size honoured (only
		// Chromium makes PDFs; the other engines of `bun run test:browsers` stop here)
		if (browserName !== "chromium") {
			return;
		}
		const units = await page.locator(".unit").count();
		const pdf = await page.pdf({ preferCSSPageSize: true });
		const pages = (pdf.toString("latin1").match(/\/Type\s*\/Page[^s]/g) ?? []).length;
		expect(pages).toBe(Math.ceil(units / 4));
	});

	test("prints on both sides: a page of fronts, a page of backs at the mirrored places (9.27)", async ({
		page,
		isMobile,
		browserName,
	}) => {
		test.skip(isMobile, "print output does not depend on the viewport");
		const res = await page.request.get(
			`/print/cards?group=${seededClassId(4, "C")}&layout=duplex`,
		);
		expect(res.status()).toBe(200);
		const html = await res.text();
		const count = Number(res.headers()["x-cards-count"]);
		expect((html.match(/class="slot front /g) ?? []).length).toBe(count);
		expect((html.match(/class="slot back /g) ?? []).length).toBe(count);
		expect((html.match(/class="page"/g) ?? []).length).toBe(2 * Math.ceil(count / 10));
		expect((await page.request.get("/print/cards?ids=1&layout=sideways")).status()).toBe(400);

		await page.setViewportSize({ width: 900, height: 1300 });
		await page.goto(`/print/cards?group=${seededClassId(4, "C")}&layout=duplex`);
		await page.evaluate(() => document.fonts.ready);
		await expect(page.locator('.page[data-page="1"]')).toHaveScreenshot(
			"card-duplex-front.png",
			{
				maxDiffPixelRatio: 0.02,
			},
		);
		await expect(page.locator('.page[data-page="2"]')).toHaveScreenshot(
			"card-duplex-back.png",
			{
				maxDiffPixelRatio: 0.02,
			},
		);
		// print-to-PDF: fronts and backs alternate, so the page count is even (Chromium only)
		if (browserName !== "chromium") {
			return;
		}
		const pdf = await page.pdf({ preferCSSPageSize: true });
		const pages = (pdf.toString("latin1").match(/\/Type\s*\/Page[^s]/g) ?? []).length;
		expect(pages).toBe(2 * Math.ceil(count / 10));
	});

	test("calibrates the backs: the sample sheet, the values read, the offset saved (9.27)", async ({
		page,
		isMobile,
	}) => {
		test.skip(
			isMobile,
			"an administrator's page; the print output does not depend on the viewport",
		);
		await page.goto("/admin/config/cards");
		await waitForHydration(page);
		await page.getByTestId("card-calibration-open").click();
		await expect(page).toHaveURL(/\/admin\/cards\/calibration$/);
		await waitForHydration(page);
		await expect(page.getByTestId("calibration-current")).toContainText("0 mm in orizzontale");
		await expect(page.getByTestId("calibration-print")).toHaveAttribute(
			"href",
			"/print/cards/calibration",
		);

		// the sample sheet: side 1 with the outline, side 2 with the rulers
		await page.setViewportSize({ width: 900, height: 1300 });
		const sheet = await page.context().newPage();
		await sheet.setViewportSize({ width: 900, height: 1300 });
		await sheet.goto("/print/cards/calibration");
		await sheet.evaluate(() => document.fonts.ready);
		await expect(sheet.locator('.page[data-side="1"]')).toHaveScreenshot(
			"card-calibration-1.png",
			{ maxDiffPixelRatio: 0.02 },
		);
		await expect(sheet.locator('.page[data-side="2"]')).toHaveScreenshot(
			"card-calibration-2.png",
			{ maxDiffPixelRatio: 0.02 },
		);
		await sheet.close();

		// the values read on the rulers are added to the offset in use
		await page.getByTestId("calibration-x").fill("1.5");
		await page.getByTestId("calibration-y").fill("-0.5");
		await expect(page.getByTestId("calibration-next")).toContainText("+1,5 mm");
		await page.getByTestId("calibration-save").click();
		await expect(page.getByRole("status").getByText("Calibrazione salvata")).toBeVisible();
		await expect(page.getByTestId("calibration-current")).toContainText("+1,5 mm");
		const moved = await (await page.request.get("/print/cards/calibration")).text();
		expect(moved).toContain('class="card back" style="left: 31.5mm; top: 98mm;"');
		// back to no offset, for the other specs
		await page.getByTestId("calibration-x").fill("-1.5");
		await page.getByTestId("calibration-y").fill("0.5");
		await page.getByTestId("calibration-save").click();
		await expect(page.getByTestId("calibration-current")).toContainText("0 mm in orizzontale");
	});
});
