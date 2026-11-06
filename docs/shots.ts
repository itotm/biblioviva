// SPDX-License-Identifier: GPL-3.0-or-later
// The shot list of the documentation (PLAN.md §3.23): one entry for each figure marker
// `<!-- figure: <name> | <caption> -->` of the Markdown pages. `bun run docs:shots` takes them all
// (tests/docs/shots.spec.ts) on the e2e setup: the deterministic demo data, the fixed fonts, the
// default colours, one of the shared accounts of tests/fixtures/e2e/config.json.
import type { Locator, Page } from "@playwright/test";
import { deskField, deskScan } from "../tests/e2e/helpers/desk.js";
import { waitForHydration } from "../tests/e2e/helpers/hydration.js";
import { tmpdir } from "node:os";
import { join } from "node:path";

/** The shared accounts of the test configuration and their passwords. */
export const ACCOUNTS = {
	admin: "admin-test-pw",
	prestiti: "prestiti-test-pw",
	catalogo: "catalogo-test-pw",
	tessere: "tessere-test-pw",
	report: "report-test-pw",
} as const;
export type Account = keyof typeof ACCOUNTS;
/** The account of a shot: one of the shared accounts, or nobody (the login page). */
export type ShotAccount = Account | "anonymous";

/** Where the Playwright run leaves the PNG files, out of the repository (`scripts/shots-webp.ts` converts them). */
export const PNG_DIR = process.env.BV_SHOTS_PNG_DIR ?? join(tmpdir(), "biblioviva-docs-shots");

export type Window = "computer";

export interface Shot {
	/** `<area>/<picture>`, the name of the figure marker. */
	name: string;
	account: ShotAccount;
	/** The page opened first (the language is added by the runner). */
	path: string;
	/** Brings the screen to its state: a scan, a dialog opened, a menu unfolded. */
	steps?: (page: Page) => Promise<void>;
	/** Puts the data back as the shot found it (after the picture), for the shots that add something. */
	after?: (page: Page) => Promise<void>;
	/** A selector to crop the picture to (a dialog, a panel); the whole window when missing. */
	crop?: string | ((page: Page) => Locator);
	windows: Window[];
	/** The shot takes longer than the others (an image is analysed in the browser). */
	slow?: boolean;
	/** Taken by `tests/docs/wizard.spec.ts` on a server without configuration. */
	wizard?: boolean;
	/** A page of another program drawn in `docs/mocks/<name>.html` (ADR-046), opened from the disk. */
	mock?: boolean;
}

const computer: Window[] = ["computer"];

/** A page taken as it opens. */
const screen = (
	name: string,
	account: ShotAccount,
	path: string,
	more: Pick<Shot, "steps" | "crop" | "after" | "slow"> = {},
): Shot => ({ name, account, path, windows: computer, ...more });

/** A picture of the wizard, taken on a server without configuration. */
const wizard = (name: string, steps: Shot["steps"]): Shot => ({
	name,
	account: "admin",
	path: "/setup",
	steps,
	windows: computer,
	wizard: true,
});

/** A page of another program, drawn in `docs/mocks/` and cropped to its drawing (ADR-046). */
const mock = (name: string): Shot => ({
	name,
	account: "anonymous",
	path: `docs/mocks/${name}.html`,
	crop: ".mock",
	windows: computer,
	mock: true,
});

/** Opens a header action, from its row or from the "Altre azioni" menu. */
async function action(page: Page, testid: string): Promise<void> {
	const button = page.getByTestId(testid);
	if (!(await button.isVisible())) {
		await page.getByTestId("more-actions").click();
	}
	await button.click();
}

const section = (page: Page, title: string): Locator =>
	page.locator("section, div").filter({ has: page.getByRole("heading", { name: title }) }).last();

