// SPDX-License-Identifier: GPL-3.0-or-later
// Photo census from a class picture (PLAN.md step 13.3): the census offers the classes and lists
// where a photo is missing; a picture of the class's cards is uploaded, its ten photos are found in
// the browser, a frame is removed and drawn again, the photos are assigned with one drop-down each
// (a patron chosen once cannot be chosen again), the drafts survive a reload, and "Salva le foto"
// stores them after a summary that names the photo replaced. Desktop works on the seeded class
// without photos (2 C, `seed-photos.ts`); mobile on a patron list made of class 3 D.
import { readFileSync } from "node:fs";
import { expect, test, type Page } from "@playwright/test";
import { expectAxeClean } from "./helpers/axe.js";
import { waitForHydration } from "./helpers/hydration.js";

const PICTURE = "tests/fixtures/images/class-cards.jpg";
const truth = JSON.parse(readFileSync("tests/fixtures/images/class-cards.frames.json", "utf8")) as {
	width: number;
	height: number;
	frames: { x: number; y: number }[][];
};

/** The numbers of "… N di M con foto". */
async function progressOf(page: Page): Promise<{ done: number; total: number }> {
	const text = await page.getByTestId("sheet-progress").innerText();
	const [, done, total] = /(\d+) di (\d+) con foto/.exec(text) ?? [];
	return { done: Number(done), total: Number(total) };
}

/** The value and text of the options of a frame's drop-down. */
async function optionsOf(
	page: Page,
	position: number,
): Promise<{ value: string; text: string; disabled: boolean }[]> {
	return page
		.getByTestId(`sheet-choose-${position}`)
		.locator("option")
		.evaluateAll((options) =>
			options.map((o) => ({
				value: (o as HTMLOptionElement).value,
				text: o.textContent ?? "",
				disabled: (o as HTMLOptionElement).disabled,
			})),
		);
}

async function uploadPicture(page: Page): Promise<void> {
	await page.getByTestId("sheet-upload").setInputFiles(PICTURE);
	await expect(page).toHaveURL(/\/census\/sheets\/\d+$/, { timeout: 30_000 });
	await waitForHydration(page);
	// OpenCV is loaded once, then the photos are found
	await expect(page.getByTestId("sheet-found")).toContainText("Foto trovate: 10", {
		timeout: 60_000,
	});
	await expect(page.getByTestId("sheet-frames").locator("li")).toHaveCount(10);
}

