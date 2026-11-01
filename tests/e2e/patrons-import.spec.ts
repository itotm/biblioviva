// SPDX-License-Identifier: GPL-3.0-or-later
// Student and teacher imports (steps 2.6, 9.19): the template generated with the chosen columns
// (the class in one column), upload → columns → check → import → summary; an unknown class lists
// the valid ones and blocks the import; re-importing the same file leaves every row unchanged; the
// synchronisation lists the missing students; the teachers have their own import, with their cards
// generated.
import { expect, test, type Page } from "@playwright/test";
import { expectAxeClean } from "./helpers/axe.js";
import { waitForHydration } from "./helpers/hydration.js";
import { LoginPage } from "./pages/login.page.js";

/** Each project (desktop, mobile) imports its own names: the database is shared for the run. */
const tagOf = (page: Page): "Mob" | "Desk" => (page.viewportSize()?.width === 412 ? "Mob" : "Desk");
function csv(
	page: Page,
	header: string,
	rows: string[][],
): { name: string; mimeType: string; buffer: Buffer<ArrayBuffer> } {
	const tag = tagOf(page);
	const body = [
		header,
		...rows.map(([first = "", last = "", ...rest]) =>
			[first, `${last}-${tag}`, ...rest].join(";"),
		),
	].join("\n");
	return { name: `students-${tag}.csv`, mimeType: "text/csv", buffer: Buffer.from(body, "utf8") };
}
const STUDENTS = [
	["Zaira", "Importati-Uno", "5 D"],
	["Yuri", "Importati-Due", "5D"],
	["Xenia", "Importati-Tre", "4ª D"],
];
const WITH_ERROR = [
	["Zaira", "Importati-Uno", "5 D"],
	["Walter", "Importati-Quattro", "7 D"],
];