/** Closes the "Limite di prestiti raggiunto" dialog that a full patron's card opens at the desk. */
async function closeLimitDialog(page: Page): Promise<void> {
	const dialog = page.getByRole("dialog");
	if (await dialog.isVisible({ timeout: 1500 }).catch(() => false)) {
		await dialog.getByRole("button", { name: "Chiudi" }).last().click();
		await dialog.waitFor({ state: "hidden" });
	}
}

/** A record without copies and without classification ("Classifica dopo"), added by hand; returns its id. */
async function addLaterRecord(page: Page, title: string): Promise<number> {
	await page.goto("/catalog/new");
	await waitForHydration(page);
	await page.getByLabel("Titolo", { exact: true }).fill(title);
	await page.getByLabel("Autore", { exact: true }).fill("Prova, Anna");
	await page.getByTestId("quick-publisher").click();
	await page.getByTestId("kind-later").click();
	await page.getByTestId("biblio-submit").click();
	await page.waitForURL(/\/catalog\/\d+/);
	await waitForHydration(page);
	return Number(/\/catalog\/(\d+)/.exec(page.url())?.[1]);
}

/** Deletes a record added by a shot, with its copies. */
async function removeRecord(page: Page, id: number): Promise<void> {
	await page.goto(`/catalog/${id}`);
	await waitForHydration(page);
	const deleteItems = page.locator('[data-testid^="delete-item-"]');
	while ((await deleteItems.count()) > 0) {
		await deleteItems.first().click();
		await page.getByTestId("confirm-button").click();
		await page.getByRole("status").getByText("Copia eliminata").first().waitFor();
		await page.waitForTimeout(300);
	}
	await action(page, "delete-biblio");
	await page.getByTestId("confirm-button").click();
	await page.waitForURL(/\/catalog$/);
}

let addedRecord = 0;
/** The page of the class picture that the first census shot uploads (the later ones reuse it). */
let sheetPage = "";

/** Uploads the picture of a class's cards and waits for the frames; returns the address of its page. */
async function uploadSheet(page: Page): Promise<string> {
	await page.getByTestId("sheet-upload").setInputFiles("tests/fixtures/images/class-cards.jpg");
	await page.waitForURL(/\/census\/sheets\/\d+$/, { timeout: 30_000 });
	await waitForHydration(page);
	await page.getByTestId("sheet-found").getByText("Foto trovate: 10").waitFor({ timeout: 60_000 });
	await page.getByTestId("sheet-frames").locator("li").nth(9).waitFor();
	return new URL(page.url()).pathname;
}

/** Opens the sheet page of the first census shot. */
async function openSheet(page: Page): Promise<void> {
	await page.goto(sheetPage);
	await waitForHydration(page);
	await page.getByTestId("sheet-frames").locator("li").nth(9).waitFor();
}

// seeded data (scripts/seed.ts, deterministic): student 12 Dominici has no loan, student Campus (1 A)
// has one, teacher 272 Palumbo has four, record 117 has three copies
const TEACHER_CARD = "W000272";

/** A teacher of the seed without loans (a student may have one book) and two copies on the shelf. */
const LENT = { card: "Z000275", books: ["2019-A0044", "2023-U0035"] } as const;
/** Copies of the seed lent long ago to students no other shot shows: their returns are late. */
const OVERDUE = ["2026-V0005", "2025-B0006"] as const;
/** Copies of the seed read on shelf D: four in their place, one read twice, one of shelf A. */
const SHELF_D = ["2019-P0126", "2020-P0131", "2025-M0223", "2026-T0003", "2026-T0003", "2024-T0016"];

/** Two returns at the check-in desk: a book in time and one late. */
async function returnTwo(page: Page, inTime: string, late: string): Promise<void> {
	const field = page.getByRole("textbox", { name: "Passa il codice del libro restituito" });
	for (const code of [late, inTime]) {
		await field.fill(code);
		await field.press("Enter");
		await page.getByTestId("checkin-row").getByText(code).waitFor();
	}
}

