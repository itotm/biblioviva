// SPDX-License-Identifier: GPL-3.0-or-later
// Cover capture with perspective correction (step 3.7): a photo of a book at an angle is
// straightened with OpenCV.js (loaded on demand, never on other pages) and stored as the cover.
import { expect, test, type Page } from "@playwright/test";
import { expectAxeClean } from "./helpers/axe.js";
import { waitForHydration } from "./helpers/hydration.js";

const tagOf = (page: Page): "Mob" | "Desk" => (page.viewportSize()?.width === 412 ? "Mob" : "Desk");
const isOpenCv = (url: string): boolean => /opencv.*\.js$/.test(url);

interface Violation {
	directive: string;
	blocked: string;
	source: string;
}

/** Collects the content security policy violations of every document the page opens. */
async function recordCspViolations(page: Page): Promise<void> {
	await page.addInitScript(() => {
		const w = window as unknown as { __cspViolations: Violation[] };
		w.__cspViolations = [];
		document.addEventListener("securitypolicyviolation", (e) => {
			w.__cspViolations.push({
				directive: e.effectiveDirective,
				blocked: e.blockedURI,
				source: e.sourceFile,
			});
		});
	});
}

/**
 * The violations seen so far, minus the one OpenCV.js causes on purpose: it first fetches the
 * wasm embedded in its own file as a data: URL, which connect-src 'self' blocks, then decodes
 * the base64 itself (ADR-022). Chromium reports the script that loaded OpenCV as the source, not
 * opencv.js, so the source is not checked: no other code of the app fetches data: URLs.
 */
async function unexpectedCspViolations(page: Page): Promise<Violation[]> {
	const all = await page.evaluate(
		() => (window as unknown as { __cspViolations: Violation[] }).__cspViolations,
	);
	return all.filter((v) => !(v.directive === "connect-src" && v.blocked.startsWith("data")));
}

