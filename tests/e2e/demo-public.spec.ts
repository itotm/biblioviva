// SPDX-License-Identifier: GPL-3.0-or-later
// The public demo (step 9.17, Q118) against its own server started with DEMO_PUBLIC=1 on a folder
// it builds by itself: the band with the next reset, the accounts on the login page, nothing
// indexed, the configuration that can be tried but is not saved, and two visitors (two addresses,
// as Cloudflare's `cf-connecting-ip` gives them) sharing the notes, each with a daily limit.
import { spawn, type ChildProcess } from "node:child_process";
import { mkdtempSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import { createServer } from "node:net";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { expect, test, type Browser, type Page } from "@playwright/test";
import { waitForHydration } from "./helpers/hydration.js";
import { LoginPage } from "./pages/login.page.js";
import { deskField } from "./helpers/desk.js";

function freePort(): Promise<number> {
	return new Promise((resolve, reject) => {
		const srv = createServer();
		srv.listen(0, "127.0.0.1", () => {
			const address = srv.address();
			srv.close(() =>
				typeof address === "object" && address
					? resolve(address.port)
					: reject(new Error("no address")),
			);
		});
	});
}

async function startDemo(
	dir: string,
	extra: Record<string, string> = {},
): Promise<{
	server: ChildProcess;
	base: string;
	exited: Promise<number | null>;
}> {
	const port = await freePort();
	const url = `http://127.0.0.1:${port}`;
	const child = spawn("bun", ["./build"], {
		env: {
			...process.env,
			PORT: String(port),
			HOST: "127.0.0.1",
			PROTOCOL_HEADER: "x-forwarded-proto",
			ADDRESS_HEADER: "cf-connecting-ip",
			// as in docker/compose.demo.yml
			BODY_SIZE_LIMIT: "4M",
			DATA_DIR: join(dir, "data"),
			// as in docker/compose.demo.yml
			BACKUP_DIR: join(dir, "data", "backups"),
			CONFIG_DIR: join(dir, "config"),
			DEMO_PUBLIC: "1",
			DEMO_NOTES_PER_DAY: "2",
			METADATA_PROVIDER: "real",
			DEMO: "",
			ALLOW_LANG_OVERRIDE: "",
			DEV_UI: "",
			...extra,
		},
		stdio: "ignore",
	});
	const exited = new Promise<number | null>((resolve) => child.on("exit", resolve));
	for (let i = 0; i < 150; i++) {
		try {
			const res = await fetch(`${url}/healthz`, {
				headers: { "cf-connecting-ip": "192.0.2.1" },
			});
			if (res.ok) {
				return { server: child, base: url, exited };
			}
		} catch {
			/* not ready yet */
		}
		await new Promise((r) => setTimeout(r, 200));
	}
	child.kill();
	throw new Error("demo server did not start");
}

/** A visitor: a browser context of its own, behind its own address, Italian unless `locale` says otherwise. */
async function visitor(
	browser: Browser,
	base: string,
	address: string,
	locale = "it-IT",
): Promise<Page> {
	const context = await browser.newContext({
		baseURL: base,
		locale,
		storageState: { cookies: [], origins: [] },
		// what cloudflared sends (https there; the test server speaks plain http)
		extraHTTPHeaders: { "cf-connecting-ip": address, "x-forwarded-proto": "http" },
	});
	return context.newPage();
}

async function signIn(page: Page, username: string): Promise<void> {
	const login = new LoginPage(page);
	await page.goto("/login");
	await waitForHydration(page);
	await login.loginAs(username, "biblioviva");
	await expect(page).not.toHaveURL(/\/login/);
	await waitForHydration(page);
}

let server: ChildProcess | undefined;
let runDir = "";
let base = "";

test.describe.serial("public demo", () => {
	test.beforeAll(async ({ isMobile }) => {
		test.skip(isMobile, "one demo server is enough");
		runDir = mkdtempSync(join(tmpdir(), "bv-demo-"));
		({ server, base } = await startDemo(runDir));
	});

	test.afterAll(() => {
		server?.kill();
		if (runDir) {
			// the server may still be closing its files: retry for a moment
			rmSync(runDir, { recursive: true, force: true, maxRetries: 10, retryDelay: 100 });
		}
	});

	test("says what it is, gives the accounts and is never indexed", async ({ browser }) => {
		const page = await visitor(browser, base, "198.51.100.10");
		const response = await page.goto("/login");
		expect(response?.headers()["x-robots-tag"]).toBe("noindex, nofollow");
		await waitForHydration(page);
		const credentials = page.getByTestId("demo-credentials");
		for (const account of ["admin", "prestiti", "catalogo", "tessere", "report"]) {
			await expect(credentials).toContainText(account);
		}
		const welcome = page.getByTestId("demo-welcome");
		await expect(welcome.getByRole("heading", { level: 2 })).toHaveText(
			"Benvenuto nella demo di BiblioViva",
		);
		// the public beta, as on the home page and in the READMEs (ADR-048)
		await expect(welcome.getByTestId("demo-beta")).toHaveText("Public beta");
		await expect(welcome).toContainText("BiblioViva è in public beta");
		await expect(page.getByTestId("demo-contents")).toContainText(
			"300 alunni e docenti, 4000 titoli e 5000 copie",
		);
		await expect(credentials).toContainText(
			"prestiti · Gestione prestiti: il banco prestiti: presta, restituisce e rinnova",
		);
		await expect(page.getByTestId("demo-examples")).toContainText(
			"Nella demo il testo e le foto vengono sostituiti da un esempio",
		);
		await expect(page.getByTestId("demo-reset")).toContainText(
			"Ogni giorno alle 04:00 la demo torna come all'inizio",
		);
		await expect(page.getByTestId("demo-password")).toHaveText(
			"La password è la stessa per tutti gli account: biblioviva",
		);
		const robots = await (await fetch(`${base}/robots.txt`)).text();
		expect(robots).toContain("Disallow: /");
		// the wizard never shows: the demo is already set up
		expect((await page.goto("/setup"))?.status()).toBe(404);
		await page.context().close();
	});

	test("speaks the visitor's language and keeps the choice in the cookie of biblioviva.org", async ({
		browser,
	}) => {
		// the browser's language, without a choice
		const page = await visitor(browser, base, "198.51.100.30", "en-GB");
		await page.goto("/login");
		await waitForHydration(page);
		await expect(page.locator("html")).toHaveAttribute("lang", "en");
		await expect(
			page.getByTestId("demo-welcome").getByRole("heading", { level: 2 }),
		).toHaveText("Welcome to the BiblioViva demo");
		const switcher = page.getByTestId("language-switch");
		await expect(switcher.getByRole("radio")).toHaveText(["IT", "EN"]);
		await expect(page.getByTestId("language-en")).toHaveAttribute("aria-checked", "true");
		// the choice wins over the browser, page after page
		await page.getByTestId("language-it").click();
		await expect(page.locator("html")).toHaveAttribute("lang", "it");
		await expect(
			page.getByTestId("demo-welcome").getByRole("heading", { level: 2 }),
		).toHaveText("Benvenuto nella demo di BiblioViva");
		const cookie = (await page.context().cookies()).find((c) => c.name === "bv_lang");
		expect(cookie?.value).toBe("it");
		expect(cookie?.httpOnly).toBe(false);
		await signIn(page, "prestiti");
		await expect(page.getByTestId("language-it")).toHaveAttribute("aria-checked", "true");
		await expect(page.getByTestId("help-link")).toHaveAttribute(
			"href",
			/^https:\/\/docs\.biblioviva\.org\/it\//,
		);
		// from the top bar, back to English: the pages and the help
		await page.getByTestId("language-en").click();
		await expect(page.locator("html")).toHaveAttribute("lang", "en");
		await expect(page.getByTestId("help-link")).toHaveAttribute(
			"href",
			/^https:\/\/docs\.biblioviva\.org\/en\//,
		);
		expect((await page.context().cookies()).find((c) => c.name === "bv_lang")?.value).toBe(
			"en",
		);
		await page.context().close();
	});

	test("opens the configuration but does not save it", async ({ browser }) => {
		const page = await visitor(browser, base, "198.51.100.11");
		await signIn(page, "admin");
		// the login page says what the demo is: the app's pages carry no band of their own
		await expect(page.getByText("Demo pubblica", { exact: false })).toHaveCount(0);
		// the demo's version is the time of its build (yyyy.mm.dd.hhmm), in the menu and on About
		await expect(page.getByTestId("about-link")).toContainText(
			/\b\d{4}\.\d{2}\.\d{2}\.\d{4}\b/,
		);
		await page.goto("/about");
		await expect(page.getByTestId("about-version")).toHaveText(/^\d{4}\.\d{2}\.\d{2}\.\d{4}$/);
		// the demo data stay until the reset: Amministrazione offers no "Svuota dati dimostrativi"
		await page.goto("/admin");
		await waitForHydration(page);
		await expect(page.getByRole("heading", { name: "Amministrazione" })).toBeVisible();
		await expect(page.getByTestId("clear-demo")).toHaveCount(0);
		// the activity log records the login, never the visitor's address
		await page.goto("/admin/audit");
		await waitForHydration(page);
		const log = page.getByTestId("data-grid");
		await expect(log).toContainText("auth.login");
		await expect(log).not.toContainText("198.51.100.");
		await page.goto("/admin/config/privacy");
		await waitForHydration(page);
		const months = page.getByTestId("setting-privacy.auditRetentionMonths");
		await expect(months).toHaveValue("24");
		await months.fill("30");
		await page.getByTestId("section-save").click();
		await expect(
			page.getByText("Nella demo la configurazione non si salva", { exact: false }),
		).toBeVisible();
		await page.reload();
		await waitForHydration(page);
		await expect(page.getByTestId("setting-privacy.auditRetentionMonths")).toHaveValue("24");

		// a report turned into SQL is neither tried nor saved; the guided ones run as usual
		await page.goto("/admin/config/reports");
		await waitForHydration(page);
		await page.getByTestId("report-loans-by-month").getByTestId("report-duplicate").click();
		await waitForHydration(page);
		await page.getByTestId("editor-run-preview").click();
		await expect(page.getByTestId("editor-preview").getByTestId("data-grid")).toBeVisible();
		await page.getByTestId("editor-tab-sql").click();
		await page.getByTestId("editor-convert").click();
		await page.getByTestId("confirm-dialog").getByTestId("confirm-button").click();
		await expect(page.getByTestId("editor-sql-text")).toHaveValue(/^SELECT /);
		await page.getByTestId("editor-save").click();
		await expect(
			page.getByText("Nella demo i report scritti in SQL sono disattivati", { exact: false }),
		).toBeVisible();
		await page.context().close();
	});

	test("tries a colour set without keeping it once the save is refused", async ({ browser }) => {
		const page = await visitor(browser, base, "198.51.100.12");
		await signIn(page, "admin");
		await page.goto("/admin/appearance");
		await waitForHydration(page);
		const html = page.locator("html");
		const saved = await html.getAttribute("data-theme");
		expect(saved).toBe("ocean");
		await page.getByTestId("theme-sunset").click();
		await expect(html).toHaveAttribute("data-theme", "sunset");
		await page.getByTestId("save-theme").click();
		await expect(
			page.getByText("Nella demo la configurazione non si salva", { exact: false }),
		).toBeVisible();
		// the preview is put back: nothing of the refused colour set stays on the page
		await expect(html).toHaveAttribute("data-theme", "ocean");
		await expect(page.getByTestId("theme-ocean")).toHaveAttribute("aria-checked", "true");
		await page.getByTestId("theme-forest").click();
		await expect(html).toHaveAttribute("data-theme", "forest");
		// leaving the page without saving drops the preview as well
		await page.getByTestId("sidebar").getByRole("link", { name: "Utenti" }).click();
		await expect(page).toHaveURL(/\/patrons/);
		await expect(html).toHaveAttribute("data-theme", "ocean");
		await page.context().close();
	});

	test("shares the notes between visitors, a few per visitor and day", async ({ browser }) => {
		const first = await visitor(browser, base, "203.0.113.20");
		const second = await visitor(browser, base, "203.0.113.21");
		await signIn(first, "prestiti");
		await signIn(second, "catalogo");
		const write = async (page: Page, text: string): Promise<void> => {
			await page.goto("/notes");
			await waitForHydration(page);
			await page.getByTestId("note-new").click();
			await page.getByTestId("note-body-input").fill(text);
			await page.getByTestId("note-save").click();
		};
		// DEMO_NOTES_PER_DAY=2 for this server
		await write(first, "Prima nota della demo");
		await expect(first.getByTestId("note-dialog")).toHaveCount(0);
		await write(first, "Seconda nota della demo");
		await expect(first.getByTestId("note-dialog")).toHaveCount(0);
		await write(first, "Terza nota della demo");
		await expect(
			first.getByText("Nella demo si possono scrivere solo poche segnalazioni al giorno."),
		).toBeVisible();

		// the other visitor sees the notes and still has notes of their own
		await second.goto("/notes");
		await waitForHydration(second);
		// what a visitor writes is stored as the demo's text (Q121): the other reads the example
		const grid = second.getByTestId("notes-grid");
		const examples = grid.getByText("DEMO – segnalazione del", { exact: false });
		await expect(examples).toHaveCount(2);
		await expect(grid.getByText("Prima nota della demo")).toHaveCount(0);
		await write(second, "Nota del secondo visitatore");
		await expect(second.getByTestId("note-dialog")).toHaveCount(0);
		await expect(examples).toHaveCount(3);
		await expect(grid.getByText("Nota del secondo visitatore")).toHaveCount(0);
		await first.context().close();
		await second.context().close();
	});

	test("stores a patron under fake names with the demo's photo, and says so", async ({
		browser,
	}) => {
		const page = await visitor(browser, base, "198.51.100.30");
		await signIn(page, "tessere");
		await page.goto("/patrons/new");
		await waitForHydration(page);
		await page.getByTestId("new-photo-take").click();
		await page
			.getByTestId("photo-file")
			.setInputFiles("tests/fixtures/images/portrait-exif.jpg");
		await page.getByTestId("photo-use").click();
		await page.getByLabel("Cognome", { exact: true }).fill("Parolaccia");
		await page.getByLabel("Nome", { exact: true }).fill("Brutta");
		await page
			.getByRole("combobox", { name: "Classe", exact: true })
			.selectOption({ index: 1 });
		await page
			.getByRole("combobox", { name: "Sezione", exact: true })
			.selectOption({ index: 1 });
		await page.getByTestId("patron-submit").click();
		await expect(page).toHaveURL(/\/patrons\/\d+$/);
		await expect(
			page.getByText("Nella demo il testo e le foto vengono sostituiti da un esempio", {
				exact: false,
			}),
		).toBeVisible();
		await waitForHydration(page);
		await expect(page.getByRole("heading", { level: 1 })).not.toContainText("Parolaccia");
		await expect(page.getByTestId("patron-photo")).toBeVisible();
		await page.context().close();
	});

	test("takes the example class pictures of the census, a photo and a scan", async ({
		browser,
	}) => {
		const page = await visitor(browser, base, "198.51.100.33");
		await signIn(page, "tessere");
		await page.goto("/census");
		await waitForHydration(page);
		// the samples are offered on every class with a photo missing, not only the one without
		// photos (Q109)
		await page.getByTestId("census-group-1A").click();
		await expect(page.getByTestId("class-sheets")).toBeVisible();
		await expect(page.getByTestId("sheet-demo-scan")).toBeVisible();
		await expect(page.getByTestId("sheet-demo-photo")).toBeVisible();
		await page.goto("/census");
		await waitForHydration(page);
		await page.getByTestId("census-group-2C").click();
		await expect(page.getByTestId("class-sheets")).toBeVisible();
		await expect(page.getByTestId("sheet-demo-hint")).toContainText("la scansione è piatta");

		// the sample of a photo opens as a photo: ten frames in perspective
		await page.getByTestId("sheet-demo-photo").click();
		await expect(page).toHaveURL(/\/census\/sheets\/\d+$/, { timeout: 30_000 });
		await waitForHydration(page);
		await expect(page.getByTestId("sheet-picture")).toHaveAttribute("data-kind", "photo");
		await expect(page.getByTestId("sheet-found")).toContainText("Foto trovate: 10", {
			timeout: 60_000,
		});
		await page.getByTestId("sheet-delete").click();
		await page.getByTestId("confirm-button").click();
		await expect(page).toHaveURL(/\/census\?group=\d+$/);

		// the sample of a scan opens as a scan: ten rectangles turned by their cards' angles
		await page.getByTestId("sheet-demo-scan").click();
		await expect(page).toHaveURL(/\/census\/sheets\/\d+$/, { timeout: 30_000 });
		await waitForHydration(page);
		await expect(page.getByTestId("sheet-picture")).toHaveAttribute("data-kind", "scan");
		await expect(page.getByTestId("sheet-found")).toContainText("Foto trovate: 10", {
			timeout: 60_000,
		});
		// nobody chosen yet: a change of kind looks for the photos again, the way of that kind
		await expect(page.getByTestId("sheet-kind-hint")).toContainText(
			"cambiando tipo le foto vengono cercate di nuovo",
		);
		await page.getByTestId("sheet-kind-photo").click();
		await expect(page.getByTestId("sheet-picture")).toHaveAttribute("data-kind", "photo");
		await expect(page.getByTestId("sheet-found")).toContainText("Foto trovate: 10", {
			timeout: 60_000,
		});
		const options = await page
			.getByTestId("sheet-choose-1")
			.locator("option")
			.evaluateAll((all) =>
				all.map((o) => (o as HTMLOptionElement).value).filter((value) => value !== ""),
			);
		for (const [i, position] of [1, 2].entries()) {
			await page.getByTestId(`sheet-choose-${position}`).selectOption(options[i] ?? "");
			await expect(page.getByTestId(`sheet-choose-${position}`)).toHaveValue(
				options[i] ?? "",
			);
		}
		await page.getByTestId("sheet-save").click();
		await page.getByTestId("confirm-button").click();
		await expect(page.getByRole("status").getByText("Foto salvate: 2.")).toBeVisible();
		// the photos are the ones cut from the example picture, not the demo's placeholder
		for (const [i, position] of [1, 2].entries()) {
			await expect(page.getByTestId(`sheet-row-${position}`)).toHaveAttribute(
				"data-state",
				"saved",
			);
			const photo = await page.request.get(`/media/patrons/${options[i]}/main?v=1`);
			const frame = await page.request.get(
				(await page
					.getByTestId(`sheet-row-${position}`)
					.locator("img")
					.first()
					.getAttribute("src")) ?? "",
			);
			expect(Buffer.compare(await photo.body(), await frame.body())).toBe(0);
		}
		// back on the class without a reload: the picture's counts are the new ones
		await page.getByTestId("page-back").click();
		await expect(page.getByTestId("class-sheets-list")).toContainText("2 salvate");
		await page.locator('[data-testid^="class-sheet-"]').first().click();
		await expect(page.getByTestId("sheet-row-1")).toHaveAttribute("data-state", "saved");
		// "Elimina immagine": nothing of the picture is left on the page
		await page.getByTestId("sheet-delete").click();
		await page.getByTestId("confirm-button").click();
		// the toast of the photo's sample may still be on screen beside this one
		await expect(
			page.getByRole("status").getByText("Immagine eliminata.").last(),
		).toBeVisible();
		await expect(page).toHaveURL(/\/census\?group=\d+$/);
		await expect(page.getByTestId("sheet-frames")).toHaveCount(0);
		await expect(page.getByTestId("class-sheets-empty")).toBeVisible();
		await page.context().close();
	});

	test("imports the example file only", async ({ browser }) => {
		const page = await visitor(browser, base, "198.51.100.31");
		await signIn(page, "admin");
		await page.goto("/admin/imports/students");
		await waitForHydration(page);
		const example = await page.request.get("/admin/imports/students/template.csv");
		expect(example.headers()["content-disposition"]).toContain("students-example.csv");
		await page.getByTestId("csv-file").setInputFiles({
			name: "elenco.csv",
			mimeType: "text/csv",
			buffer: Buffer.from("first_name;last_name;class\r\nMario;Rossi;1 A\r\n"),
		});
		await page.getByTestId("upload-submit").click();
		await expect(
			page.getByText("Nella demo si importa solo il file di esempio", { exact: false }),
		).toBeVisible();
		await page.getByTestId("csv-file").setInputFiles({
			name: "students-example.csv",
			mimeType: "text/csv",
			buffer: await example.body(),
		});
		await page.getByTestId("upload-submit").click();
		await expect(page.getByTestId("mapping-step")).toBeVisible();
		await page.getByTestId("validate").click();
		await expect(page.getByTestId("preview-verdict")).toContainText("Nessun errore");
		await page.context().close();
	});

	test("keeps the record of the mock provider's lookup", async ({ browser }) => {
		const page = await visitor(browser, base, "198.51.100.32");
		await signIn(page, "catalogo");
		await page.goto("/cataloging/new");
		await waitForHydration(page);
		const code = page.getByLabel("ISBN o EAN");
		await code.fill("9788804668237");
		await code.press("Enter");
		await expect(page.getByTestId("stage-form")).toBeVisible();
		await expect(page.getByLabel("Titolo", { exact: true })).toHaveValue("1984");
		await page.getByTestId("kind-later").click();
		await page.getByTestId("biblio-submit").click();
		await expect(page.getByTestId("stage-done")).toBeVisible();
		await expect(page.getByTestId("done-summary")).toContainText("«1984»");
		await page.context().close();
	});

	test("downloads no archive or backup, and says so", async ({ browser }) => {
		const page = await visitor(browser, base, "198.51.100.35");
		await signIn(page, "admin");
		for (const path of ["/admin/config/export", "/admin/backups/export"]) {
			const answer = await page.request.get(path);
			expect(answer.headers()["content-type"]).not.toBe("application/zip");
			// a refusal of the demo, not a failure of the server
			expect(answer.status()).toBe(403);
		}
		const message = page.getByText("Nella demo gli archivi e i backup non si scaricano", {
			exact: false,
		});
		await page.goto("/admin/backups");
		await waitForHydration(page);
		await page.getByTestId("export-all").click();
		await expect(message.first()).toBeVisible();
		await page.goto("/admin/config");
		await waitForHydration(page);
		await page.getByTestId("config-export").click();
		await expect(message.first()).toBeVisible();
		await page.context().close();
	});

	test("prints three sheets at most, and says so on the page of a bigger one", async ({
		browser,
	}) => {
		const page = await visitor(browser, base, "198.51.100.34");
		await signIn(page, "catalogo");
		const small = await page.request.get("/print/labels/pair?ids=1,2,3&preview=1");
		expect(small.status()).toBe(200);
		// the sheet opens in a tab of its own: a page of the app that says why, never "500"
		const refused = await page.goto("/print/labels/pair?from=2000-01-01&to=2100-12-31");
		expect(refused?.status()).toBe(403);
		await expect(
			page.getByRole("heading", { name: "Non disponibile nella demo" }),
		).toBeVisible();
		await expect(
			page.getByText("Nella demo si stampano al massimo 3 fogli alla volta", {
				exact: false,
			}),
		).toBeVisible();
		await expect(page.locator("body")).not.toContainText("500");
		await page.getByRole("link", { name: "Torna a BiblioViva" }).click();
		await expect(page).toHaveURL(`${base}/`);
		await page.context().close();
	});

	test("says so when a visitor goes over the writes of a minute", async ({ browser }) => {
		const page = await visitor(browser, base, "198.51.100.33");
		await signIn(page, "admin");
		await page.goto("/circulation/checkout");
		await waitForHydration(page);
		// a code the desk looks up and does not lend: the field stays on the patron's step, every
		// Enter one write
		const code = "9788804668237";
		const input = deskField(page);
		const statuses: number[] = [];
		// the sign-in was one write: sixty scans more go over the ceiling of 60 a minute
		for (let i = 0; i < 60; i++) {
			const answer = page.waitForResponse(
				(r) => r.url().includes("/_app/remote/") && r.request().method() === "POST",
			);
			await input.fill(code);
			await input.press("Enter");
			statuses.push((await answer).status());
		}
		expect(statuses.at(-1)).toBe(429);
		await expect(
			page.getByText("Troppe richieste in poco tempo: riprovare tra un minuto.").first(),
		).toBeVisible();
		await page.context().close();
	});
});

test.describe("public demo start and reset", () => {
	test("refuses a folder that is not a demo's, stops when asked, ends itself at the reset time", async ({
		isMobile,
	}) => {
		test.skip(isMobile, "one demo server is enough");
		// a school's folder: the server refuses to start rather than empty it
		const school = mkdtempSync(join(tmpdir(), "bv-demo-school-"));
		writeFileSync(join(school, "keep.txt"), "a school's data");
		try {
			const port = await freePort();
			const child = spawn("bun", ["./build"], {
				env: {
					...process.env,
					PORT: String(port),
					HOST: "127.0.0.1",
					DATA_DIR: school,
					CONFIG_DIR: join(school, "config"),
					DEMO_PUBLIC: "1",
				},
				stdio: "ignore",
			});
			const code = await new Promise<number | null>((resolve) => child.on("exit", resolve));
			expect(code).not.toBe(0);
			expect(readdirSync(school)).toEqual(["keep.txt"]);
		} finally {
			rmSync(school, { recursive: true, force: true });
		}

		// `docker compose stop` (SIGTERM) ends it at once, although a reset is pending
		const stopped = mkdtempSync(join(tmpdir(), "bv-demo-stop-"));
		try {
			const demo = await startDemo(stopped);
			demo.server.kill("SIGTERM");
			const code = await Promise.race([
				demo.exited,
				new Promise<string>((r) => setTimeout(() => r("still running"), 10_000)),
			]);
			demo.server.kill("SIGKILL");
			expect(code).not.toBe("still running");
		} finally {
			rmSync(stopped, { recursive: true, force: true });
		}

		// the reset in a minute or two: the process ends cleanly (Docker starts it again)
		const dir = mkdtempSync(join(tmpdir(), "bv-demo-reset-"));
		try {
			// HH:MM on the library's clock (the demo keeps the default time zone)
			const resetAt = new Intl.DateTimeFormat("en-GB", {
				timeZone: "Europe/Rome",
				hour: "2-digit",
				minute: "2-digit",
				hourCycle: "h23",
			}).format(new Date(Date.now() + 90_000));
			test.setTimeout(180_000);
			const demo = await startDemo(dir, { DEMO_RESET_AT: resetAt });
			expect(await demo.exited).toBe(0);
		} finally {
			rmSync(dir, { recursive: true, force: true });
		}
	});
});