/** The stocktaking's list of the copies still to find, narrowed to a shelf and an item type. */
async function missingOf(page: Page, shelf: string, itemType: string): Promise<void> {
	await page.getByTestId("missing-shelf").selectOption(shelf);
	await page.getByTestId("missing-type").selectOption(itemType);
	await page.waitForLoadState("networkidle");
	await page.getByTestId("missing-list").locator("li").first().waitFor();
}

/** A window as tall as the page, for a screen whose parts are explained together. */
async function wholePage(page: Page): Promise<void> {
	const height = await page.evaluate(() => document.documentElement.scrollHeight);
	await page.setViewportSize({ width: 1280, height: Math.max(800, height) });
	await page.evaluate(() => window.scrollTo(0, 0));
}

/** A copy read in the stocktaking's field, which keeps the focus for the next one. */
async function inventoryScan(page: Page, code: string): Promise<void> {
	const first = page.getByTestId("inventory-result").first();
	const before = (await first.count()) > 0 ? ((await first.textContent()) ?? "") : "";
	const field = page.getByRole("textbox", { name: "Codice della copia" });
	await field.fill(code);
	await field.press("Enter");
	// the newest result comes first: wait until it is this one
	await page.waitForFunction(
		(prev) => document.querySelector("[data-testid=inventory-result]")?.textContent !== prev,
		before,
	);
}