test.describe.serial("cover", () => {
	test("straightens the fixture photo and saves it; OpenCV loads only when asked", async ({
		page,
	}) => {
		const requests: string[] = [];
		page.on("request", (r) => {
			if (isOpenCv(r.url())) {
				requests.push(r.url());
			}
		});
		await recordCspViolations(page);
		// a record of our own (the database is shared by the two projects)
		await page.goto("/catalog/new");
		await waitForHydration(page);
		await page.getByLabel("Titolo", { exact: true }).fill(`Con copertina ${tagOf(page)}`);
		await page.getByTestId("quick-author-Anonimo").click();
		await page.getByTestId("quick-publisher").click();
		await page.getByTestId("genre-A").click();
		await page.getByTestId("biblio-submit").click();
		await expect(page).toHaveURL(/\/catalog\/\d+$/);
		await waitForHydration(page);
		await expect(page.getByTestId("cover-placeholder")).toBeVisible();
		// no ISBN: nothing to download
		await expect(page.getByTestId("cover-download")).toHaveCount(0);
		expect(requests).toEqual([]);

		await page.getByTestId("cover-open").click();
		await expect(page.getByTestId("cover-capture")).toBeVisible();
		expect(requests).toEqual([]);
		await page.getByTestId("cover-file").setInputFiles("tests/fixtures/images/book-angled.jpg");
		await expect(page.getByTestId("cover-stage")).toBeVisible({ timeout: 60_000 });
		expect(requests.length).toBeGreaterThan(0);
		await expect(page.getByTestId("cover-detect-status")).toContainText(
			"Trascinare i quattro angoli",
		);
		// loading and running OpenCV breaks no other rule of the content security policy
		expect(await unexpectedCspViolations(page)).toEqual([]);
		// the detected corners sit near the known ones of the fixture (display coordinates)
		const stage = await page.getByTestId("cover-stage").boundingBox();
		const corner = await page.getByTestId("cover-corner-0").boundingBox();
		expect(stage && corner).toBeTruthy();
		if (stage && corner) {
			const scale = stage.width / 900;
			expect(Math.abs(corner.x + corner.width / 2 - stage.x - 236 * scale)).toBeLessThan(12);
			expect(Math.abs(corner.y + corner.height / 2 - stage.y - 92 * scale)).toBeLessThan(12);
		}
		await expectAxeClean(page);
		// without dragging (WCAG 2.5.7): the arrow keys move a corner, a tap brings the nearest one
		const first = page.getByTestId("cover-corner-0");
		const at = async (): Promise<{ x: number; y: number }> => ({
			x: Number(await first.getAttribute("cx")),
			y: Number(await first.getAttribute("cy")),
		});
		const start = await at();
		await first.focus();
		for (let i = 0; i < 5; i++) {
			await page.keyboard.press("ArrowRight");
		}
		expect((await at()).x).toBeCloseTo(start.x + 10, 5);
		await page.getByTestId("cover-stage").click({ position: { x: start.x - 20, y: start.y } });
		// the click lands on a whole pixel
		expect(Math.abs((await at()).x - (start.x - 20))).toBeLessThan(1.5);
		expect(Math.abs((await at()).y - start.y)).toBeLessThan(1.5);

		await page.getByTestId("cover-straighten").click();
		await expect(page.getByTestId("cover-result")).toBeVisible();
		const size = await page
			.getByTestId("cover-result")
			.evaluate((c: HTMLCanvasElement) => ({ w: c.width, h: c.height }));
		expect(size.w).toBe(600);
		expect(size.h).toBeGreaterThan(600);
		await page.getByTestId("cover-use").click();
		await expect(page.getByRole("status").getByText("Copertina salvata")).toBeVisible();
		await expect(page.getByTestId("cover-image")).toBeVisible();
		const status = await page.evaluate(async () => {
			const img = document.querySelector<HTMLImageElement>('[data-testid="cover-image"]');
			const r = await fetch(img?.src ?? "");
			return { status: r.status, type: r.headers.get("content-type") };
		});
		expect(status).toEqual({ status: 200, type: "image/webp" });
		await expectAxeClean(page);

		// remove it
		await page.getByTestId("cover-delete").click();
		await page.getByTestId("confirm-button").click();
		await expect(page.getByRole("status").getByText("Copertina rimossa")).toBeVisible();
		await expect(page.getByTestId("cover-placeholder")).toBeVisible();
	});

	test("fast add: the cover is found while the form is shown and saved with the record", async ({
		page,
	}) => {
		const mobile = tagOf(page) === "Mob";
		await page.goto("/cataloging/new");
		await waitForHydration(page);
		const input = page.getByLabel("ISBN o EAN");
		await input.fill(mobile ? "9788806049980" : "9788800000000");
		await input.press("Enter");
		// one record: the form opens with it (9.14), and the cover is looked up meanwhile (round 11)
		await expect(page.getByTestId("stage-form")).toBeVisible();
		await expect(page.getByTestId("form-cover-status")).toContainText("Trovata su Mock");
		await expect(page.getByTestId("form-cover-image")).toBeVisible();
		// a wrong cover is replaced by a photo: the camera opens full screen on a phone
		await page.getByTestId("form-cover-photo").click();
		await expect(page.getByTestId("cover-panel")).toBeVisible();
		await expect(page.getByTestId("camera-capture")).toBeVisible();
		if (mobile) {
			await expect(page.getByTestId("cover-panel")).toHaveCSS("position", "fixed");
			const box = await page.getByTestId("camera-capture").boundingBox();
			// the preview takes most of the phone's screen
			expect(box?.height ?? 0).toBeGreaterThan(450);
		}
		await page.getByTestId("cover-panel").getByRole("button", { name: "Annulla" }).click();
		await expect(page.getByTestId("cover-panel")).toHaveCount(0);
		await expect(page.getByTestId("form-cover-image")).toBeVisible();
		if (!mobile) {
			await page.getByTestId("genre-A").click();
		}
		await page.getByTestId("biblio-submit").click();
		await expect(page.getByTestId("stage-done")).toBeVisible();
		await expect(page.getByTestId("done-cover-image")).toBeVisible();
		await expect(page.getByTestId("done-cover-source")).toContainText(
			"Copertina scaricata da Mock",
		);
		// the next book is the first, highlighted choice
		const actions = page.getByTestId("stage-done").getByRole("button");
		await expect(actions.first()).toHaveAttribute("data-testid", "done-another");
		await expect(page.getByTestId("done-another")).toBeFocused();
		await page.getByTestId("done-open").click();
		await expect(page).toHaveURL(/\/catalog\/\d+$/);
		await waitForHydration(page);
		await expect(page.getByTestId("cover-image")).toBeVisible();
		// the record page can download again (replaces the cover) and reports the provider
		await page.getByTestId("cover-download").click();
		await expect(
			page.getByRole("status").getByText("Copertina scaricata da Mock"),
		).toBeVisible();
	});

	test("fast add: without a cover found online, the photo is offered and can be removed", async ({
		page,
	}) => {
		await page.goto("/cataloging/new");
		await waitForHydration(page);
		// the mock has no cover for this ISBN: the form says so and offers the photo first
		const input = page.getByLabel("ISBN o EAN");
		await input.fill("9788800000017");
		await input.press("Enter");
		await page.getByTestId("lookup-manual").click();
		await expect(page.getByTestId("form-cover-status")).toContainText("Nessuna copertina");
		await expect(page.getByTestId("form-cover-photo")).toHaveText("Fotografa la copertina");
		await expect(page.getByTestId("form-cover-remove")).toHaveCount(0);
	});

	test("OpenCV is not loaded on the catalogue or the record page by itself", async ({ page }) => {
		const requests: string[] = [];
		page.on("request", (r) => {
			if (isOpenCv(r.url())) {
				requests.push(r.url());
			}
		});
		await page.goto("/catalog");
		await waitForHydration(page);
		await page.goto("/cataloging/new");
		await waitForHydration(page);
		await page.waitForTimeout(300);
		expect(requests).toEqual([]);
	});
});
