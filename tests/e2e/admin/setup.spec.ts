// SPDX-License-Identifier: GPL-3.0-or-later
// The installation check (step 8.7, `/admin/setup`): the five checks with their state, the address
// read from the request (plain HTTP on this computer green, on the local network amber), the test
// pages of the printer, the camera, the scanner test field with the keyboard mishap, and the
// refusal of an account without `admin`. Nothing here changes the shared configuration: the red
// states of the accounts and the dashboard's reminder are in `setup.final.spec.ts`.
import { expect, test, type Page } from "@playwright/test";
import { expectAxeClean } from "../helpers/axe.js";
import { waitForHydration } from "../helpers/hydration.js";
import { LoginPage } from "../pages/login.page.js";

/** A copy of the seed (shelf of the shots): its code, as the scanner of an Italian computer types it. */
const COPY = "2026-V0005";
const TYPED = COPY.replace("-", "'");

/** The server's answer to a request that claims to come from `host` over `proto`. */
async function pageAs(page: Page, host: string, proto: "http" | "https"): Promise<string> {
	const response = await page.request.get("/admin/setup", {
		headers: { host, "x-forwarded-proto": proto },
	});
	expect(response.status()).toBe(200);
	return response.text();
}

/** The state of a card in the HTML the server sent. */
function stateIn(html: string, testid: string): string | undefined {
	return new RegExp(`data-testid="${testid}"[^>]*data-state="(\\w+)"`).exec(html)?.[1];
}