export const SHOTS: Shot[] = [
	// ---- Amministrazione: pages that open as they are
	screen("about/about", "admin", "/about"),
	// one's own password, from the account menu (9.51)
	screen("account/change-password", "prestiti", "/password", {
		crop: "[data-testid=password-page]",
	}),
	screen("admin/appearance", "admin", "/admin/appearance"),
	screen("admin/audit", "admin", "/admin/audit"),
	screen("admin/backups", "admin", "/admin/backups"),
	screen("admin/classes", "admin", "/admin/classes"),
	screen("admin/classification", "admin", "/admin/config/classification", {
		steps: async (page) => {
			await page.locator('[data-testid="taxonomy-node"][data-code="A"]').first().click();
		},
	}),
	screen("admin/clear-demo", "admin", "/admin"),
	screen("admin/config-calendar", "admin", "/admin/config/calendar"),
	screen("admin/config-circulation", "admin", "/admin/config/circulation"),
	screen("admin/config-history", "admin", "/admin/config/history"),
	screen("admin/config-photos", "admin", "/admin/config/photos"),
	screen("admin/configuration", "admin", "/admin/config"),
	screen("admin/config-archive", "admin", "/admin/config", {
		crop: (page) => section(page, "Archivio della configurazione"),
	}),
	screen("admin/barcode-formats", "admin", "/admin/config/barcodes", {
		crop: "[data-testid=block-barcode-formats]",
	}),
	screen("admin/label-stocks", "admin", "/admin/config/labels", {
		crop: "[data-testid=block-stocks]",
	}),
	screen("admin/language-packs", "admin", "/admin/config/ui", {
		crop: "[data-testid=block-languagePacks]",
	}),
	screen("admin/duplex-calibration", "admin", "/admin/cards/calibration"),
	screen("admin/exports", "admin", "/admin/exports"),
	screen("admin/home", "admin", "/admin"),
	screen("admin/imports", "admin", "/admin/imports"),
	screen("admin/reports-library", "admin", "/admin/config/reports"),
	screen("admin/rollover-classes", "admin", "/admin/rollover"),
	screen("admin/templates", "admin", "/admin/config/templates"),
	screen("admin/templates-list", "admin", "/admin/config/templates"),
	screen("admin/templates-labels", "admin", "/admin/config/templates"),
	screen("admin/users", "admin", "/admin/users"),
	screen("admin/card-designer", "admin", "/admin/config/templates/cards/default"),
	screen("admin/card-preview", "admin", "/admin/config/templates/cards/default"),
	screen("admin/label-designer", "admin", "/admin/config/templates/pair/default"),
	screen("admin/label-preview", "admin", "/admin/config/templates/pair/default"),
	screen("admin/report-editor", "admin", "/admin/config/reports", {
		steps: async (page) => {
			await page.getByRole("link", { name: "Modifica" }).first().click();
			await page.waitForURL(/\/admin\/config\/reports\/.+/);
			await page.getByRole("heading", { level: 1 }).waitFor();
		},
	}),
	screen("dashboard/overview", "admin", "/"),
	screen("notes/open", "admin", "/notes"),
	screen("notes/new-dialog", "admin", "/notes", {
		steps: async (page) => {
			await page.getByTestId("note-new").click();
			await page.getByTestId("note-dialog").waitFor();
		},
		crop: "[data-testid=note-dialog]",
	}),
	screen("calendar/year", "admin", "/calendar"),
	screen("circulation/calendar", "admin", "/calendar"),
	screen("calendar/new-date", "admin", "/calendar", {
		steps: async (page) => {
			await action(page, "calendar-new");
			await page.getByRole("dialog").waitFor();
		},
		crop: "[role=dialog]",
	}),
	screen("admin/account-password", "admin", "/admin/users", {
		steps: async (page) => {
			await page.getByRole("button", { name: /password/i }).first().click();
			await page.getByRole("dialog").waitFor();
		},
		crop: "[role=dialog]",
	}),
	screen("reports/library", "report", "/reports"),
	screen("reports/report", "report", "/reports", {
		steps: async (page) => {
			await page.locator("a[href^='/reports/']").first().click();
			await page.waitForURL(/\/reports\/.+/);
			await page.getByRole("heading", { level: 1 }).waitFor();
			await page.waitForLoadState("networkidle");
		},
	}),
	screen("reports/report-page", "report", "/reports", {
		steps: async (page) => {
			await page.locator("a[href^='/reports/']").first().click();
			await page.waitForURL(/\/reports\/.+/);
			await page.waitForLoadState("networkidle");
		},
	}),

	// ---- Catalogo
	screen("catalog/catalog-search", "catalogo", "/catalog?q=the", {}),
	screen("catalog/list", "catalogo", "/catalog?q=the"),
	screen("catalog/inventory-empty", "catalogo", "/inventory"),
	// a book added "Classifica dopo" waits in the list and in the flow; it is deleted after the picture
	screen("catalog/to-classify-list", "catalogo", "/catalog/to-classify", {
		steps: async (page) => {
			addedRecord = await addLaterRecord(page, "Il giardino dei ciliegi");
			await page.goto("/catalog/to-classify");
			await waitForHydration(page);
			await page.getByTestId("classify-start").waitFor();
		},
		after: async (page) => removeRecord(page, addedRecord),
	}),
	screen("catalog/classify-flow", "catalogo", "/catalog/to-classify", {
		steps: async (page) => {
			addedRecord = await addLaterRecord(page, "Il giardino dei ciliegi");
			await page.goto(`/catalog/to-classify/${addedRecord}`);
			await waitForHydration(page);
			await page.getByTestId("genre-B").click();
			await page.getByTestId("classify-call-number").waitFor();
		},
		after: async (page) => removeRecord(page, addedRecord),
	}),
	screen("catalog/new-book-done", "catalogo", "/cataloging/new", {
		steps: async (page) => {
			await page.getByTestId("no-code").click();
			await page.getByTestId("stage-search").waitFor();
			await page.getByTestId("search-title").fill("Il giardino dei ciliegi");
			await page.getByTestId("search-submit").click();
			await page.getByTestId("lookup-manual").click();
			await page.getByTestId("stage-form").waitFor();
			await page.getByTestId("quick-author-Anonimo").click();
			await page.getByTestId("quick-publisher").click();
			await page.getByTestId("kind-later").click();
			await page.getByTestId("biblio-submit").click();
			await page.getByTestId("stage-done").waitFor();
		},
		after: async (page) => {
			await page.getByTestId("done-open").click();
			await page.waitForURL(/\/catalog\/\d+$/);
			await removeRecord(page, Number(page.url().split("/").pop()));
		},
	}),
	screen("catalog/record-copies", "catalogo", "/catalog/117"),
	screen("circulation/record-copies", "prestiti", "/catalog/117"),
	screen("catalog/book-record-copies", "catalogo", "/catalog/117"),
	screen("catalog/edit-record", "catalogo", "/catalog/117/edit"),
	screen("catalog/add-copies-dialog", "catalogo", "/catalog/117", {
		steps: async (page) => {
			await action(page, "add-copies");
			await page.getByTestId("add-copies-count").waitFor();
		},
	}),
	screen("catalog/item-status-dialog", "catalogo", "/catalog/117", {
		steps: async (page) => {
			await page.getByTestId("items-table").locator("tbody tr").first().getByRole("button").first().click();
			await page.getByRole("dialog").waitFor();
		},
		crop: "[role=dialog]",
	}),
	screen("catalog/new-book-code", "catalogo", "/cataloging/new"),
	screen("catalog/new-book-search", "catalogo", "/cataloging/new", {
		steps: async (page) => {
			await page.getByTestId("no-code").click();
			await page.getByTestId("stage-search").waitFor();
			await page.getByTestId("search-title").fill("Il piccolo principe");
			await page.getByTestId("search-submit").click();
			await page.getByTestId("candidate").first().waitFor();
		},
	}),
	screen("catalog/new-book-form", "catalogo", "/cataloging/new", {
		steps: async (page) => {
			const input = page.getByLabel("ISBN o EAN");
			await input.fill("9788807580017");
			await input.press("Enter");
			await page.getByTestId("stage-form").waitFor();
		},
	}),
	screen("catalog/new-book-cover", "catalogo", "/cataloging/new", {
		steps: async (page) => {
			const input = page.getByLabel("ISBN o EAN");
			await input.fill("9788807580017");
			await input.press("Enter");
			await page.getByTestId("stage-form").waitFor();
		},
	}),
	screen("catalog/new-book-duplicate", "catalogo", "/cataloging/new", {
		steps: async (page) => {
			const input = page.getByLabel("ISBN o EAN");
			await input.fill("9780255295888");
			await input.press("Enter");
			await page.getByTestId("stage-duplicate").waitFor();
		},
	}),
	screen("catalog/new-book-manual", "catalogo", "/cataloging/new", {
		steps: async (page) => {
			await page.getByTestId("no-code").click();
			await page.getByTestId("stage-search").waitFor();
			await page.getByTestId("search-title").fill("Zzzz qqqq");
			await page.getByTestId("search-submit").click();
			await page.getByTestId("lookup-manual").click();
			await page.getByTestId("stage-form").waitFor();
		},
	}),
	screen("wishlist/form-similar", "prestiti", "/wishlist", {
		steps: async (page) => {
			await page.getByTestId("wish-title").fill("Fahrenheit");
			await page.getByTestId("wish-similar-catalog").waitFor();
		},
	}),
	screen("circulation/wishlist", "prestiti", "/wishlist"),

	// ---- Prestiti (read-only states)
	screen("circulation/checkout-start", "prestiti", "/circulation/checkout"),
	screen("circulation/checkout-name-search", "prestiti", "/circulation/checkout", {
		steps: async (page) => {
			await deskField(page).fill("pal");
			await page.getByTestId("desk-scan-results").waitFor();
		},
	}),
	screen("circulation/checkout-patron", "prestiti", "/circulation/checkout", {
		steps: async (page) => {
			// a student with a book on loan: the card shows it with its due date
			await deskField(page).fill("campus");
			const results = page.getByTestId("desk-scan-results");
			await results.waitFor();
			await deskField(page).press("Enter");
			await page.getByTestId("desk-patron-name").waitFor();
			await closeLimitDialog(page);
			await page.getByTestId("desk-patron-loans").waitFor();
		},
	}),
	screen("circulation/checkout-renew", "prestiti", "/circulation/checkout", {
		steps: async (page) => {
			// the teacher has four books: the card is full, the dialog is closed, Rinnova stays
			await deskScan(page, TEACHER_CARD);
			await page.getByTestId("desk-patron-name").waitFor();
			await closeLimitDialog(page);
			await page.getByTestId("desk-renew-all").waitFor();
		},
		// the card is taller than the window: the picture takes the whole card
		crop: "[data-testid=desk-patron]",
	}),
	screen("circulation/checkin-start", "prestiti", "/circulation/checkin"),
	screen("circulation/loans-start", "prestiti", "/circulation/loans"),
	screen("circulation/loans-search-surname", "prestiti", "/circulation/loans", {
		steps: async (page) => {
			await page.getByLabel("Cerca").fill("palumbo");
			await page.getByTestId("data-grid").waitFor();
		},
	}),
	screen("circulation/loans-overdue", "prestiti", "/circulation/loans", {
		steps: async (page) => {
			await page.getByLabel("Cerca").fill("messina");
			await page.getByTestId("overdue-only").check();
			await page.getByText(/Messina/).first().waitFor();
		},
	}),
	screen("circulation/loans-filtered", "prestiti", "/circulation/loans", {
		steps: async (page) => {
			await page.getByLabel("Cerca").fill("messina");
			await page.getByTestId("overdue-only").check();
			await page.getByText(/Messina/).first().waitFor();
		},
	}),
	screen("circulation/overdues", "prestiti", "/circulation/overdues"),

	// ---- Utenti, stampe, censimento
	screen("patrons/list", "tessere", "/patrons", {
		steps: async (page) => {
			// a class chosen: the patrons of the 2nd year
			await page.getByLabel("Classe", { exact: true }).selectOption({ index: 2 });
			await page.getByTestId("data-grid").waitFor();
		},
	}),
	screen("patrons/new-student", "tessere", "/patrons/new"),
	screen("patrons/new-teacher", "tessere", "/patrons/new", {
		steps: async (page) => {
			await page.getByRole("radio", { name: "Docente" }).check();
		},
	}),
	screen("patrons/edit-form", "tessere", "/patrons/12/edit"),
	screen("patrons/record-loans", "tessere", "/patrons", {
		steps: async (page) => {
			// a student with a book on loan
			await page.getByLabel("Cerca").fill("campus");
			await page.getByTestId("data-grid").getByText(/Campus/).first().click();
			await page.waitForURL(/\/patrons\/\d+$/);
			await waitForHydration(page);
			await page.getByText(/Pale Fire/).first().waitFor();
		},
	}),
	screen("patrons/card-tab", "tessere", "/patrons/12", {
		steps: async (page) => {
			await page.getByRole("tab", { name: "Tessera" }).click();
		},
	}),
	screen("census/start", "tessere", "/census"),
	screen("patrons/census-choice", "tessere", "/census"),
	screen("printing/lists-index", "tessere", "/print-lists", {
		steps: async (page) => {
			// the dialog of a new list, opened and left unconfirmed
			await page.getByTestId("new-patron-list").click();
			await page.getByTestId("new-list-name").fill("Tessere da ristampare");
		},
	}),
	screen("print/lists", "admin", "/print-lists"),
	screen("printing/lists-classes", "tessere", "/print-lists"),
	screen("printing/list-filters", "tessere", "/print-lists/1"),
	screen("print/list-patrons", "tessere", "/print-lists/1"),

	// ---- dialogs and panels, opened and left unconfirmed
	screen("login/login", "anonymous", "/login"),
	screen("patrons/remove-dialog", "admin", "/patrons/12", {
		steps: async (page) => {
			await action(page, "remove-patron");
			await page.getByRole("alertdialog").waitFor();
		},
		crop: "[role=alertdialog]",
	}),
	screen("patrons/photo-panel", "tessere", "/patrons/12", {
		steps: async (page) => {
			await page.getByTestId("photo-toggle").click();
			await page.getByTestId("photo-panel").waitFor();
			await page.waitForTimeout(500);
		},
	}),
	screen("catalog/label-print-dialog", "catalogo", "/catalog/117", {
		steps: async (page) => {
			await action(page, "print-labels");
			await page.getByTestId("label-print-dialog").waitFor();
		},
		crop: "[role=dialog]",
	}),
	screen("printing/card-dialog", "tessere", "/print-lists", {
		steps: async (page) => {
			await page.getByTestId("print-classes").getByTestId("print-class-cards").first().click();
			await page.getByTestId("card-print-dialog").waitFor();
		},
		crop: "[role=dialog]",
	}),
	screen("catalog/classification-picker", "catalogo", "/catalog/117/edit", {
		steps: async (page) => {
			await page.getByTestId("classification-picker").scrollIntoViewIfNeeded();
		},
		crop: "[data-testid=classification-picker]",
	}),
	screen("catalog/cover-panel", "catalogo", "/catalog/117", {
		steps: async (page) => {
			await page.getByTestId("cover-open").click();
			await page.getByTestId("cover-panel").waitFor();
			await page.waitForTimeout(500);
		},
		crop: "[data-testid=cover-panel]",
	}),

	// ---- census (read-only until the class picture is uploaded; the sheet is deleted after the last shot)
	screen("patrons/census-class", "tessere", "/census?group=1", {
		steps: async (page) => {
			await page
				.locator('[data-testid^="census-patron-"][data-has-photo="false"]')
				.first()
				.click();
			await page.getByTestId("census-current").waitFor();
			await page.waitForTimeout(800);
		},
	}),
	screen("census/camera-stage", "tessere", "/census?group=1", {
		steps: async (page) => {
			await page
				.locator('[data-testid^="census-patron-"][data-has-photo="false"]')
				.first()
				.click();
			await page.getByTestId("census-current").waitFor();
			await page.waitForTimeout(800);
		},
		crop: "[data-testid=census-stage]",
	}),
	screen("census/class-sheets", "tessere", "/census?group=7", {
		steps: async (page) => {
			await page.getByTestId("class-sheets").waitFor();
		},
		crop: "[data-testid=class-sheets]",
	}),
	screen("census/sheet-frames", "tessere", "/census?group=7", {
		steps: async (page) => {
			sheetPage = await uploadSheet(page);
		},
		slow: true,
	}),
	screen("patrons/census-sheet", "tessere", "/census?group=7", {
		steps: async (page) => {
			await openSheet(page);
		},
	}),
	screen("census/sheet-save", "tessere", "/census?group=7", {
		steps: async (page) => {
			await openSheet(page);
			for (const position of [1, 2, 3]) {
				await page.getByTestId(`sheet-choose-${position}`).selectOption({ index: position });
			}
			await page.getByTestId("sheet-save").click();
			await page.getByRole("alertdialog").waitFor();
		},
		crop: "[role=alertdialog]",
		after: async (page) => {
			await page.getByRole("alertdialog").getByRole("button", { name: "Annulla" }).click();
			await page.getByTestId("sheet-delete").click();
			await page.getByTestId("confirm-button").click();
			await page.getByTestId("class-sheets-empty").waitFor();
		},
	}),

	// ---- shots that change the data, last of their account (the accounts run in the order of ACCOUNTS)
	screen("admin/card-background-picker", "admin", "/admin/config/templates/cards/default", {
		steps: async (page) => {
			await page.getByTestId("designer-face-back.html").click();
			await page.getByTestId("designer-pick-background").click();
			await page.getByTestId("background-picker").locator("img").first().waitFor();
			await page.waitForLoadState("networkidle");
		},
		crop: "[role=dialog]",
	}),
	// two books lent to a teacher without loans; the check-in shots bring them back
	screen("circulation/checkout-lent", "prestiti", "/circulation/checkout", {
		steps: async (page) => {
			await deskScan(page, LENT.card);
			await page.getByTestId("desk-patron-name").waitFor();
			for (const [i, code] of LENT.books.entries()) {
				await deskScan(page, code);
				await page.getByTestId("desk-session-list").locator("li").nth(i).waitFor();
			}
		},
	}),
	// a lent book read with no card: returned, its borrower chosen (9.52); lent again afterwards,
	// so the check-in shots find it on loan
	screen("circulation/checkout-return-lend", "prestiti", "/circulation/checkout", {
		steps: async (page) => {
			await deskScan(page, LENT.books[0]);
			await page.getByTestId("desk-patron-name").waitFor();
			await page.locator("[data-code=returned_now_lending]").waitFor();
		},
		after: async (page) => {
			await deskScan(page, LENT.books[0]);
			await page.locator("[data-code=lent]").first().waitFor();
		},
	}),
	screen("circulation/checkin-returned", "prestiti", "/circulation/checkin", {
		steps: async (page) => returnTwo(page, LENT.books[0], OVERDUE[0]),
		crop: "[data-testid=checkin-session]",
	}),
	screen("circulation/checkin-done", "prestiti", "/circulation/checkin", {
		steps: async (page) => returnTwo(page, LENT.books[1], OVERDUE[1]),
	}),
	// a campaign started and left open (closing it would mark every copy not read as lost)
	screen("catalog/inventory-scan", "catalogo", "/inventory", {
		steps: async (page) => {
			await page.getByTestId("inventory-name").fill("Inventario di fine anno");
			await page.getByTestId("inventory-start").click();
			await page.getByTestId("inventory-current").waitFor();
			await page.getByTestId("inventory-shelf").fill("D");
			for (const code of SHELF_D) {
				await inventoryScan(page, code);
			}
			await page.getByTestId("inventory-current").getByText("1 fuori posto").waitFor();
			await missingOf(page, "D 1", "dvd");
			await wholePage(page);
		},
	}),
	screen("catalog/inventory-progress", "catalogo", "/inventory", {
		steps: async (page) => {
			await missingOf(page, "D 3", "dvd");
			await wholePage(page);
		},
	}),

	// ---- pages of other programs, drawn in docs/mocks/ (ADR-046)
	mock("tailscale/dns"),
	mock("tailscale/auth-key"),
	mock("imager/customisation"),
	mock("phone/install-app"),

	// ---- the first-run wizard (tests/docs/wizard.spec.ts): in this order, each step goes on from the one before
	wizard("setup/language", async (page) => {
		await page.getByRole("radio", { name: "Italiano" }).click();
		await page.getByRole("heading", { level: 1, name: "Prima configurazione" }).waitFor();
	}),
	wizard("setup/theme", async (page) => {
		await page.getByTestId("setup-next").click();
		await page.getByTestId("setup-step-theme").waitFor();
	}),
	wizard("setup/library", async (page) => {
		await page.getByTestId("setup-next").click();
		await page.getByLabel("Nome della biblioteca").fill("Biblioteca dell'Istituto");
	}),
	wizard("setup/school", async (page) => {
		await page.getByTestId("setup-next").click();
		await page.getByTestId("setup-step-school").waitFor();
		await page.getByLabel("Tipo di scuola").selectOption("it-primaria");
	}),
	wizard("setup/codes", async (page) => {
		await page.getByTestId("setup-next").click();
		await page.getByTestId("setup-step-codes").waitFor();
	}),
	wizard("setup/demo", async (page) => {
		await page.getByTestId("setup-next").click();
		await page.getByTestId("setup-step-demo").waitFor();
	}),
	wizard("setup/passwords", async (page) => {
		await page.getByTestId("setup-next").click();
		await page.getByTestId("setup-step-passwords").waitFor();
	}),
	wizard("setup/summary", async (page) => {
		await page.getByTestId("setup-next").click();
		await page.getByTestId("setup-step-summary").waitFor();
	}),
	wizard("setup/done", async (page) => {
		await page.getByTestId("setup-finish").click();
		await page.getByTestId("setup-done").waitFor({ timeout: 120_000 });
	}),
];