test.describe.serial("student and teacher imports", () => {
	test("generates the template, imports the class in one column and prints the new cards", async ({
		page,
	}) => {
		await page.goto("/admin/imports");
		await waitForHydration(page);
		await page.getByTestId("imports-students").click();
		await expect(page.getByRole("heading", { level: 1 })).toHaveText("Importa studenti");
		await waitForHydration(page);

		// the template: the class in one column, with the email
		await expect(page.getByTestId("template-column-first_name")).toBeDisabled();
		await page.getByTestId("template-alternative-0").check();
		await page.getByTestId("template-column-email").check();
		await expect(page.getByTestId("template-preview")).toHaveText(
			"first_name;last_name;class;email",
		);
		await expect(page.getByTestId("template-download")).toHaveAttribute(
			"href",
			"/admin/imports/students/template.csv?columns=first_name,last_name,class,email",
		);
		const template = await page.request.get(
			"/admin/imports/students/template.csv?columns=first_name,last_name,class,email",
		);
		expect((await template.body()).subarray(3).toString("utf8")).toBe(
			"first_name;last_name;class;email\r\n",
		);
		// two ways of giving the class at once are refused
		expect(
			(
				await page.request.get(
					"/admin/imports/students/template.csv?columns=first_name,last_name,class,level,section",
				)
			).status(),
		).toBe(400);
		await expectAxeClean(page);

		await page
			.getByTestId("csv-file")
			.setInputFiles(csv(page, "first_name;last_name;class", STUDENTS));
		await page.getByTestId("upload-submit").click();
		await expect(page.getByTestId("mapping-step")).toBeVisible();
		await expect(page.getByTestId("detected-format")).toHaveText("first_name;last_name;class");
		await expect(page.getByTestId("upload-info")).toContainText("3 righe");
		await expect(page.getByTestId("has-header")).toBeChecked();
		await expect(page.getByTestId("map-column-2")).toHaveValue("class");
		await expect(page.getByTestId("match-by-name")).toBeVisible();
		await expectAxeClean(page);

		await page.getByTestId("validate").click();
		await expect(page.getByTestId("preview-step")).toBeVisible();
		await expect(page.getByTestId("counts")).toContainText("3 nuovi");
		await expect(page.getByTestId("preview-verdict")).toContainText("Nessun errore");
		await expect(page.getByTestId("generated-cards")).toContainText("3 tessere nuove");
		await expect(
			page.getByTestId("data-grid").getByText(/Importati-Uno-\w+ Zaira/),
		).toBeVisible();
		await expect(page.getByTestId("commit")).toBeEnabled();
		await expectAxeClean(page);

		await page.getByTestId("commit").click();
		await expect(page.getByTestId("done-step")).toBeVisible();
		await expect(page.getByTestId("done-summary")).toContainText("3 nuovi, 0 aggiornati");
		await page.getByTestId("print-new").click();
		await expect(
			page.getByTestId("card-print-dialog").getByTestId("card-print"),
		).toHaveAttribute("href", /\/print\/cards\?ids=\d+,\d+,\d+&layout=side-by-side/);
		await page.getByTestId("card-print-close").click();

		await page.goto("/patrons");
		await waitForHydration(page);
		await page.getByLabel("Cerca").fill(`importati-tre-${tagOf(page)}`);
		await expect(page.getByTestId("patron-count")).toContainText("1 utent");
	});

	test("re-importing the same file changes nothing", async ({ page }) => {
		await page.goto("/admin/imports/students");
		await waitForHydration(page);
		await page
			.getByTestId("csv-file")
			.setInputFiles(csv(page, "first_name;last_name;class", STUDENTS));
		await page.getByTestId("upload-submit").click();
		await expect(page.getByText("Colonne ricordate")).toBeVisible();
		await page.getByTestId("validate").click();
		await expect(page.getByTestId("counts")).toContainText("0 nuovi");
		await expect(page.getByTestId("counts")).toContainText("3 invariati");
		await expect(page.getByTestId("commit")).toBeEnabled();
	});

	test("an unknown class lists the valid ones and blocks the import", async ({ page }) => {
		await page.goto("/admin/imports/students");
		await waitForHydration(page);
		await page
			.getByTestId("csv-file")
			.setInputFiles(csv(page, "first_name;last_name;class", WITH_ERROR));
		await page.getByTestId("upload-submit").click();
		await page.getByTestId("validate").click();
		await expect(page.getByTestId("counts")).toContainText("1 errore");
		await expect(page.getByTestId("preview-verdict")).toContainText("Correggere gli errori");
		await expect(
			page
				.getByTestId("data-grid")
				.getByText(/Classe «7 D» non trovata\. Classi valide: 1 A/),
		).toBeVisible();
		await expect(page.getByTestId("commit")).toBeDisabled();
	});

	test("a file without the class column says which columns are missing", async ({ page }) => {
		await page.goto("/admin/imports/students");
		await waitForHydration(page);
		await page
			.getByTestId("csv-file")
			.setInputFiles(csv(page, "first_name;last_name;email", [["Ada", "Senza", ""]]));
		await page.getByTestId("upload-submit").click();
		await expect(page.getByTestId("mapping-incomplete")).toHaveText(
			"Mancano le colonne obbligatorie: class | level + section.",
		);
		await expect(page.getByTestId("validate")).toBeDisabled();
	});

	test("sync mode lists the missing students and offers their removal to an admin", async ({
		page,
	}) => {
		await page.goto("/admin/imports/students");
		await waitForHydration(page);
		await page
			.getByTestId("csv-file")
			.setInputFiles(csv(page, "first_name;last_name;class", STUDENTS));
		await page.getByTestId("upload-submit").click();
		await page.getByTestId("mode-sync").check();
		await page.getByTestId("validate").click();
		await expect(page.getByTestId("missing-patrons")).toContainText("Studenti presenti");
		await expect(page.getByTestId("remove-missing")).toBeVisible();
		await expect(page.getByTestId("remove-missing")).not.toBeChecked();
		// nothing is committed here: the seeded students stay for the other specs
	});

	test("teachers have their own import; their cards are generated", async ({ page }) => {
		await page.goto("/admin/imports");
		await waitForHydration(page);
		await page.getByTestId("imports-teachers").click();
		await expect(page.getByRole("heading", { level: 1 })).toHaveText("Importa docenti");
		await waitForHydration(page);
		await expect(page.getByTestId("template-alternatives")).toHaveCount(0);
		await expect(page.getByTestId("template-preview")).toHaveText(/^first_name;last_name/);
		await page.getByTestId("csv-file").setInputFiles({
			...csv(page, "first_name;last_name", [
				["Ugo", "Docente-Uno"],
				["Vera", "Docente-Due"],
			]),
			name: `teachers-${tagOf(page)}.csv`,
		});
		await page.getByTestId("upload-submit").click();
		await expect(page.getByTestId("detected-format")).toHaveText("first_name;last_name");
		await page.getByTestId("validate").click();
		await expect(page.getByTestId("counts")).toContainText("2 nuovi");
		await expect(page.getByTestId("generated-cards")).toContainText("2 tessere nuove");
		await page.getByTestId("commit").click();
		await expect(page.getByTestId("done-summary")).toContainText("2 nuovi");
		await expectAxeClean(page);
	});

	test("is not reachable without the import permission", async ({ page, context }) => {
		await context.clearCookies();
		const login = new LoginPage(page);
		await login.goto();
		await login.loginAs("prestiti", "prestiti-test-pw");
		await expect(page).toHaveURL(/\/circulation\/checkout$/);
		await page.goto("/admin/imports/students");
		await expect(page.getByRole("heading", { level: 1 })).toHaveText(
			/non è disponibile per l'account in uso/,
		);
		await page.goto("/admin/imports/teachers");
		await expect(page.getByRole("heading", { level: 1 })).toHaveText(
			/non è disponibile per l'account in uso/,
		);
	});
});