test.describe("installation check", () => {
	test("shows the checks, each with its state, and the tests", async ({ page }) => {
		await page.goto("/admin/setup");
		await waitForHydration(page);
		await expect(page.getByRole("heading", { level: 1 })).toHaveText("Controllo installazione");
		const summary = page.getByTestId("setup-summary");
		await expect(summary).toHaveAttribute("data-state", /^(ok|warning|error)$/);
		await expect(summary).toContainText(/Tutto a posto|da guardare|da correggere/);

		// the five checks, in this order, each with colour, icon and word
		const cards = page.getByTestId("setup-checks").locator("article");
		await expect(cards).toHaveCount(5);
		await expect(
			cards.evaluateAll((els) => els.map((e) => e.getAttribute("data-testid"))),
		).resolves.toEqual([
			"check-config",
			"check-address",
			"check-profile",
			"check-accounts",
			"check-backup",
		]);
		for (const card of await cards.all()) {
			await expect(card.getByTestId("status-badge")).toHaveText(
				/A posto|Da guardare|Da correggere/,
			);
			await expect(card.getByTestId("status-badge").locator("svg")).toBeVisible();
		}
		// plain HTTP on this computer is not red; the fixture's accounts are in clear, which is amber
		await expect(page.getByTestId("check-address")).toHaveAttribute("data-state", "ok");
		await expect(page.getByTestId("finding-address-local")).toContainText(
			"sul computer di BiblioViva",
		);
		await expect(page.getByTestId("check-config")).not.toHaveAttribute("data-state", "error");
		await expect(page.getByTestId("check-profile")).not.toHaveAttribute("data-state", "error");
		await expect(page.getByTestId("check-accounts")).not.toHaveAttribute("data-state", "error");
		// the hint of a stronger host never changes the state of the profile
		await expect(page.getByTestId("finding-profile-ok")).toContainText("Profilo in uso");
		await expectAxeClean(page);
	});

	test("every card that is not green links the guide of the documentation", async ({ page }) => {
		await page.goto("/admin/setup");
		await waitForHydration(page);
		const open = page.locator(
			'[data-testid^="check-"][data-state="warning"], [data-testid^="check-"][data-state="error"]',
		);
		const names = await open.evaluateAll((els) =>
			els.map((e) => e.getAttribute("data-testid")?.replace("check-", "") ?? ""),
		);
		// the fixture's accounts have their passwords in clear: at least that card is amber
		expect(names).toContain("accounts");
		for (const name of names) {
			const links = page.getByTestId(`check-${name}-links`);
			const guide = links.getByTestId(`guide-${name}`);
			await expect(guide).toHaveAttribute("href", /^https:\/\/docs\.biblioviva\.org\/it\//);
			await expect(guide).toHaveAttribute("rel", /external/);
			await expect(guide).toHaveAccessibleName(/^Guida: /);
		}
		// the accounts' fix is the page of the accounts
		await expect(page.getByTestId("fix-accounts-users")).toHaveAttribute(
			"href",
			"/admin/users",
		);
		await page.getByTestId("fix-accounts-users").click();
		await expect(page).toHaveURL(/\/admin\/users$/);
	});

	test("the check again button asks the server again", async ({ page }) => {
		await page.goto("/admin/setup");
		await waitForHydration(page);
		const again = page.waitForRequest((r) => r.url().includes("/admin/setup/__data.json"));
		await page.getByTestId("recheck").click();
		await again;
		await expect(page.getByTestId("recheck")).toBeEnabled();
		await expect(page.getByTestId("setup-summary")).toBeVisible();
	});

	test("reads the address from the request: the local network is amber, HTTPS is green", async ({
		page,
	}) => {
		// the test server runs the basic local-network front too (LAN_PORT), so plain HTTP on a
		// network name is the expected mode: amber, with the camera unavailable
		const lan = await pageAs(page, "biblioviva.local:8080", "http");
		expect(stateIn(lan, "check-address")).toBe("warning");
		expect(lan).toContain("biblioviva.local:8080");
		expect(lan).toContain('data-testid="camera-unavailable"');
		expect(lan).toContain('data-testid="finding-address-lan"');
		// the guide of that finding is the page on the local network
		expect(lan).toMatch(/docs\.biblioviva\.org\/it\/install\/choose-network\/#rete-locale/);

		const secure = await pageAs(page, "biblioviva.example.ts.net", "https");
		expect(stateIn(secure, "check-address")).toBe("ok");
		expect(secure).toContain('data-testid="finding-address-https"');
		expect(secure).not.toContain('data-testid="camera-unavailable"');

		// this computer itself, under any of its names
		const own = await pageAs(page, "127.0.0.1:3000", "http");
		expect(stateIn(own, "check-address")).toBe("ok");
	});

	test("the test pages of the printer open in a new tab and are printable pages", async ({
		page,
	}) => {
		await page.goto("/admin/setup");
		await waitForHydration(page);
		const pages = {
			cards: /\/print\/cards\/test\?template=/,
			labels: /\/print\/labels\/pair\?sample=1&stock=/,
			labelCalibration: /\/print\/labels\/calibration\?kind=pair&stock=/,
			duplex: /\/print\/cards\/calibration$/,
		};
		for (const [key, href] of Object.entries(pages)) {
			const button = page.getByTestId(`print-${key}`);
			await expect(button).toHaveText("Stampa");
			await expect(button).toHaveAttribute("href", href);
			await expect(button).toHaveAttribute("target", "_blank");
			const answer = await page.request.get((await button.getAttribute("href")) ?? "");
			expect(answer.status(), key).toBe(200);
			expect(answer.headers()["content-type"], key).toContain("text/html");
		}
		// each button is named after the page it prints, not just "Stampa"
		await expect(page.getByTestId("print-cards")).toHaveAccessibleName(
			"Stampa Pagina di prova delle tessere",
		);
		await expect(
			page.getByTestId("test-printers").getByRole("link", { name: /^Guida/ }),
		).toHaveCount(2);
	});

	test("the camera test opens the census; on plain HTTP outside this computer it is spent", async ({
		page,
	}) => {
		await page.goto("/admin/setup");
		await waitForHydration(page);
		const camera = page.getByTestId("camera-test");
		await expect(camera).toHaveAttribute("href", "/census");
		await expect(page.getByTestId("camera-unavailable")).toHaveCount(0);
		await camera.click();
		await expect(page).toHaveURL(/\/census$/);

		const lan = await pageAs(page, "biblioviva.local:8080", "http");
		const spent = /<(a|button)\b[^>]*data-testid="camera-test"[^>]*>/.exec(lan)?.[0] ?? "";
		expect(spent).toMatch(/^<button\b/);
		expect(spent).toContain("disabled");
		expect(lan).toContain("serve una pagina sicura (HTTPS)");
		expect(lan).toContain("funziona solo con una connessione sicura");
	});

	test("the scanner field shows what the scanner typed and names the keyboard mishap", async ({
		page,
	}) => {
		await page.goto("/admin/setup");
		await waitForHydration(page);
		const field = page.getByRole("textbox", { name: "Codice letto dal lettore" });
		await expect(page.getByTestId("scanner-waiting")).toBeVisible();

		// the dash typed as an apostrophe, then Enter, as an Italian keyboard and a US scanner do
		await field.fill(TYPED);
		await field.press("Enter");
		await expect(field).toHaveValue("");
		await expect(page.getByTestId("scanner-typed")).toHaveText(TYPED);
		await expect(page.getByTestId("scanner-code")).toHaveText(COPY);
		await expect(page.getByTestId("scanner-kind")).toHaveText("Copia");
		await expect(page.getByTestId("scanner-enter")).toHaveAttribute("data-state", "true");
		const verdict = page.getByTestId("scanner-verdict");
		await expect(verdict).toHaveAttribute("data-verdict", "mishap");
		await expect(verdict).toContainText("«'» al posto di «-»");
		await expect(verdict).toContainText("«Italiana»");
		await expectAxeClean(page);

		// the right code: nothing to say about the layout
		await field.fill(COPY);
		await field.press("Enter");
		await expect(verdict).toHaveAttribute("data-verdict", "ok");
		await expect(verdict).toContainText("Lettura corretta");

		// characters no barcode has: the keyboard is not the scanner's
		await field.fill("ab§c");
		await field.press("Enter");
		await expect(verdict).toHaveAttribute("data-verdict", "strange");
		await expect(verdict).toContainText("§");

		// a code that is not one
		await field.fill("12345");
		await field.press("Enter");
		await expect(page.getByTestId("scanner-kind")).toHaveText(
			/Numero che può essere una copia o una tessera|Non riconosciuto/,
		);

		// no Enter after the code: the test says the scanner does not send it
		await field.fill(COPY);
		await expect(page.getByTestId("scanner-enter")).toHaveAttribute("data-state", "null");
		await expect(page.getByTestId("scanner-enter")).toHaveAttribute("data-state", "false", {
			timeout: 5000,
		});
		await expect(page.getByTestId("scanner-enter")).toContainText("suffisso Invio");

		await page.getByTestId("scanner-clear").click();
		await expect(field).toHaveValue("");
		await expect(page.getByTestId("scanner-waiting")).toBeVisible();
	});

	test("is linked from Amministrazione, and an account without admin is refused", async ({
		page,
	}) => {
		await page.goto("/admin");
		await waitForHydration(page);
		await page.getByTestId("admin-section-setup").click();
		await expect(page).toHaveURL(/\/admin\/setup$/);
		await expect(page.getByRole("heading", { level: 1 })).toHaveText("Controllo installazione");

		await page.context().clearCookies();
		const login = new LoginPage(page);
		await login.goto();
		await login.loginAs("tessere", "tessere-test-pw");
		await expect(page).toHaveURL(/\/$/);
		expect((await page.request.get("/admin/setup")).status()).toBe(403);
		// the dashboard of an account without admin never carries the reminder
		await expect(page.getByTestId("setup-reminder")).toHaveCount(0);
	});
});