test.describe("photo census from a class picture", () => {
	test("class 2 C: find, correct, assign and save the photos of the demo picture", async ({
		page,
		isMobile,
		browserName,
	}) => {
		test.skip(isMobile, "the phone works on a list (next test)");
		test.setTimeout(180_000);

		// the census offers the class: someone in it has no photo
		await page.goto("/patrons");
		await waitForHydration(page);
		const tab = page.getByTestId("area-patrons-tab-census");
		await expect(tab).toHaveText("Censimento foto");
		await tab.click();
		await waitForHydration(page);
		await expect(page.getByRole("heading", { level: 1 })).toHaveText("Censimento foto");
		await page.getByTestId("census-group-2C").click();
		await expect(page.getByTestId("class-sheets")).toBeVisible();

		// one pupil gets a photo first, from the camera: the picture will replace it
		await page
			.locator('[data-testid^="census-patron-"][data-has-photo="false"]')
			.first()
			.click();
		const name = (await page.getByTestId("census-current").innerText()).trim();
		await page.getByTestId("photo-snapshot").click();
		await page.getByTestId("photo-use").click();
		await expect(page.getByRole("status").getByText(`Foto salvata: ${name}`)).toBeVisible();
		await page.getByTestId("census-done").click();

		// the picture, with the detection timed on a CPU four times slower (Chromium's protocol;
		// the other engines of `bun run test:browsers` time it at full speed)
		const chromium = browserName === "chromium";
		const cdp = chromium ? await page.context().newCDPSession(page) : null;
		await cdp?.send("Emulation.setCPUThrottlingRate", { rate: 4 });
		await uploadPicture(page);
		const detection = await page.evaluate(
			() => performance.getEntriesByName("frames-detect")[0]?.duration ?? -1,
		);
		await cdp?.send("Emulation.setCPUThrottlingRate", { rate: 1 });
		test.info().annotations.push({
			type: "frames-detect",
			description: `${Math.round(detection)} ms${chromium ? " at 4× CPU throttle" : ` in ${browserName}`}`,
		});
		expect(detection).toBeGreaterThan(0);
		expect(detection).toBeLessThan(4000);
		await expectAxeClean(page);
		const before = await progressOf(page);

		// frame 3 removed and drawn again: it comes back as photo 11
		await page.getByTestId("sheet-edit").click();
		await page.getByTestId("sheet-frame-3").click();
		await page.getByTestId("sheet-delete-frame").click();
		await expect(page.getByTestId("sheet-frames").locator("li")).toHaveCount(9);
		await page.getByTestId("sheet-add-frame").click();
		// the picture's top in view, below the page's own bar
		await page.evaluate(() => window.scrollTo(0, 0));
		const box = await page.getByTestId("sheet-overlay").boundingBox();
		if (!box) {
			throw new Error("no overlay");
		}
		const corners = truth.frames[2] ?? [];
		const toScreen = (p: { x: number; y: number }): { x: number; y: number } => ({
			x: box.x + (p.x / truth.width) * box.width,
			y: box.y + (p.y / truth.height) * box.height,
		});
		const xs = corners.map((p) => p.x);
		const ys = corners.map((p) => p.y);
		const from = toScreen({ x: Math.min(...xs) + 6, y: Math.min(...ys) + 6 });
		const to = toScreen({ x: Math.max(...xs) - 6, y: Math.max(...ys) - 6 });
		await page.mouse.move(from.x, from.y);
		await page.mouse.down();
		await page.mouse.move((from.x + to.x) / 2, (from.y + to.y) / 2);
		await page.mouse.move(to.x, to.y);
		await page.mouse.up();
		await expect(page.getByTestId("sheet-row-11")).toBeVisible();
		await expect(page.getByTestId("sheet-frames").locator("li")).toHaveCount(10);
		await page.getByTestId("sheet-edit").click();

		// eight pupils: seven without a photo and the one photographed above
		const options = (await optionsOf(page, 1)).filter((o) => o.value !== "");
		const withoutPhoto = options.filter((o) => o.text.includes("senza foto")).slice(0, 7);
		const replaced = options.find((o) => o.text.startsWith(name));
		expect(withoutPhoto).toHaveLength(7);
		expect(replaced?.text).toContain("ha già una foto");
		const chosen = [...withoutPhoto, replaced];
		const positions = [1, 2, 4, 5, 6, 7, 8, 11];
		for (const [i, position] of positions.entries()) {
			await page.getByTestId(`sheet-choose-${position}`).selectOption(chosen[i]?.value ?? "");
			await expect(page.getByTestId(`sheet-choose-${position}`)).toHaveValue(
				chosen[i]?.value ?? "",
			);
		}
		// whoever is chosen cannot be chosen for another photo: named with the photo that holds them
		const taken = (await optionsOf(page, 9)).find((o) => o.value === withoutPhoto[0]?.value);
		expect(taken).toMatchObject({ disabled: true });
		expect(taken?.text).toContain("già nella foto 1");
		// frame 10 is nobody of the class
		await page.getByTestId("sheet-ignore-10").click();
		await expect(page.getByTestId("sheet-row-10")).toHaveAttribute("data-state", "ignored");

		// the choices are drafts kept by the server
		await page.reload();
		await waitForHydration(page);
		for (const [i, position] of positions.entries()) {
			await expect(page.getByTestId(`sheet-choose-${position}`)).toHaveValue(
				chosen[i]?.value ?? "",
			);
		}
		// the whole list in one screen: no page bar over it
		await page.setViewportSize({ width: 1280, height: 2000 });
		await page.evaluate(() => window.scrollTo(0, 0));
		await expect(page.getByTestId("sheet-frames")).toHaveScreenshot("sheet-frames.png", {
			maxDiffPixelRatio: 0.02,
		});
		await page.setViewportSize({ width: 1280, height: 800 });

		// the summary names the photo replaced; then everything is saved at once
		await page.getByTestId("sheet-save").click();
		await expect(page.getByTestId("sheet-save-replaces")).toContainText(name);
		await page.getByTestId("confirm-button").click();
		await expect(page.getByRole("status").getByText("Foto salvate: 8.")).toBeVisible();
		for (const position of positions) {
			await expect(page.getByTestId(`sheet-row-${position}`)).toHaveAttribute(
				"data-state",
				"saved",
			);
		}
		const after = await progressOf(page);
		expect(after.done).toBe(before.done + 7);
		await expect(page.getByTestId("sheet-still-missing")).toBeVisible();

		// the photos have the configured size (480 × 640)
		const patronId = Number(withoutPhoto[0]?.value);
		const size = await page.evaluate(async (src) => {
			const img = new Image();
			img.src = src;
			await img.decode();
			return [img.naturalWidth, img.naturalHeight];
		}, `/media/patrons/${patronId}/main?v=1`);
		expect(size).toEqual([480, 640]);

		const sheetUrl = page.url();

		// back on the class: the picture is listed with its counts
		await page.getByTestId("page-back").click();
		await waitForHydration(page);
		await expect(page.getByTestId("class-sheets-list")).toContainText("8 salvate");

		// "Elimina immagine": the picture, its frames and drop-downs leave the page, the photos
		// saved stay with the patrons; from the class to the picture and back with no reload
		await page.locator('[data-testid^="class-sheet-"]').first().click();
		await expect(page).toHaveURL(sheetUrl);

		// a scan: the open frames become turned rectangles, the saved ones stay; the handle above
		// a frame turns it, and the kind stays with the picture
		const pointsOf = async (position: number): Promise<{ x: number; y: number }[]> =>
			((await page.getByTestId(`sheet-frame-${position}`).getAttribute("points")) ?? "")
				.split(" ")
				.map((pair) => {
					const [x = 0, y = 0] = pair.split(",").map(Number);
					return { x, y };
				});
		const rightAngled = (q: { x: number; y: number }[]): boolean => {
			const [a, b, , d] = q;
			if (!a || !b || !d) {
				return false;
			}
			const top = { x: b.x - a.x, y: b.y - a.y };
			const left = { x: d.x - a.x, y: d.y - a.y };
			const cos =
				(top.x * left.x + top.y * left.y) /
				(Math.hypot(top.x, top.y) * Math.hypot(left.x, left.y));
			return Math.abs(cos) < 1e-6;
		};
		const saved2 = await pointsOf(2);
		await expect(page.getByTestId("sheet-kind-photo")).toHaveAttribute("aria-checked", "true");
		await page.getByTestId("sheet-kind-scan").click();
		await expect(page.getByTestId("sheet-picture")).toHaveAttribute("data-kind", "scan");
		await expect.poll(async () => rightAngled(await pointsOf(9))).toBe(true);
		expect(await pointsOf(2)).toEqual(saved2);
		await page.getByTestId("sheet-edit").click();
		await page.getByTestId("sheet-frame-9").click();
		const unturned = await pointsOf(9);
		const knob = await page.getByTestId("sheet-rotate").boundingBox();
		if (!knob) {
			throw new Error("no rotation handle");
		}
		const start = { x: knob.x + knob.width / 2, y: knob.y + knob.height / 2 };
		await page.mouse.move(start.x, start.y);
		await page.mouse.down();
		await page.mouse.move(start.x + 20, start.y, { steps: 4 });
		await page.mouse.move(start.x + 40, start.y + 5, { steps: 4 });
		await page.mouse.up();
		await expect.poll(async () => (await pointsOf(9))[0]?.x).not.toBe(unturned[0]?.x);
		expect(rightAngled(await pointsOf(9))).toBe(true);
		await page.getByTestId("sheet-edit").click();
		await page.reload();
		await waitForHydration(page);
		await expect(page.getByTestId("sheet-picture")).toHaveAttribute("data-kind", "scan");
		await page.getByTestId("sheet-kind-photo").click();
		await expect(page.getByTestId("sheet-picture")).toHaveAttribute("data-kind", "photo");
		await page.getByTestId("page-back").click();
		await waitForHydration(page);
		await page.locator('[data-testid^="class-sheet-"]').first().click();
		await expect(page).toHaveURL(sheetUrl);

		await page.getByTestId("sheet-delete").click();
		await page.getByTestId("confirm-button").click();
		await expect(page.getByRole("status").getByText("Immagine eliminata.")).toBeVisible();
		await expect(page).toHaveURL(/\/census\?group=\d+$/);
		await expect(page.getByTestId("sheet-frames")).toHaveCount(0);
		await expect(page.getByTestId("sheet-picture")).toHaveCount(0);
		await expect(page.getByTestId("class-sheets-empty")).toBeVisible();
		await page.goto(sheetUrl);
		await expect(page.getByTestId("sheet-frames")).toHaveCount(0);
		await expect(page.getByTestId("sheet-choose-2")).toHaveCount(0);
		const kept = await page.request.get(
			`/media/patrons/${String(withoutPhoto[1]?.value)}/main`,
		);
		expect(kept.headers()["content-type"]).not.toContain("svg");
	});

	test("a patron list: from the census to the saved photos on a phone", async ({
		page,
		isMobile,
	}) => {
		test.skip(!isMobile, "the desktop works on a class (previous test)");
		test.setTimeout(180_000);
		// a list of the pupils of 3 D (no other spec uses that class)
		await page.goto("/print-lists");
		await waitForHydration(page);
		await page.getByTestId("new-patron-list").click();
		await page.getByTestId("new-list-name").fill("Foto da immagine Mob");
		await page.getByTestId("confirm-button").click();
		await expect(page).toHaveURL(/\/print-lists\/\d+$/);
		const listId = Number(page.url().split("/").pop());
		await waitForHydration(page);
		await page.getByTestId("quick-level").selectOption("3");
		await page.getByTestId("quick-class").selectOption("D");
		await page.getByTestId("quick-add").click();
		await expect(page.getByRole("status").getByText(/aggiunti/)).toBeVisible();

		// the census offers the list, someone in it has no photo
		await page.goto("/census");
		await waitForHydration(page);
		await page.getByTestId(`census-list-${listId}`).click();
		await expect(page.getByTestId("census-class")).toHaveText("Foto da immagine Mob");
		await uploadPicture(page);
		await expectAxeClean(page);
		// the title beside the back button: on a line of its own, never broken inside a word
		const split = await page.getByTestId("page-title").evaluate((h1) => {
			const words: string[] = [];
			const walker = document.createTreeWalker(h1, NodeFilter.SHOW_TEXT);
			for (let node = walker.nextNode(); node; node = walker.nextNode()) {
				const text = node.textContent ?? "";
				for (const m of text.matchAll(/\S+/g)) {
					const range = document.createRange();
					range.setStart(node, m.index);
					range.setEnd(node, m.index + m[0].length);
					const lines = new Set(
						[...range.getClientRects()].map((r) => Math.round(r.top)),
					);
					if (lines.size > 1) {
						words.push(m[0]);
					}
				}
			}
			return words;
		});
		expect(split).toEqual([]);

		// on a phone too the picture with its frames shows, above the drop-downs; the choice of
		// kind and the corrections in one toolbar inside the page, the sheet's removal at the top
		const picture = (await page.getByTestId("sheet-picture").boundingBox())!;
		const firstChoice = (await page.getByTestId("sheet-choose-1").boundingBox())!;
		expect(picture.y + picture.height).toBeLessThanOrEqual(firstChoice.y);
		const toolbar = (await page.getByTestId("sheet-toolbar").boundingBox())!;
		for (const id of ["sheet-kind-photo", "sheet-kind-scan", "sheet-edit"]) {
			const b = (await page.getByTestId(id).boundingBox())!;
			expect(b.x + b.width).toBeLessThanOrEqual(toolbar.x + toolbar.width);
		}
		await expect(page.getByTestId("page-actions").getByTestId("sheet-delete")).toBeVisible();
		await page.getByTestId("sheet-edit").click();
		await expect(page.getByTestId("sheet-add-frame")).toBeVisible();
		await page.getByTestId("sheet-edit").click();

		const options = (await optionsOf(page, 1)).filter((o) => o.text.includes("senza foto"));
		for (const [i, position] of [1, 2, 3].entries()) {
			await page
				.getByTestId(`sheet-choose-${position}`)
				.selectOption(options[i]?.value ?? "");
			await expect(page.getByTestId(`sheet-choose-${position}`)).toHaveValue(
				options[i]?.value ?? "",
			);
		}
		await page.getByTestId("sheet-save").click();
		await expect(page.getByTestId("sheet-save-replaces")).toHaveCount(0);
		await page.getByTestId("confirm-button").click();
		await expect(page.getByRole("status").getByText("Foto salvate: 3.")).toBeVisible();
		await expect(page.getByTestId("sheet-row-1")).toHaveAttribute("data-state", "saved");
	});
});
